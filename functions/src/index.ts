import Anthropic from '@anthropic-ai/sdk';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { randomInt, randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import {
  BADGE_NAMES,
  STATS_VERSION,
  XP_PER_PERSONAL_RECORD,
  applyWorkout,
  emptyStats,
  improvementsOver,
  levelForXp,
  qualifyingBadgeIds,
  workoutTotals,
  type ComparableWorkout,
  type StatsWorkout,
  type UserStats,
} from './achievements';
import { containsBlockedTerm } from './moderation';

initializeApp();
const db = getFirestore();

// Set with: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Set with: firebase functions:secrets:set RESEND_API_KEY
// Get a key at https://resend.com. Sends from ironpillar.app, which is
// verified in Resend (DNS records added 2026-09-30). Resend's shared
// onboarding@resend.dev sender only delivers to the account owner's address.
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const VERIFICATION_EMAIL_FROM = 'Iron Pillar <no-reply@ironpillar.app>';

// Set with: firebase functions:secrets:set REVENUECAT_SECRET_KEY
// Get it from the RevenueCat dashboard (Project Settings > API Keys > Secret
// key), once a RevenueCat project + "pro" entitlement exist.
// Because it's declared with defineSecret, `firebase deploy --only functions`
// refuses to deploy until this secret exists in Secret Manager — so it can't
// be left unset in production, and setting it turns the Pro check in
// generateWorkoutDetails on. A placeholder value won't work as an "off"
// switch either: RevenueCat rejects it and every generate call fails. The
// empty-value skip below only matters locally (e.g. the emulator with no
// secret provided).
const REVENUECAT_SECRET_KEY = defineSecret('REVENUECAT_SECRET_KEY');
// Must match the entitlement identifier in the RevenueCat dashboard and
// contexts/PurchasesContext.tsx.
const PRO_ENTITLEMENT_ID = 'iron_pillar_pro';

// Set with: firebase functions:secrets:set WHOOP_CLIENT_ID
//           firebase functions:secrets:set WHOOP_CLIENT_SECRET
// From the WHOOP Developer Dashboard (developer.whoop.com) once an app is
// registered there. The client ID isn't secret by OAuth convention (it's
// also sent from the app as EXPO_PUBLIC_WHOOP_CLIENT_ID to build the
// authorization URL), but is kept as a Functions secret too so the token
// exchange/refresh calls below don't need a second source of truth for it.
// WHOOP is ON HOLD, so these are deliberately NOT defineSecret(): the
// Firebase CLI prompts for every declared secret on deploy, even ones only
// used by un-exported functions. To re-enable WHOOP, switch these back to
// defineSecret('WHOOP_CLIENT_ID') / defineSecret('WHOOP_CLIENT_SECRET'), add
// them back to the `secrets` arrays below, and re-export the two functions.
const WHOOP_CLIENT_ID = { value: () => process.env.WHOOP_CLIENT_ID ?? '' };
const WHOOP_CLIENT_SECRET = { value: () => process.env.WHOOP_CLIENT_SECRET ?? '' };
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 30 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 5;

const XP_PER_EXERCISE = 50;
const XP_PER_SET = 5;
const XP_PER_STREAK_DAY = 20;
const STREAK_MILESTONE_INTERVAL = 5;
// A day only counts toward the streak once that day's workouts add up to at
// least this many minutes (summed across every workout logged that day).
const MIN_STREAK_DAY_MINUTES = 30;
const XP_PER_KM = 40;
// How many recent logs to search for the previous time a workout was done.
const PREVIOUS_WORKOUT_LOOKBACK = 40;
// Pro subscribers earn double XP on every workout (see constants/pro.ts).
const PRO_XP_MULTIPLIER = 2;
const MAX_ROUTE_POINTS = 20000; // ~5.5hrs at one point/sec — well beyond any real workout
// How often the time zone streak days are computed in may change. Without a
// limit, a client could claim a different zone on every call and log three
// "consecutive days" in one minute (UTC-12, UTC, UTC+14 all span three
// dates at once). Rate-limited, each change can pull at most one day
// forward — the same slack an honest eastbound traveler gets.
const MIN_TIME_ZONE_CHANGE_INTERVAL_MS = 20 * 60 * 60 * 1000;

interface LoggedSet {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
}

interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  logType: 'reps_weight' | 'duration';
  sets: LoggedSet[];
}

interface RoutePoint {
  lat: number;
  lng: number;
  t: number;
}

interface CompleteWorkoutRequest {
  workout: {
    id: string;
    name: string;
    category: 'preset' | 'quick_start' | 'browse' | 'custom' | 'outdoor';
  };
  exercises: ExerciseLog[];
  durationSeconds: number;
  // Outdoor GPS-tracked activities (walk/run/bike) report these instead of
  // exercises (exercises is still sent, just empty).
  activityType?: 'walk' | 'run' | 'bike';
  distanceMeters?: number;
  route?: RoutePoint[];
  // The device's IANA time zone (e.g. "America/New_York"), so the streak day
  // boundary is the user's local midnight rather than UTC midnight. Optional
  // — older app builds don't send it.
  timeZone?: string;
}

// IANA names only — Intl also accepts raw offsets like "+05:00", which
// could be pushed past the real -12h..+14h range of actual zones.
const IANA_TIME_ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

// Returns the canonical IANA name for a valid zone, or null.
function canonicalTimeZone(timeZone: unknown): string | null {
  if (typeof timeZone !== 'string' || timeZone.length > 64) return null;
  if (!IANA_TIME_ZONE_PATTERN.test(timeZone)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

// yyyy-mm-dd of the calendar day `date` falls on in `timeZone`.
function localDateString(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Pure calendar arithmetic on the yyyy-mm-dd string, so DST days (23h/25h)
// can't make "24 hours ago" land on the same or a skipped date.
function previousDateString(dateString: string) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function isValidRoutePoint(p: unknown): p is RoutePoint {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return typeof r.lat === 'number' && typeof r.lng === 'number' && typeof r.t === 'number';
}

function isValidCompleteWorkoutRequest(data: unknown): data is CompleteWorkoutRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!d.workout || typeof d.workout !== 'object') return false;
  const w = d.workout as Record<string, unknown>;
  if (typeof w.id !== 'string' || typeof w.name !== 'string' || typeof w.category !== 'string') {
    return false;
  }
  if (typeof d.durationSeconds !== 'number' || d.durationSeconds < 0) return false;

  const isOutdoor = w.category === 'outdoor';
  if (isOutdoor) {
    if (d.activityType !== 'walk' && d.activityType !== 'run' && d.activityType !== 'bike') {
      return false;
    }
    if (typeof d.distanceMeters !== 'number' || d.distanceMeters < 0) return false;
    if (!Array.isArray(d.route) || d.route.length > MAX_ROUTE_POINTS) return false;
    if (!d.route.every(isValidRoutePoint)) return false;
  } else if (!Array.isArray(d.exercises) || d.exercises.length === 0) {
    return false;
  }
  if (!Array.isArray(d.exercises)) return false;
  if (d.timeZone !== undefined && typeof d.timeZone !== 'string') return false;
  return true;
}

type FeedItemType =
  | 'badge_earned'
  | 'streak_milestone'
  | 'friend_workout'
  | 'reaction'
  | 'check_in'
  | 'comment'
  | 'friend_request_accepted';

function newFeedItem(
  type: FeedItemType,
  actorUid: string,
  actorName: string,
  message: string,
  subject?: string, // what the item is about (workout/badge name), for reactions
  extra: { postId?: string; photoUrl?: string; caption?: string } = {}
) {
  return {
    type,
    actorUid,
    actorName,
    message,
    ...(subject ? { subject } : {}),
    ...extra,
    createdAt: new Date().toISOString(),
  };
}

// Server-computed streak/XP/badges — the client only reports *what was done*
// (exercise/set shape); it can never set xp, streakCount, or lastWorkoutDate
// directly (Firestore rules block that), so this function is the only path
// that can move those numbers, using the server's own clock for the streak
// day boundary rather than trusting anything the client says about "today."
// The client does say which time zone it's in (so a 9 PM workout counts as
// that evening, not the next UTC day), but that only picks which local
// calendar the server's clock is read in: zone changes are rate-limited and
// lastWorkoutDate never moves backwards, so zone-hopping can't manufacture
// extra streak days.
export const completeWorkout = onCall({ secrets: [REVENUECAT_SECRET_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to complete a workout.');
  }
  if (!isValidCompleteWorkoutRequest(request.data)) {
    throw new HttpsError('invalid-argument', 'Malformed workout completion payload.');
  }
  const { workout, exercises, durationSeconds, activityType, distanceMeters, route } =
    request.data;
  const requestedTimeZone = canonicalTimeZone(request.data.timeZone);

  // Checked against RevenueCat on the server, before (not inside) the
  // transaction since it's a network call. Any failure — no secret, outage,
  // lapsed subscription — just means normal XP; it never blocks finishing.
  let xpMultiplier = 1;
  const revenueCatSecret = REVENUECAT_SECRET_KEY.value();
  if (revenueCatSecret) {
    try {
      if (await isProSubscriber(uid, revenueCatSecret)) xpMultiplier = PRO_XP_MULTIPLIER;
    } catch (e) {
      console.warn('Pro check failed during completeWorkout; awarding base XP', e);
    }
  }

  const userRef = db.collection('users').doc(uid);
  const logRef = db.collection('workoutLogs').doc(uid).collection('logs').doc();
  const friendsRef = db.collection('friendships').doc(uid).collection('friends');
  const badgesRef = userRef.collection('badges');
  const statsRef = db.collection('userStats').doc(uid);
  const logsRef = db.collection('workoutLogs').doc(uid).collection('logs');

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, friendsSnap, badgesSnap, statsSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(friendsRef),
      tx.get(badgesRef),
      tx.get(statsRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'User profile does not exist yet.');
    }
    const profile = userSnap.data() as {
      name: string;
      xp: number;
      streakCount: number;
      lastWorkoutDate: string | null;
      timeZone?: string;
      timeZoneUpdatedAt?: string;
      longestStreak?: number;
      activeDate?: string; // local date the minutes below were logged on
      activeDayMinutes?: number;
    };

    const now = new Date();
    const storedTimeZone = profile.timeZone ?? null;
    let timeZone = storedTimeZone ?? 'UTC';
    let timeZoneChanged = false;
    if (requestedTimeZone && requestedTimeZone !== storedTimeZone) {
      const lastChange = profile.timeZoneUpdatedAt ? Date.parse(profile.timeZoneUpdatedAt) : NaN;
      // A zone's first-ever set isn't a change; otherwise keep using the
      // stored zone until the interval has passed.
      if (!storedTimeZone || !(now.getTime() - lastChange < MIN_TIME_ZONE_CHANGE_INTERVAL_MS)) {
        timeZone = requestedTimeZone;
        timeZoneChanged = true;
      }
    }

    // Profiles from before streaks followed local time have lastWorkoutDate
    // as a UTC date. On their first zone-aware workout, re-derive it from
    // the last log's (server-written) completedAt in the user's zone, so the
    // switch can't break a streak or double-count a day.
    let lastWorkoutDate = profile.lastWorkoutDate;
    if (!storedTimeZone && timeZoneChanged && lastWorkoutDate) {
      const lastLogSnap = await tx.get(
        db
          .collection('workoutLogs')
          .doc(uid)
          .collection('logs')
          .orderBy('completedAt', 'desc')
          .limit(1)
      );
      const lastCompletedAt = lastLogSnap.docs[0]?.get('completedAt');
      if (typeof lastCompletedAt === 'string' && !Number.isNaN(Date.parse(lastCompletedAt))) {
        lastWorkoutDate = localDateString(new Date(lastCompletedAt), timeZone);
      }
    }

    const today = localDateString(now, timeZone);
    // `lastWorkoutDate` is the last day that *counted* toward the streak (30+
    // combined minutes). `<=`, not `===`: after a westward zone change "today"
    // can be earlier than the stored date. That counts as already counted, and
    // the stored date is kept, so moving the zone back and forth can't re-earn
    // a day.
    const dayAlreadyCounted = lastWorkoutDate !== null && today <= lastWorkoutDate;

    const workoutMinutes = Math.max(0, Math.round(durationSeconds / 60));
    const dayMinutes =
      (profile.activeDate === today ? (profile.activeDayMinutes ?? 0) : 0) + workoutMinutes;
    // This workout is the one that pushes today over the threshold.
    const dayQualifiesNow = !dayAlreadyCounted && dayMinutes >= MIN_STREAK_DAY_MINUTES;

    let streakCountAfter: number;
    if (!dayQualifiesNow) {
      streakCountAfter = profile.streakCount;
    } else if (lastWorkoutDate === previousDateString(today)) {
      streakCountAfter = profile.streakCount + 1;
    } else {
      streakCountAfter = 1;
    }
    const longestStreak = Math.max(profile.longestStreak ?? 0, streakCountAfter, profile.streakCount);

    // Lifetime totals live in userStats/{uid}. The first time (or after a
    // deleted log reset them) they're rebuilt from the full history, without
    // the GPS routes.
    const storedStats = statsSnap.data() as UserStats | undefined;
    let stats: UserStats;
    if (storedStats && storedStats.version === STATS_VERSION) {
      stats = storedStats;
    } else {
      const historySnap = await tx.get(logsRef.orderBy('completedAt', 'asc').select(...STATS_LOG_FIELDS));
      stats = statsFromHistory(historySnap.docs, timeZone);
    }
    const thisWorkout: StatsWorkout = {
      workoutId: workout.id,
      isOutdoor: workout.category === 'outdoor',
      completedAt: now,
      durationSeconds,
      exercises,
      distanceMeters: distanceMeters ?? 0,
    };
    const applied = applyWorkout(stats, thisWorkout, timeZone);
    const personalRecords = applied.personalRecords;

    // The last time this same workout (or the same kind of outdoor activity)
    // was done, to reward beating it.
    const recentSnap = await tx.get(
      logsRef
        .orderBy('completedAt', 'desc')
        .limit(PREVIOUS_WORKOUT_LOOKBACK)
        .select('workoutId', 'workoutSource', 'activityType', 'durationSeconds', 'exercises', 'distanceMeters')
    );
    const isOutdoor = workout.category === 'outdoor';
    const previousDoc = recentSnap.docs.find((doc) =>
      isOutdoor
        ? doc.get('workoutSource') === 'outdoor' && doc.get('activityType') === activityType
        : doc.get('workoutId') === workout.id
    );
    const previous: ComparableWorkout | null = previousDoc
      ? {
          exercises: Array.isArray(previousDoc.get('exercises')) ? previousDoc.get('exercises') : [],
          durationSeconds: Number(previousDoc.get('durationSeconds')) || 0,
          distanceMeters: Number(previousDoc.get('distanceMeters')) || 0,
        }
      : null;
    const improvements = improvementsOver(
      { exercises, durationSeconds, distanceMeters: distanceMeters ?? 0 },
      previous,
      isOutdoor
    );

    // XP is earned for what was actually logged: exercises with at least one
    // completed set, and each completed set. Blank rows earn nothing.
    const totals = workoutTotals(exercises);
    const setCount = totals.setsDone;
    const exerciseXp = totals.exercisesDone * XP_PER_EXERCISE;
    const setXp = setCount * XP_PER_SET;
    const distanceXp = distanceMeters ? Math.round((distanceMeters / 1000) * XP_PER_KM) : 0;
    const prBonus = personalRecords.length * XP_PER_PERSONAL_RECORD;
    const improvementXp = improvements.reduce((sum, i) => sum + i.xp, 0);
    const baseStreakBonus = dayQualifiesNow ? streakCountAfter * XP_PER_STREAK_DAY : 0;
    const baseXp = exerciseXp + setXp + distanceXp + prBonus + improvementXp;
    const xpEarned = (baseXp + baseStreakBonus) * xpMultiplier;
    const streakBonus = baseStreakBonus * xpMultiplier;

    const levelBefore = levelForXp(profile.xp ?? 0);
    const levelAfter = levelForXp((profile.xp ?? 0) + xpEarned);

    const alreadyEarned = new Set(badgesSnap.docs.map((d) => d.id));
    const badgesEarned = qualifyingBadgeIds(applied.stats, longestStreak, levelAfter).filter(
      (id) => !alreadyEarned.has(id)
    );
    // Older app builds only read this single id.
    const badgeEarnedId = badgesEarned[0] ?? null;
    const hitStreakMilestone =
      dayQualifiesNow && streakCountAfter > 0 && streakCountAfter % STREAK_MILESTONE_INTERVAL === 0;

    tx.set(logRef, {
      id: logRef.id,
      workoutId: workout.id,
      workoutName: workout.name,
      workoutSource: workout.category,
      completedAt: now.toISOString(),
      durationSeconds,
      exercises,
      xpEarned,
      xpMultiplier,
      streakBonusEarned: streakBonus,
      streakCountAfter,
      ...(activityType ? { activityType, distanceMeters, route: route ?? [] } : {}),
    });

    tx.update(userRef, {
      xp: FieldValue.increment(xpEarned),
      level: levelAfter,
      streakCount: streakCountAfter,
      longestStreak,
      activeDate: today,
      activeDayMinutes: dayMinutes,
      lastWorkoutDate: dayQualifiesNow ? today : lastWorkoutDate,
      ...(timeZoneChanged ? { timeZone, timeZoneUpdatedAt: now.toISOString() } : {}),
    });

    tx.set(statsRef, applied.stats);

    for (const badgeId of badgesEarned) {
      tx.set(badgesRef.doc(badgeId), {
        badgeId,
        earnedAt: FieldValue.serverTimestamp(),
      });
    }

    // Fan out to friends' activity feeds. Small friend counts expected for
    // an MVP, so writing directly into this transaction (rather than a
    // separate trigger) keeps it simple and atomic with everything else.
    // The workout is also a post friends can comment on (posts/{log id}),
    // and it appears in the person's own feed so they can see the comments.
    const postId = logRef.id;
    tx.set(db.collection('posts').doc(postId), {
      authorUid: uid,
      authorName: profile.name,
      type: 'friend_workout',
      message: `${profile.name} completed ${workout.name}!`,
      subject: workout.name,
      commentCount: 0,
      createdAt: now.toISOString(),
    });
    tx.set(
      db.collection('activityFeed').doc(uid).collection('items').doc(),
      newFeedItem('friend_workout', uid, profile.name, `You completed ${workout.name}!`, workout.name, {
        postId,
      })
    );

    for (const friendDoc of friendsSnap.docs) {
      const friendUid = friendDoc.id;
      const feedCol = db.collection('activityFeed').doc(friendUid).collection('items');

      tx.set(
        feedCol.doc(),
        newFeedItem(
          'friend_workout',
          uid,
          profile.name,
          `${profile.name} completed ${workout.name}!`,
          workout.name,
          { postId }
        )
      );
      // One feed item however many badges were earned at once.
      if (badgesEarned.length === 1) {
        const badgeName = BADGE_NAMES[badgesEarned[0]] ?? badgesEarned[0];
        tx.set(
          feedCol.doc(),
          newFeedItem(
            'badge_earned',
            uid,
            profile.name,
            `${profile.name} earned the ${badgeName} badge!`,
            `the ${badgeName} badge`
          )
        );
      } else if (badgesEarned.length > 1) {
        tx.set(
          feedCol.doc(),
          newFeedItem(
            'badge_earned',
            uid,
            profile.name,
            `${profile.name} earned ${badgesEarned.length} new badges!`,
            `${badgesEarned.length} new badges`
          )
        );
      }
      if (hitStreakMilestone) {
        tx.set(
          feedCol.doc(),
          newFeedItem(
            'streak_milestone',
            uid,
            profile.name,
            `${profile.name} hit a ${streakCountAfter}-day streak!`,
            `a ${streakCountAfter}-day streak`
          )
        );
      }
    }

    return {
      xpEarned,
      streakBonus,
      streakCountAfter,
      badgeEarnedId,
      badgesEarned,
      personalRecords,
      levelBefore,
      levelAfter,
      xpMultiplier,
      breakdown: {
        exercises: totals.exercisesDone,
        exerciseXp,
        sets: setCount,
        setXp,
        distanceXp,
        prBonus,
        improvements,
        baseStreakBonus,
      },
      dayMinutes,
      dayMinutesBefore: dayMinutes - workoutMinutes,
      minStreakDayMinutes: MIN_STREAK_DAY_MINUTES,
      dayCountedNow: dayQualifiesNow,
      dayAlreadyCounted,
    };
  });

  return result;
});

const STATS_LOG_FIELDS = ['workoutId', 'workoutSource', 'completedAt', 'durationSeconds', 'exercises', 'distanceMeters'];

// Lifetime totals rebuilt from a user's logs (oldest first), skipping
// `excludeId`. Used when there are no stored totals yet, and after a delete.
function statsFromHistory(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  timeZone: string,
  excludeId?: string
): UserStats {
  let stats = emptyStats();
  for (const doc of docs) {
    if (doc.id === excludeId) continue;
    const past = doc.data() as {
      workoutId?: string;
      workoutSource?: string;
      completedAt?: string;
      durationSeconds?: number;
      exercises?: ExerciseLog[];
      distanceMeters?: number;
    };
    const completedAt = new Date(past.completedAt ?? '');
    if (Number.isNaN(completedAt.getTime())) continue;
    stats = applyWorkout(
      stats,
      {
        workoutId: past.workoutId ?? doc.id,
        isOutdoor: past.workoutSource === 'outdoor',
        completedAt,
        durationSeconds: past.durationSeconds ?? 0,
        exercises: Array.isArray(past.exercises) ? past.exercises : [],
        distanceMeters: past.distanceMeters ?? 0,
      },
      timeZone
    ).stats;
  }
  return stats;
}

// Deletes one of the caller's own workout logs (e.g. a bugged or accidental
// one from Recent Workouts) and takes back the XP it awarded, so deleting
// can't be used to farm XP. Streak history is left alone: a past streak day
// isn't un-earned retroactively. If the log is from today, its minutes are
// also removed from today's running total toward the 30-minute streak day.
export const deleteWorkoutLog = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to delete a workout.');
  }
  const logId = (request.data as { logId?: unknown } | undefined)?.logId;
  if (typeof logId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(logId)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed logId.');
  }

  const userRef = db.collection('users').doc(uid);
  const logRef = db.collection('workoutLogs').doc(uid).collection('logs').doc(logId);

  const logsRef = db.collection('workoutLogs').doc(uid).collection('logs');
  const statsRef = db.collection('userStats').doc(uid);

  return db.runTransaction(async (tx) => {
    const [userSnap, logSnap, historySnap] = await Promise.all([
      tx.get(userRef),
      tx.get(logRef),
      tx.get(logsRef.orderBy('completedAt', 'asc').select(...STATS_LOG_FIELDS)),
    ]);
    if (!logSnap.exists) {
      throw new HttpsError('not-found', 'That workout was already deleted.');
    }
    const log = logSnap.data() as { xpEarned?: number; completedAt?: string; durationSeconds?: number };
    const profile = (userSnap.data() ?? {}) as {
      xp?: number;
      timeZone?: string;
      activeDate?: string;
      activeDayMinutes?: number;
    };

    const xpToRemove = Math.min(Math.max(0, log.xpEarned ?? 0), Math.max(0, profile.xp ?? 0));
    const updates: Record<string, unknown> = {
      xp: FieldValue.increment(-xpToRemove),
      level: levelForXp(Math.max(0, (profile.xp ?? 0) - xpToRemove)),
    };

    if (log.completedAt && profile.activeDate) {
      const logDay = localDateString(new Date(log.completedAt), profile.timeZone ?? 'UTC');
      if (logDay === profile.activeDate) {
        const minutes = Math.round((log.durationSeconds ?? 0) / 60);
        updates.activeDayMinutes = Math.max(0, (profile.activeDayMinutes ?? 0) - minutes);
      }
    }

    tx.delete(logRef);
    // Lifetime totals and personal bests are rebuilt without this log, so
    // profile stats and badge progress drop right away. Badges already
    // earned are kept.
    tx.set(statsRef, statsFromHistory(historySnap.docs, profile.timeZone ?? 'UTC', logId));
    if (userSnap.exists) tx.update(userRef, updates);
    return { deleted: true, xpRemoved: xpToRemove };
  });
});

const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

// Changes the caller's username if nobody else has it. Usernames are claimed
// in usernames/{name} (one doc per name), so the check and the swap happen in
// one transaction and two people can't grab the same name at once. Friends'
// copies of the name are updated too.
export const changeUsername = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to change your username.');
  }
  const raw = (request.data as { username?: unknown } | undefined)?.username;
  const username = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/^@/, '') : '';
  if (containsBlockedTerm(username)) {
    throw new HttpsError('invalid-argument', 'That username isn’t allowed. Try another.');
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpsError(
      'invalid-argument',
      'Usernames are 3 to 20 characters: letters, numbers, periods and underscores.'
    );
  }

  const userRef = db.collection('users').doc(uid);
  const newRef = db.collection('usernames').doc(username);
  const friendsRef = db.collection('friendships').doc(uid).collection('friends');

  return db.runTransaction(async (tx) => {
    const [userSnap, newSnap, friendsSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(newRef),
      tx.get(friendsRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Profile not found.');
    }
    const current = (userSnap.data() as { username?: string }).username;
    if (current === username) return { username };
    if (newSnap.exists && newSnap.get('uid') !== uid) {
      throw new HttpsError('already-exists', `@${username} is taken. Try another.`);
    }

    tx.set(newRef, { uid });
    if (current) tx.delete(db.collection('usernames').doc(current));
    tx.update(userRef, { username });
    for (const friend of friendsSnap.docs) {
      tx.update(db.collection('friendships').doc(friend.id).collection('friends').doc(uid), { username });
    }
    return { username };
  });
});

// A friend's public profile: name, level, streak, badges and lifetime totals.
// Profiles are owner-read-only in Firestore, so this checks the friendship
// and returns only what a friend may see (no birthday, body metrics, email,
// exercise notes or individual lifts).
export const getFriendProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to view a profile.');
  }
  const friendUid = (request.data as { uid?: unknown } | undefined)?.uid;
  if (typeof friendUid !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(friendUid)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed uid.');
  }
  if (friendUid !== uid) {
    const friendship = await db.collection('friendships').doc(uid).collection('friends').doc(friendUid).get();
    if (!friendship.exists) {
      throw new HttpsError('permission-denied', 'You can only view friends’ profiles.');
    }
  }

  const userRef = db.collection('users').doc(friendUid);
  const [userSnap, badgesSnap, statsSnap] = await Promise.all([
    userRef.get(),
    userRef.collection('badges').get(),
    db.collection('userStats').doc(friendUid).get(),
  ]);
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'That profile no longer exists.');
  }
  const profile = userSnap.data() as {
    name?: string;
    username?: string;
    avatarUrl?: string | null;
    avatarKey?: string | null;
    xp?: number;
    streakCount?: number;
    longestStreak?: number;
    friendCount?: number;
  };
  const xp = profile.xp ?? 0;
  const stored = statsSnap.data() as UserStats | undefined;
  // Totals exist once the friend has finished a workout on a recent build;
  // before that only the workout count is known.
  const workouts =
    stored?.workoutCount ??
    (await db.collection('workoutLogs').doc(friendUid).collection('logs').count().get()).data().count;

  return {
    uid: friendUid,
    name: profile.name ?? 'Friend',
    username: profile.username ?? '',
    avatarUrl: profile.avatarUrl ?? null,
    avatarKey: profile.avatarKey ?? null,
    xp,
    streakCount: profile.streakCount ?? 0,
    friendCount: profile.friendCount ?? 0,
    badges: badgesSnap.docs.map((d) => {
      const earnedAt = d.get('earnedAt');
      return {
        badgeId: d.id,
        earnedAt: earnedAt && typeof earnedAt.toDate === 'function' ? earnedAt.toDate().toISOString() : null,
      };
    }),
    stats: {
      workouts,
      streak: Math.max(profile.longestStreak ?? 0, profile.streakCount ?? 0),
      level: levelForXp(xp),
      ...(stored
        ? {
            prs: stored.prCount,
            volumeLb: stored.totalVolumeLb,
            distanceMeters: stored.totalDistanceMeters,
            singleDistanceMeters: stored.maxDistanceMeters,
            seconds: stored.totalSeconds,
            singleSeconds: stored.maxSeconds,
            early: stored.earlyCount,
            late: stored.lateCount,
            variety: stored.workoutIds.length,
          }
        : {}),
    },
  };
});

type Reaction = 'heart' | 'congrats';

// Lets a user react to a friend's workout, badge, or streak milestone in
// their activity feed. Feed items are fan-out copies (one per recipient), so
// the reaction is recorded on the reactor's own copy (so the button shows as
// sent) and the friend gets a new "reaction" item in their feed. Each reaction
// type can be sent once per item.
export const reactToActivity = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to react.');
  }
  const { itemId, reaction } = (request.data ?? {}) as { itemId?: unknown; reaction?: unknown };
  if (typeof itemId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(itemId)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed itemId.');
  }
  if (reaction !== 'heart' && reaction !== 'congrats') {
    throw new HttpsError('invalid-argument', 'Unknown reaction.');
  }

  const itemRef = db.collection('activityFeed').doc(uid).collection('items').doc(itemId);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const [itemSnap, userSnap] = await Promise.all([tx.get(itemRef), tx.get(userRef)]);
    if (!itemSnap.exists) {
      throw new HttpsError('not-found', 'That activity is no longer available.');
    }
    const item = itemSnap.data() as {
      type: string;
      actorUid: string;
      subject?: string;
      message: string;
      myReactions?: Partial<Record<Reaction, boolean>>;
    };
    if (item.type === 'reaction' || item.actorUid === uid) {
      throw new HttpsError('failed-precondition', 'You can’t react to this item.');
    }
    if (item.myReactions?.[reaction as Reaction]) {
      return { reacted: true, alreadySent: true };
    }
    // Only friends can react (the item landing in your feed implies it, but
    // the friendship may have ended since).
    const friendSnap = await tx.get(
      db.collection('friendships').doc(item.actorUid).collection('friends').doc(uid)
    );
    if (!friendSnap.exists) {
      throw new HttpsError('permission-denied', 'You can only react to friends’ activity.');
    }

    const name = (userSnap.data() as { name?: string } | undefined)?.name ?? 'A friend';
    const subject = item.subject ?? 'your workout';
    const message =
      reaction === 'heart'
        ? `${name} sent a ❤️ on ${subject}`
        : `🎉 ${name} congratulated you on ${subject}!`;

    tx.update(itemRef, { [`myReactions.${reaction}`]: true });
    tx.set(
      db.collection('activityFeed').doc(item.actorUid).collection('items').doc(),
      newFeedItem('reaction', uid, name, message)
    );
    return { reacted: true, alreadySent: false };
  });
});

// Friend relationships are mutual (both sides need to be written at once),
// which a single user's own auth can't do under normal ownership rules — so
// this runs as the Cloud Function's own Admin SDK write instead.
const requestRef = (toUid: string, fromUid: string) =>
  db.collection('friendRequests').doc(toUid).collection('incoming').doc(fromUid);
const outgoingRef = (fromUid: string, toUid: string) =>
  db.collection('friendRequests').doc(fromUid).collection('outgoing').doc(toUid);

// Makes two people friends (both sides at once) and clears any requests
// between them. Runs inside a transaction that has already read both users.
function writeFriendship(
  tx: FirebaseFirestore.Transaction,
  a: { uid: string; name: string; username: string },
  b: { uid: string; name: string; username: string }
) {
  const now = new Date().toISOString();
  tx.set(db.collection('friendships').doc(a.uid).collection('friends').doc(b.uid), {
    uid: b.uid,
    name: b.name,
    username: b.username,
    since: now,
  });
  tx.set(db.collection('friendships').doc(b.uid).collection('friends').doc(a.uid), {
    uid: a.uid,
    name: a.name,
    username: a.username,
    since: now,
  });
  tx.update(db.collection('users').doc(a.uid), { friendCount: FieldValue.increment(1) });
  tx.update(db.collection('users').doc(b.uid), { friendCount: FieldValue.increment(1) });
  tx.delete(requestRef(a.uid, b.uid));
  tx.delete(requestRef(b.uid, a.uid));
  tx.delete(outgoingRef(a.uid, b.uid));
  tx.delete(outgoingRef(b.uid, a.uid));
}

// Sends a friend request by username. The other person sees it under Friend
// Requests and can accept or decline. If they had already sent you one, this
// accepts it instead. (Named addFriend for older app builds.)
export const addFriend = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to add a friend.');
  }
  const rawUsername = (request.data as { username?: unknown })?.username;
  if (typeof rawUsername !== 'string' || !rawUsername.trim()) {
    throw new HttpsError('invalid-argument', 'A username is required.');
  }
  const username = rawUsername.trim().toLowerCase().replace(/^@/, '');

  const usernameSnap = await db.collection('usernames').doc(username).get();
  if (!usernameSnap.exists) {
    throw new HttpsError('not-found', `No user found with username "${username}".`);
  }
  const targetUid = usernameSnap.data()!.uid as string;
  if (targetUid === uid) {
    throw new HttpsError('invalid-argument', "You can't add yourself as a friend.");
  }
  // Either side having blocked the other looks the same as no such user.
  const [blockedByMe, blockedMe] = await Promise.all([
    blockRef(uid, targetUid).get(),
    blockRef(targetUid, uid).get(),
  ]);
  if (blockedByMe.exists || blockedMe.exists) {
    throw new HttpsError('not-found', `No user found with username "${username}".`);
  }

  const selfRef = db.collection('users').doc(uid);
  const targetRef = db.collection('users').doc(targetUid);

  return db.runTransaction(async (tx) => {
    const [selfSnap, targetSnap, friendSnap, theirRequestSnap] = await Promise.all([
      tx.get(selfRef),
      tx.get(targetRef),
      tx.get(db.collection('friendships').doc(uid).collection('friends').doc(targetUid)),
      tx.get(requestRef(uid, targetUid)),
    ]);
    if (!selfSnap.exists || !targetSnap.exists) {
      throw new HttpsError('failed-precondition', 'Profile not found.');
    }
    if (friendSnap.exists) {
      throw new HttpsError('already-exists', 'You are already friends.');
    }
    const self = selfSnap.data() as { name: string; username: string };
    const target = targetSnap.data() as { name: string; username: string };
    const me = { uid, name: self.name, username: self.username };
    const them = { uid: targetUid, name: target.name, username: target.username };

    if (theirRequestSnap.exists) {
      writeFriendship(tx, me, them);
      return { status: 'friends', uid: targetUid, name: target.name, username: target.username };
    }

    const now = new Date().toISOString();
    tx.set(requestRef(targetUid, uid), { ...me, createdAt: now });
    tx.set(outgoingRef(uid, targetUid), { ...them, createdAt: now });
    return { status: 'requested', uid: targetUid, name: target.name, username: target.username };
  });
});

// Accepts or declines a friend request someone sent you.
export const respondFriendRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const fromUid = readOtherUid(request.data, uid);
  const accept = (request.data as { accept?: unknown }).accept === true;

  return db.runTransaction(async (tx) => {
    const [reqSnap, selfSnap, fromSnap] = await Promise.all([
      tx.get(requestRef(uid, fromUid)),
      tx.get(db.collection('users').doc(uid)),
      tx.get(db.collection('users').doc(fromUid)),
    ]);
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'That request is no longer available.');
    }
    if (!accept || !fromSnap.exists || !selfSnap.exists) {
      tx.delete(requestRef(uid, fromUid));
      tx.delete(outgoingRef(fromUid, uid));
      return { status: 'declined' };
    }
    const self = selfSnap.data() as { name: string; username: string };
    const from = fromSnap.data() as { name: string; username: string };
    writeFriendship(
      tx,
      { uid, name: self.name, username: self.username },
      { uid: fromUid, name: from.name, username: from.username }
    );
    tx.set(
      db.collection('activityFeed').doc(fromUid).collection('items').doc(),
      newFeedItem('friend_request_accepted', uid, self.name, `${self.name} accepted your friend request.`)
    );
    return { status: 'friends' };
  });
});

// Withdraws a friend request you sent.
export const cancelFriendRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const toUid = readOtherUid(request.data, uid);
  const batch = db.batch();
  batch.delete(requestRef(toUid, uid));
  batch.delete(outgoingRef(uid, toUid));
  await batch.commit();
  return { cancelled: true };
});

// ---------------------------------------------------------------------------
// Posts and comments
//
// A post is a completed workout or a check-in photo. It lives at
// posts/{postId}; each friend's feed holds a copy pointing at it. Comments
// live at posts/{postId}/comments and can be read by the author and the
// author's friends (see firestore.rules); only these functions write them.
// ---------------------------------------------------------------------------

const MAX_COMMENT_LENGTH = 500;
const MAX_CAPTION_LENGTH = 200;

async function isFriend(a: string, b: string) {
  return (await db.collection('friendships').doc(a).collection('friends').doc(b).get()).exists;
}

export const addComment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in to comment.');
  const { postId, text } = (request.data ?? {}) as { postId?: unknown; text?: unknown };
  if (typeof postId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(postId)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed postId.');
  }
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body || body.length > MAX_COMMENT_LENGTH) {
    throw new HttpsError('invalid-argument', `Comments are 1 to ${MAX_COMMENT_LENGTH} characters.`);
  }
  if (containsBlockedTerm(body)) {
    throw new HttpsError('invalid-argument', 'That comment includes language that isn’t allowed.');
  }

  const postRef = db.collection('posts').doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError('not-found', 'That post is no longer available.');
  const post = postSnap.data() as { authorUid: string; subject?: string; type: string };
  if (post.authorUid !== uid && !(await isFriend(post.authorUid, uid))) {
    throw new HttpsError('permission-denied', 'You can only comment on friends’ posts.');
  }
  const user = ((await db.collection('users').doc(uid).get()).data() ?? {}) as { name?: string };
  const name = user.name ?? 'A friend';

  const commentRef = postRef.collection('comments').doc();
  const batch = db.batch();
  batch.set(commentRef, { id: commentRef.id, uid, name, text: body, createdAt: new Date().toISOString() });
  batch.update(postRef, { commentCount: FieldValue.increment(1) });
  if (post.authorUid !== uid) {
    batch.set(
      db.collection('activityFeed').doc(post.authorUid).collection('items').doc(),
      newFeedItem(
        'comment',
        uid,
        name,
        `${name} commented: “${body.length > 80 ? `${body.slice(0, 80)}…` : body}”`,
        post.type === 'check_in' ? 'your check-in' : post.subject,
        { postId }
      )
    );
  }
  await batch.commit();
  return { id: commentRef.id };
});

// The comment's writer or the post's author can delete a comment.
export const deleteComment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const { postId, commentId } = (request.data ?? {}) as { postId?: unknown; commentId?: unknown };
  if (typeof postId !== 'string' || typeof commentId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing postId or commentId.');
  }
  const postRef = db.collection('posts').doc(postId);
  const commentRef = postRef.collection('comments').doc(commentId);
  return db.runTransaction(async (tx) => {
    const [postSnap, commentSnap] = await Promise.all([tx.get(postRef), tx.get(commentRef)]);
    if (!commentSnap.exists) return { deleted: true };
    const isAuthor = postSnap.get('authorUid') === uid;
    if (!isAuthor && commentSnap.get('uid') !== uid) {
      throw new HttpsError('permission-denied', 'You can only delete your own comments.');
    }
    tx.delete(commentRef);
    if (postSnap.exists) tx.update(postRef, { commentCount: FieldValue.increment(-1) });
    return { deleted: true };
  });
});

// Removes a post everywhere: the post, its comments, its photo, and every
// feed copy of it.
async function removePost(postId: string) {
  const postRef = db.collection('posts').doc(postId);
  const postSnap = await postRef.get();
  const photoPath = postSnap.get('photoPath');
  await deleteCollection(postRef.collection('comments'));
  const copies = await db.collectionGroup('items').where('postId', '==', postId).get();
  const batch = db.batch();
  copies.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef);
  await batch.commit();
  if (typeof photoPath === 'string') {
    await getStorage().bucket().file(photoPath).delete({ ignoreNotFound: true });
  }
}

export const deletePost = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const postId = (request.data as { postId?: unknown } | undefined)?.postId;
  if (typeof postId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(postId)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed postId.');
  }
  const postSnap = await db.collection('posts').doc(postId).get();
  if (!postSnap.exists) return { deleted: true };
  if (postSnap.get('authorUid') !== uid) {
    throw new HttpsError('permission-denied', 'You can only delete your own posts.');
  }
  await removePost(postId);
  return { deleted: true };
});

// Shares a workout check-in photo with friends. The app uploads the photo to
// checkins/{uid}/{name} first, then calls this with its path.
export const createCheckIn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const { photoPath, caption } = (request.data ?? {}) as { photoPath?: unknown; caption?: unknown };
  if (typeof photoPath !== 'string' || !new RegExp(`^checkins/${uid}/[A-Za-z0-9_-]{1,64}\\.jpg$`).test(photoPath)) {
    throw new HttpsError('invalid-argument', 'Missing or malformed photo.');
  }
  const text = typeof caption === 'string' ? caption.trim().slice(0, MAX_CAPTION_LENGTH) : '';
  if (text && containsBlockedTerm(text)) {
    throw new HttpsError('invalid-argument', 'That caption includes language that isn’t allowed.');
  }
  const file = getStorage().bucket().file(photoPath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('failed-precondition', 'The photo didn’t finish uploading. Try again.');

  // A download URL (with a token) the app can show. Only friends are ever
  // given it, through their feed.
  const [metadata] = await file.getMetadata();
  let token = (metadata.metadata?.firebaseStorageDownloadTokens as string | undefined)?.split(',')[0];
  if (!token) {
    token = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  const bucket = getStorage().bucket().name;
  const photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(photoPath)}?alt=media&token=${token}`;

  const user = ((await db.collection('users').doc(uid).get()).data() ?? {}) as { name?: string };
  const name = user.name ?? 'A friend';
  const friends = await db.collection('friendships').doc(uid).collection('friends').get();

  const postRef = db.collection('posts').doc();
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(postRef, {
    authorUid: uid,
    authorName: name,
    type: 'check_in',
    message: `${name} checked in after a workout.`,
    caption: text,
    photoUrl,
    photoPath,
    commentCount: 0,
    createdAt: now,
  });
  const extra = { postId: postRef.id, photoUrl, ...(text ? { caption: text } : {}) };
  batch.set(
    db.collection('activityFeed').doc(uid).collection('items').doc(),
    newFeedItem('check_in', uid, name, 'You checked in after a workout.', 'your check-in', extra)
  );
  for (const friend of friends.docs) {
    batch.set(
      db.collection('activityFeed').doc(friend.id).collection('items').doc(),
      newFeedItem('check_in', uid, name, `${name} checked in after a workout.`, 'your check-in', extra)
    );
  }
  await batch.commit();
  return { postId: postRef.id };
});

const blockRef = (uid: string, otherUid: string) =>
  db.collection('blocks').doc(uid).collection('blocked').doc(otherUid);

function readOtherUid(data: unknown, uid: string) {
  const other = (data as { uid?: unknown } | undefined)?.uid;
  if (typeof other !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(other) || other === uid) {
    throw new HttpsError('invalid-argument', 'Missing or malformed uid.');
  }
  return other;
}

// Removes a friendship from both sides, if there is one.
async function unfriend(uid: string, otherUid: string) {
  const mine = db.collection('friendships').doc(uid).collection('friends').doc(otherUid);
  const theirs = db.collection('friendships').doc(otherUid).collection('friends').doc(uid);
  await db.runTransaction(async (tx) => {
    const [mineSnap, theirsSnap] = await Promise.all([tx.get(mine), tx.get(theirs)]);
    if (mineSnap.exists) {
      tx.delete(mine);
      tx.update(db.collection('users').doc(uid), { friendCount: FieldValue.increment(-1) });
    }
    if (theirsSnap.exists) {
      tx.delete(theirs);
      tx.update(db.collection('users').doc(otherUid), { friendCount: FieldValue.increment(-1) });
    }
  });
}

// Deletes the activity-feed items one user generated in another's feed.
async function clearFeedItems(feedOwnerUid: string, actorUid: string) {
  const snap = await db
    .collection('activityFeed')
    .doc(feedOwnerUid)
    .collection('items')
    .where('actorUid', '==', actorUid)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export const removeFriend = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const otherUid = readOtherUid(request.data, uid);
  await unfriend(uid, otherUid);
  return { removed: true };
});

// Blocking removes the friendship, clears each person's activity from the
// other's feed, and stops the blocked person finding or re-adding you.
export const blockUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const otherUid = readOtherUid(request.data, uid);
  const otherSnap = await db.collection('users').doc(otherUid).get();
  const other = (otherSnap.data() ?? {}) as { name?: string; username?: string };
  await blockRef(uid, otherUid).set({
    uid: otherUid,
    name: other.name ?? 'User',
    username: other.username ?? '',
    since: new Date().toISOString(),
  });
  await unfriend(uid, otherUid);
  const requests = db.batch();
  requests.delete(requestRef(uid, otherUid));
  requests.delete(requestRef(otherUid, uid));
  requests.delete(outgoingRef(uid, otherUid));
  requests.delete(outgoingRef(otherUid, uid));
  await requests.commit();
  await Promise.all([clearFeedItems(uid, otherUid), clearFeedItems(otherUid, uid)]);
  return { blocked: true };
});

export const unblockUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const otherUid = readOtherUid(request.data, uid);
  await blockRef(uid, otherUid).delete();
  return { unblocked: true };
});

const REPORT_REASONS = ['offensive_profile', 'harassment', 'impersonation', 'spam', 'other'] as const;
const SUPPORT_EMAIL = 'aidand510@gmail.com';

// Files a report about another user and emails it to the developer, so it
// can be reviewed and acted on within 24 hours (see the Terms of Use).
export const reportUser = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const otherUid = readOtherUid(request.data, uid);
  const { reason, details } = (request.data ?? {}) as { reason?: unknown; details?: unknown };
  if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason)) {
    throw new HttpsError('invalid-argument', 'Pick a reason for the report.');
  }
  const note = typeof details === 'string' ? details.trim().slice(0, 1000) : '';
  const { postId, commentId } = (request.data ?? {}) as { postId?: unknown; commentId?: unknown };
  const target = {
    ...(typeof postId === 'string' && /^[A-Za-z0-9]{1,64}$/.test(postId) ? { postId } : {}),
    ...(typeof commentId === 'string' && /^[A-Za-z0-9]{1,64}$/.test(commentId) ? { commentId } : {}),
  };

  const [reporterSnap, reportedSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(otherUid).get(),
  ]);
  const reporter = (reporterSnap.data() ?? {}) as { username?: string };
  const reported = (reportedSnap.data() ?? {}) as { name?: string; username?: string; avatarUrl?: string | null };
  const reportRef = db.collection('userReports').doc();
  await reportRef.set({
    reporterUid: uid,
    reportedUid: otherUid,
    reportedName: reported.name ?? '',
    reportedUsername: reported.username ?? '',
    reportedAvatarUrl: reported.avatarUrl ?? null,
    reason,
    details: note,
    ...target,
    status: 'new',
    createdAt: new Date().toISOString(),
  });

  // Best effort: the report is saved either way.
  const key = RESEND_API_KEY.value();
  if (key) {
    try {
      await new Resend(key).emails.send({
        from: VERIFICATION_EMAIL_FROM,
        to: SUPPORT_EMAIL,
        subject: `Iron Pillar user report: @${reported.username ?? otherUid} (${reason})`,
        text: [
          `Report ${reportRef.id}`,
          `Reported: ${reported.name ?? ''} @${reported.username ?? ''} (uid ${otherUid})`,
          reported.avatarUrl ? `Photo: ${reported.avatarUrl}` : 'Photo: none',
          `Reason: ${reason}`,
          target.postId ? `Post: posts/${target.postId}${target.commentId ? ` comment ${target.commentId}` : ''}` : 'Post: (profile report)',
          `Details: ${note || '(none)'}`,
          `Reporter: @${reporter.username ?? ''} (uid ${uid})`,
          '',
          'Act within 24 hours: remove the content or the account in the Firebase console, then set the report status.',
        ].join('\n'),
      });
    } catch (e) {
      console.error('Report email failed', e);
    }
  }
  return { reported: true };
});

// A deleted account's posts (with their photos and comments) and the
// comments it left on other people's posts.
async function deletePostsAndComments(uid: string) {
  const posts = await db.collection('posts').where('authorUid', '==', uid).get();
  for (const post of posts.docs) await removePost(post.id);
  const comments = await db.collectionGroup('comments').where('uid', '==', uid).get();
  for (const comment of comments.docs) {
    const postRef = comment.ref.parent.parent;
    await comment.ref.delete();
    if (postRef) await postRef.update({ commentCount: FieldValue.increment(-1) }).catch(() => {});
  }
  await getStorage().bucket().deleteFiles({ prefix: `checkins/${uid}/` }).catch(() => {});
}

async function deleteCollection(colRef: FirebaseFirestore.CollectionReference) {
  const snap = await colRef.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// Profile photos live at exactly `avatars/<uid>` (see lib/avatar.ts). Also
// sweeps `avatars/<uid>/...` in case the upload path ever gains a per-file
// suffix. A user who never set a photo has nothing here, which is fine.
async function deleteAvatar(uid: string) {
  const bucket = getStorage().bucket();
  await Promise.all([
    bucket.file(`avatars/${uid}`).delete({ ignoreNotFound: true }),
    bucket.deleteFiles({ prefix: `avatars/${uid}/` }),
  ]);
}

// Deletes a user's account: their profile, everything nested under it,
// their workout history, custom workouts, their own friendships, their
// username claim, their profile photo in Storage, their WHOOP tokens and
// snapshot, and the Auth account itself — plus removes them from
// each friend's friend list (a plain client write can't touch another
// user's data, so this has to run with Admin SDK privileges like addFriend).
// Note: activity feed items this user posted into *other* users' feeds are
// left as historical record, same as most social apps leave old posts after
// a deactivation. bugReports are also intentionally kept (the privacy
// policy says bug reports may be retained).
export const deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to delete your account.');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const username = (userSnap.data() as { username?: string } | undefined)?.username;

  const friendsSnap = await db.collection('friendships').doc(uid).collection('friends').get();
  const batch = db.batch();
  for (const friendDoc of friendsSnap.docs) {
    const friendUid = friendDoc.id;
    batch.delete(db.collection('friendships').doc(friendUid).collection('friends').doc(uid));
    batch.update(db.collection('users').doc(friendUid), { friendCount: FieldValue.increment(-1) });
  }
  if (username) {
    batch.delete(db.collection('usernames').doc(username));
  }
  batch.delete(userRef);
  await batch.commit();

  await Promise.all([
    deleteCollection(db.collection('users').doc(uid).collection('badges')),
    deleteCollection(db.collection('users').doc(uid).collection('metrics')),
    deleteCollection(db.collection('users').doc(uid).collection('exerciseNotes')),
    deleteCollection(db.collection('users').doc(uid).collection('workoutNotes')), // earlier per-workout notes
    db.collection('userStats').doc(uid).delete(),
    deleteCollection(db.collection('workoutLogs').doc(uid).collection('logs')),
    deleteCollection(db.collection('userWorkouts').doc(uid).collection('customWorkouts')),
    deleteCollection(db.collection('friendships').doc(uid).collection('friends')),
    deleteCollection(db.collection('activityFeed').doc(uid).collection('items')),
    deleteCollection(db.collection('blocks').doc(uid).collection('blocked')),
    deleteCollection(db.collection('friendRequests').doc(uid).collection('incoming')),
    deleteCollection(db.collection('friendRequests').doc(uid).collection('outgoing')),
    deletePostsAndComments(uid),
    db.collection('wearableTokens').doc(uid).delete(),
    db.collection('wearableSnapshots').doc(uid).delete(),
    deleteAvatar(uid),
  ]);

  await getAuth().deleteUser(uid);

  return { success: true };
});

// ---------------------------------------------------------------------------
// AI-generated workout details
//
// When a user builds a custom workout they only supply a name + a list of
// exercises. This fills in the same descriptive fields the seeded preset
// templates have — an overview, a time estimate, a calorie range, whether
// equipment is needed, per-section workout tips, an equipment breakdown, and
// a one-liner tip per exercise — by asking Claude. It runs server-side so the
// Anthropic API key never ships in the app bundle. The client treats a
// failure here as non-fatal (the workout still saves, just without the extra
// detail), so this throws rather than returning a partial object.
// ---------------------------------------------------------------------------

const WORKOUT_DETAIL_MODEL = 'claude-haiku-4-5';

interface GenerateExerciseInput {
  name: string;
  logType: 'reps_weight' | 'duration';
  targetSets: number;
  targetRepsLabel: string;
}

interface GenerateWorkoutDetailsRequest {
  name: string;
  exercises: GenerateExerciseInput[];
}

function isValidGenerateRequest(data: unknown): data is GenerateWorkoutDetailsRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.name !== 'string' || !d.name.trim()) return false;
  if (!Array.isArray(d.exercises) || d.exercises.length === 0 || d.exercises.length > 40) return false;
  return d.exercises.every((e) => {
    if (!e || typeof e !== 'object') return false;
    const ex = e as Record<string, unknown>;
    return (
      typeof ex.name === 'string' &&
      !!ex.name.trim() &&
      (ex.logType === 'reps_weight' || ex.logType === 'duration') &&
      typeof ex.targetSets === 'number' &&
      typeof ex.targetRepsLabel === 'string'
    );
  });
}

const infoSectionSchema = {
  type: 'array',
  maxItems: 4,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['heading', 'bullets'],
    properties: {
      heading: { type: 'string' },
      bullets: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
    },
  },
} as const;

const WORKOUT_DETAILS_TOOL: Anthropic.Tool = {
  name: 'emit_workout_details',
  description: 'Return the descriptive metadata for a workout.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'durationMinutes',
      'caloriesRangeLabel',
      'equipmentRequired',
      'overview',
      'workoutTips',
      'equipment',
      'exerciseTips',
    ],
    properties: {
      durationMinutes: {
        type: 'integer',
        minimum: 5,
        maximum: 180,
        description: 'Realistic total time including warm-up, rest between sets, and cool-down.',
      },
      caloriesRangeLabel: {
        type: 'string',
        description: 'Estimated calorie burn as a range, formatted exactly like "320-450 Calories".',
      },
      equipmentRequired: {
        type: 'boolean',
        description: 'True if any exercise needs equipment beyond bodyweight / a mat.',
      },
      overview: {
        type: 'string',
        description:
          '2-4 sentences: what this session targets, who it suits, and how it should feel. Plain text, no markdown.',
      },
      workoutTips: {
        ...infoSectionSchema,
        description:
          'Grouped coaching tips, e.g. sections titled "Weight Guidelines", "Rest Times", "Form Cues".',
      },
      equipment: {
        ...infoSectionSchema,
        description:
          'Equipment breakdown, e.g. a "Required" section and an "Optional" section. If no equipment is needed, return one section titled "No Equipment" explaining it is bodyweight-only.',
      },
      exerciseTips: {
        type: 'array',
        maxItems: 40,
        description: 'One short coaching cue per exercise, matched by exact exercise name.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'tips'],
          properties: {
            name: { type: 'string' },
            tips: { type: 'string', description: 'One sentence, <= 140 characters.' },
          },
        },
      },
    },
  },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function cleanInfoSections(value: unknown): { heading: string; bullets: string[] }[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .map((section) => {
      const s = (section ?? {}) as Record<string, unknown>;
      const bullets = Array.isArray(s.bullets)
        ? s.bullets.map((b) => cleanString(b, 200)).filter(Boolean).slice(0, 6)
        : [];
      return { heading: cleanString(s.heading, 80), bullets };
    })
    .filter((s) => s.heading && s.bullets.length > 0);
}

// Looks up whether a user currently holds the "pro" RevenueCat entitlement.
// Fails closed on a clean "not entitled" answer from RevenueCat, but fails
// *open* (throws, caller decides) on a network/API error — a RevenueCat
// outage shouldn't silently lock every user out of a feature they're paying
// for, but it also shouldn't silently unlock it for free.
async function isProSubscriber(uid: string, secretValue: string): Promise<boolean> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${secretValue}` },
  });
  if (!res.ok) {
    throw new HttpsError('internal', 'Could not verify subscription status. Try again.');
  }
  const data = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const entitlement = data.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID];
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true; // lifetime/non-expiring grant
  return new Date(entitlement.expires_date).getTime() > Date.now();
}

export const generateWorkoutDetails = onCall(
  { secrets: [ANTHROPIC_API_KEY, REVENUECAT_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in to generate workout details.');
    }
    if (!isValidGenerateRequest(request.data)) {
      throw new HttpsError('invalid-argument', 'Malformed generate-details payload.');
    }
    const { name, exercises } = request.data;

    // AI-generated workout details are a Pro feature (see app/paywall.tsx).
    // Only skipped when the secret's value is empty, which in practice means
    // local/emulator runs — a deployed function always has it set (see the
    // REVENUECAT_SECRET_KEY declaration above).
    const revenueCatSecret = REVENUECAT_SECRET_KEY.value();
    if (revenueCatSecret) {
      const isPro = await isProSubscriber(uid, revenueCatSecret);
      if (!isPro) {
        throw new HttpsError('permission-denied', 'Upgrade to Pro to generate AI workout details.');
      }
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const exerciseLines = exercises
      .map(
        (e, i) =>
          `${i + 1}. ${e.name} — ${e.targetSets} sets of ${e.targetRepsLabel}` +
          (e.logType === 'duration' ? ' (timed)' : '')
      )
      .join('\n');

    let message: Anthropic.Message;
    try {
      message = await anthropic.messages.create({
        model: WORKOUT_DETAIL_MODEL,
        max_tokens: 2000,
        system:
          'You are a certified strength and conditioning coach writing concise, practical ' +
          'metadata for a workout in a fitness app. Be specific and realistic. Never use markdown. ' +
          'Always respond by calling the emit_workout_details tool.',
        tools: [WORKOUT_DETAILS_TOOL],
        tool_choice: { type: 'tool', name: 'emit_workout_details' },
        messages: [
          {
            role: 'user',
            content:
              `Workout name: ${name}\n\nExercises:\n${exerciseLines}\n\n` +
              'Fill in the workout details. For exerciseTips, use the exact exercise names above.',
          },
        ],
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      throw new HttpsError('internal', `AI request failed: ${detail}`);
    }

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    if (!toolUse) {
      throw new HttpsError('internal', 'AI returned no structured output.');
    }

    const raw = toolUse.input as Record<string, unknown>;
    const rawTips = Array.isArray(raw.exerciseTips) ? raw.exerciseTips : [];
    const exerciseTips = rawTips
      .map((t) => {
        const tip = (t ?? {}) as Record<string, unknown>;
        return { name: cleanString(tip.name, 120), tips: cleanString(tip.tips, 200) };
      })
      .filter((t) => t.name && t.tips)
      .slice(0, exercises.length);

    return {
      durationMinutes: clampInt(raw.durationMinutes, 5, 180, Math.max(10, exercises.length * 5)),
      caloriesRangeLabel: cleanString(raw.caloriesRangeLabel, 40) || 'Varies',
      equipmentRequired: raw.equipmentRequired === true,
      overview: cleanString(raw.overview, 800),
      workoutTips: cleanInfoSections(raw.workoutTips),
      equipment: cleanInfoSections(raw.equipment),
      exerciseTips,
    };
  }
);

function verificationCodeEmailHtml(code: string) {
  return (
    `<div style="font-family:sans-serif;font-size:16px;color:#111">` +
    `<p>Your Iron Pillar verification code is:</p>` +
    `<p style="font-size:32px;font-weight:700;letter-spacing:4px">${code}</p>` +
    `<p>This code expires in 10 minutes.</p>` +
    `</div>`
  );
}

// Sends a fresh 6-digit code to the signed-in user's own email and stores it
// (function-only Firestore doc) for verifyEmailCode to check against. Called
// right after sign-up, and again by the verify-email screen's "Resend" button.
export const sendVerificationCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  const email = request.auth?.token.email;
  if (!uid || !email) {
    throw new HttpsError('unauthenticated', 'Must be signed in to request a verification code.');
  }

  const codeRef = db.collection('emailVerificationCodes').doc(uid);
  const existing = await codeRef.get();
  const lastSentAt = existing.exists ? (existing.data()!.lastSentAt as string | undefined) : undefined;
  if (lastSentAt && Date.now() - new Date(lastSentAt).getTime() < VERIFICATION_RESEND_COOLDOWN_MS) {
    throw new HttpsError('resource-exhausted', 'Please wait a bit before requesting another code.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();

  const resend = new Resend(RESEND_API_KEY.value());
  const { error } = await resend.emails.send({
    from: VERIFICATION_EMAIL_FROM,
    to: email,
    subject: 'Your Iron Pillar verification code',
    html: verificationCodeEmailHtml(code),
  });
  if (error) {
    // The provider's message (e.g. a sender-domain problem) is for us, not
    // the person signing up.
    console.error('Resend rejected the verification email', error);
    throw new HttpsError(
      'unavailable',
      "We couldn't send your verification email right now. Please try again in a few minutes."
    );
  }

  await codeRef.set({
    code,
    email,
    expiresAt: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS).toISOString(),
    attempts: 0,
    lastSentAt: now.toISOString(),
  });

  return { sent: true };
});

// Checks a code the user typed in against the stored one, and if it matches,
// flips the *same* emailVerified flag Firebase Auth's own link-based
// verification would have set — so the rest of the app (and any future
// Firebase feature that checks user.emailVerified) sees a normal verified
// account, just verified via a typed code instead of a clicked link.
export const verifyEmailCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to verify a code.');
  }
  const rawCode = (request.data as { code?: unknown })?.code;
  if (typeof rawCode !== 'string' || !/^\d{6}$/.test(rawCode)) {
    throw new HttpsError('invalid-argument', 'Enter the 6-digit code from your email.');
  }

  const codeRef = db.collection('emailVerificationCodes').doc(uid);
  const snap = await codeRef.get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'Request a new code first.');
  }
  const data = snap.data()!;

  if (new Date(data.expiresAt as string).getTime() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'That code expired. Request a new one.');
  }
  if ((data.attempts as number) >= VERIFICATION_MAX_ATTEMPTS) {
    throw new HttpsError('resource-exhausted', 'Too many wrong attempts. Request a new code.');
  }

  if (data.code !== rawCode) {
    await codeRef.update({ attempts: FieldValue.increment(1) });
    throw new HttpsError('invalid-argument', "That code doesn't match.");
  }

  await getAuth().updateUser(uid, { emailVerified: true });
  await codeRef.delete();

  return { verified: true };
});

// ---------------------------------------------------------------------------
// WHOOP wearable integration (IP-30)
// ---------------------------------------------------------------------------

interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface WhoopRecoveryRecord {
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
  };
}
interface WhoopSleepRecord {
  score?: { sleep_performance_percentage?: number };
}
interface WhoopCycleRecord {
  score?: { strain?: number };
}
interface WhoopCollection<T> {
  records?: T[];
}

async function whoopTokenRequest(params: Record<string, string>): Promise<WhoopTokenResponse> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpsError('internal', `WHOOP token request failed: ${detail || res.status}`);
  }
  return (await res.json()) as WhoopTokenResponse;
}

async function whoopGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new HttpsError('internal', `WHOOP API request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

async function storeWhoopTokens(uid: string, tokens: WhoopTokenResponse) {
  await db.collection('wearableTokens').doc(uid).set(
    {
      provider: 'whoop',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    },
    { merge: true }
  );
}

// Returns a valid (non-expired) WHOOP access token for a user, refreshing it
// first if it's expired or within 60s of expiring. Throws if the user never
// connected WHOOP at all.
async function getValidWhoopAccessToken(uid: string): Promise<string> {
  const snap = await db.collection('wearableTokens').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'WHOOP is not connected for this account.');
  }
  const data = snap.data()!;
  if (Date.now() < (data.expiresAt as number) - 60_000) {
    return data.accessToken as string;
  }
  const refreshed = await whoopTokenRequest({
    grant_type: 'refresh_token',
    refresh_token: data.refreshToken as string,
    client_id: WHOOP_CLIENT_ID.value(),
    client_secret: WHOOP_CLIENT_SECRET.value(),
  });
  await storeWhoopTokens(uid, refreshed);
  return refreshed.access_token;
}

// Pulls the latest recovery/sleep/cycle records and writes a display-ready
// snapshot to wearableSnapshots/{uid}. Best-effort per metric — a WHOOP
// account with no recovery/sleep/cycle data yet (e.g. day one) shouldn't fail
// the whole sync over one missing record type.
async function performWhoopSync(uid: string): Promise<void> {
  const accessToken = await getValidWhoopAccessToken(uid);

  const [recovery, sleep, cycle] = await Promise.all([
    whoopGet<WhoopCollection<WhoopRecoveryRecord>>(accessToken, '/recovery?limit=1').catch(() => null),
    whoopGet<WhoopCollection<WhoopSleepRecord>>(accessToken, '/activity/sleep?limit=1').catch(() => null),
    whoopGet<WhoopCollection<WhoopCycleRecord>>(accessToken, '/cycle?limit=1').catch(() => null),
  ]);

  const recoveryRecord = recovery?.records?.[0];
  const sleepRecord = sleep?.records?.[0];
  const cycleRecord = cycle?.records?.[0];

  const snapshot: Record<string, unknown> = {
    provider: 'whoop',
    connected: true,
    lastSyncedAt: new Date().toISOString(),
  };
  if (recoveryRecord?.score) {
    snapshot.recoveryScore = recoveryRecord.score.recovery_score;
    snapshot.hrvMs = recoveryRecord.score.hrv_rmssd_milli;
    snapshot.restingHeartRateBpm = recoveryRecord.score.resting_heart_rate;
  }
  if (sleepRecord?.score) {
    snapshot.sleepPerformancePct = sleepRecord.score.sleep_performance_percentage;
  }
  if (cycleRecord?.score) {
    snapshot.dayStrain = cycleRecord.score.strain;
  }

  await db.collection('wearableSnapshots').doc(uid).set(snapshot, { merge: true });
}

// Exchanges an OAuth authorization code (from the client's expo-auth-session
// flow) for WHOOP tokens, stores them server-side, and runs an initial sync
// so the user sees real data immediately after connecting.
// WHOOP sync is a Pro feature (see constants/pro.ts). Same empty-secret
// skip as generateWorkoutDetails: only relevant to local/emulator runs.
async function requirePro(uid: string, message: string) {
  const secret = REVENUECAT_SECRET_KEY.value();
  if (secret && !(await isProSubscriber(uid, secret))) {
    throw new HttpsError('permission-denied', message);
  }
}

// WHOOP is ON HOLD (no WHOOP developer app registered yet). exchangeWhoopCode
// and syncWhoopData are deliberately not exported, so `firebase deploy` neither
// deploys them nor requires the WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET secrets.
// To enable: register the app, set both secrets, set EXPO_PUBLIC_WHOOP_CLIENT_ID,
// and add `export` back to both. The app hides WHOOP while that env var is empty.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const exchangeWhoopCode = onCall(
  { secrets: [REVENUECAT_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in to connect WHOOP.');
    }
    const { code, redirectUri } = (request.data ?? {}) as { code?: string; redirectUri?: string };
    if (!code || !redirectUri) {
      throw new HttpsError('invalid-argument', 'Missing code or redirectUri.');
    }
    await requirePro(uid, 'Upgrade to Pro to connect WHOOP.');

    const tokens = await whoopTokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: WHOOP_CLIENT_ID.value(),
      client_secret: WHOOP_CLIENT_SECRET.value(),
    });
    await storeWhoopTokens(uid, tokens);
    await db
      .collection('wearableSnapshots')
      .doc(uid)
      .set(
        { provider: 'whoop', connected: true, connectedAt: new Date().toISOString() },
        { merge: true }
      );

    try {
      await performWhoopSync(uid);
    } catch (e) {
      // The connection itself still succeeded even if the first sync didn't
      // (e.g. a brand-new WHOOP account with no recovery data yet) — don't
      // fail the whole connect flow over that.
      console.warn('Initial WHOOP sync failed', e);
    }

    return { connected: true };
  }
);

// Callable so the client can trigger a manual "Sync now".
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const syncWhoopData = onCall(
  { secrets: [REVENUECAT_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in to sync WHOOP data.');
    }
    await requirePro(uid, 'Upgrade to Pro to sync WHOOP data.');
    await performWhoopSync(uid);
    return { synced: true };
  }
);

export const disconnectWhoop = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  await db.collection('wearableTokens').doc(uid).delete();
  await db
    .collection('wearableSnapshots')
    .doc(uid)
    .set({ provider: 'whoop', connected: false }, { merge: true });
  return { disconnected: true };
});

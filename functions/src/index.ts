import Anthropic from '@anthropic-ai/sdk';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { randomInt } from 'node:crypto';
import { Resend } from 'resend';

initializeApp();
const db = getFirestore();

// Set with: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Set with: firebase functions:secrets:set RESEND_API_KEY
// Get a free key at https://resend.com (no credit card needed). Sending from
// "onboarding@resend.dev" works immediately with no domain setup — fine for
// a demo; a verified custom domain is only needed before a real launch.
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const VERIFICATION_EMAIL_FROM = 'Iron Pillar <onboarding@resend.dev>';

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
const WHOOP_CLIENT_ID = defineSecret('WHOOP_CLIENT_ID');
const WHOOP_CLIENT_SECRET = defineSecret('WHOOP_CLIENT_SECRET');
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 30 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 5;

const XP_PER_EXERCISE = 50;
const XP_PER_SET = 5;
const XP_PER_STREAK_DAY = 20;
const STREAK_MILESTONE_INTERVAL = 5;
const XP_PER_KM = 40;
// Pro subscribers earn double XP on every workout (see constants/pro.ts).
const PRO_XP_MULTIPLIER = 2;
const MAX_ROUTE_POINTS = 20000; // ~5.5hrs at one point/sec — well beyond any real workout
// How often the time zone streak days are computed in may change. Without a
// limit, a client could claim a different zone on every call and log three
// "consecutive days" in one minute (UTC-12, UTC, UTC+14 all span three
// dates at once). Rate-limited, each change can pull at most one day
// forward — the same slack an honest eastbound traveler gets.
const MIN_TIME_ZONE_CHANGE_INTERVAL_MS = 20 * 60 * 60 * 1000;

const BADGE_NAMES: Record<string, string> = {
  'the-journey-begins': 'The Journey Begins',
};

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

function newFeedItem(
  type: 'badge_earned' | 'streak_milestone' | 'friend_workout',
  actorUid: string,
  actorName: string,
  message: string
) {
  return {
    type,
    actorUid,
    actorName,
    message,
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

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, friendsSnap] = await Promise.all([tx.get(userRef), tx.get(friendsRef)]);
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
    // `<=`, not `===`: after a westward zone change "today" can be earlier
    // than the stored date. That counts as already logged, and the stored
    // date is kept, so moving the zone back and forth can't re-earn a day.
    const alreadyLoggedToday = lastWorkoutDate !== null && today <= lastWorkoutDate;

    let streakCountAfter: number;
    if (alreadyLoggedToday) {
      streakCountAfter = profile.streakCount;
    } else if (lastWorkoutDate === previousDateString(today)) {
      streakCountAfter = profile.streakCount + 1;
    } else {
      streakCountAfter = 1;
    }

    const streakBonus =
      (alreadyLoggedToday ? 0 : streakCountAfter * XP_PER_STREAK_DAY) * xpMultiplier;
    const setCount = exercises.reduce((sum, e) => sum + (e.sets?.length ?? 0), 0);
    const distanceXp = distanceMeters ? Math.round((distanceMeters / 1000) * XP_PER_KM) : 0;
    const baseXp = exercises.length * XP_PER_EXERCISE + setCount * XP_PER_SET + distanceXp;
    const xpEarned = baseXp * xpMultiplier + streakBonus;

    const isFirstWorkout = profile.lastWorkoutDate === null;
    const badgeEarnedId = isFirstWorkout ? 'the-journey-begins' : null;
    const hitStreakMilestone =
      !alreadyLoggedToday && streakCountAfter > 0 && streakCountAfter % STREAK_MILESTONE_INTERVAL === 0;

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
      streakCount: streakCountAfter,
      lastWorkoutDate: alreadyLoggedToday ? lastWorkoutDate : today,
      ...(timeZoneChanged ? { timeZone, timeZoneUpdatedAt: now.toISOString() } : {}),
    });

    if (badgeEarnedId) {
      tx.set(db.collection('users').doc(uid).collection('badges').doc(badgeEarnedId), {
        badgeId: badgeEarnedId,
        earnedAt: FieldValue.serverTimestamp(),
      });
    }

    // Fan out to friends' activity feeds. Small friend counts expected for
    // an MVP, so writing directly into this transaction (rather than a
    // separate trigger) keeps it simple and atomic with everything else.
    for (const friendDoc of friendsSnap.docs) {
      const friendUid = friendDoc.id;
      const feedCol = db.collection('activityFeed').doc(friendUid).collection('items');

      tx.set(
        feedCol.doc(),
        newFeedItem('friend_workout', uid, profile.name, `${profile.name} completed ${workout.name}!`)
      );
      if (badgeEarnedId) {
        const badgeName = BADGE_NAMES[badgeEarnedId] ?? badgeEarnedId;
        tx.set(
          feedCol.doc(),
          newFeedItem('badge_earned', uid, profile.name, `${profile.name} earned the ${badgeName} badge!`)
        );
      }
      if (hitStreakMilestone) {
        tx.set(
          feedCol.doc(),
          newFeedItem(
            'streak_milestone',
            uid,
            profile.name,
            `${profile.name} hit a ${streakCountAfter}-day streak!`
          )
        );
      }
    }

    return { xpEarned, streakBonus, streakCountAfter, badgeEarnedId, xpMultiplier };
  });

  return result;
});

// Friend relationships are mutual (both sides need to be written at once),
// which a single user's own auth can't do under normal ownership rules — so
// this runs as the Cloud Function's own Admin SDK write instead.
export const addFriend = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to add a friend.');
  }
  const rawUsername = (request.data as { username?: unknown })?.username;
  if (typeof rawUsername !== 'string' || !rawUsername.trim()) {
    throw new HttpsError('invalid-argument', 'A username is required.');
  }
  const username = rawUsername.trim().toLowerCase();

  const usernameSnap = await db.collection('usernames').doc(username).get();
  if (!usernameSnap.exists) {
    throw new HttpsError('not-found', `No user found with username "${username}".`);
  }
  const targetUid = usernameSnap.data()!.uid as string;

  if (targetUid === uid) {
    throw new HttpsError('invalid-argument', "You can't add yourself as a friend.");
  }

  const selfRef = db.collection('users').doc(uid);
  const targetRef = db.collection('users').doc(targetUid);
  const selfFriendRef = db.collection('friendships').doc(uid).collection('friends').doc(targetUid);
  const targetFriendRef = db.collection('friendships').doc(targetUid).collection('friends').doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const [selfSnap, targetSnap, existingFriendSnap] = await Promise.all([
      tx.get(selfRef),
      tx.get(targetRef),
      tx.get(selfFriendRef),
    ]);
    if (!selfSnap.exists || !targetSnap.exists) {
      throw new HttpsError('failed-precondition', 'Profile not found.');
    }
    if (existingFriendSnap.exists) {
      throw new HttpsError('already-exists', 'You are already friends.');
    }

    const selfData = selfSnap.data() as { name: string; username: string };
    const targetData = targetSnap.data() as { name: string; username: string };
    const now = new Date().toISOString();

    tx.set(selfFriendRef, {
      uid: targetUid,
      name: targetData.name,
      username: targetData.username,
      since: now,
    });
    tx.set(targetFriendRef, {
      uid,
      name: selfData.name,
      username: selfData.username,
      since: now,
    });
    tx.update(selfRef, { friendCount: FieldValue.increment(1) });
    tx.update(targetRef, { friendCount: FieldValue.increment(1) });

    return { uid: targetUid, name: targetData.name, username: targetData.username };
  });

  return result;
});

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
    deleteCollection(db.collection('workoutLogs').doc(uid).collection('logs')),
    deleteCollection(db.collection('userWorkouts').doc(uid).collection('customWorkouts')),
    deleteCollection(db.collection('friendships').doc(uid).collection('friends')),
    deleteCollection(db.collection('activityFeed').doc(uid).collection('items')),
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
    throw new HttpsError('internal', `Could not send verification email: ${error.message}`);
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

export const exchangeWhoopCode = onCall(
  { secrets: [WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, REVENUECAT_SECRET_KEY] },
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
export const syncWhoopData = onCall(
  { secrets: [WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, REVENUECAT_SECRET_KEY] },
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

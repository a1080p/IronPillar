import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

const XP_PER_EXERCISE = 50;
const XP_PER_SET = 5;
const XP_PER_STREAK_DAY = 20;
const STREAK_MILESTONE_INTERVAL = 5;

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

interface CompleteWorkoutRequest {
  workout: {
    id: string;
    name: string;
    category: 'preset' | 'quick_start' | 'custom';
  };
  exercises: ExerciseLog[];
  durationSeconds: number;
}

function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function yesterdayDateString(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return todayDateString(d);
}

function isValidCompleteWorkoutRequest(data: unknown): data is CompleteWorkoutRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!d.workout || typeof d.workout !== 'object') return false;
  const w = d.workout as Record<string, unknown>;
  if (typeof w.id !== 'string' || typeof w.name !== 'string' || typeof w.category !== 'string') {
    return false;
  }
  if (!Array.isArray(d.exercises) || d.exercises.length === 0) return false;
  if (typeof d.durationSeconds !== 'number' || d.durationSeconds < 0) return false;
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
export const completeWorkout = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to complete a workout.');
  }
  if (!isValidCompleteWorkoutRequest(request.data)) {
    throw new HttpsError('invalid-argument', 'Malformed workout completion payload.');
  }
  const { workout, exercises, durationSeconds } = request.data;

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
    };

    const today = todayDateString();
    const yesterday = yesterdayDateString();
    const alreadyLoggedToday = profile.lastWorkoutDate === today;

    let streakCountAfter: number;
    if (alreadyLoggedToday) {
      streakCountAfter = profile.streakCount;
    } else if (profile.lastWorkoutDate === yesterday) {
      streakCountAfter = profile.streakCount + 1;
    } else {
      streakCountAfter = 1;
    }

    const streakBonus = alreadyLoggedToday ? 0 : streakCountAfter * XP_PER_STREAK_DAY;
    const setCount = exercises.reduce((sum, e) => sum + (e.sets?.length ?? 0), 0);
    const xpEarned = exercises.length * XP_PER_EXERCISE + setCount * XP_PER_SET + streakBonus;

    const isFirstWorkout = profile.lastWorkoutDate === null;
    const badgeEarnedId = isFirstWorkout ? 'the-journey-begins' : null;
    const hitStreakMilestone =
      !alreadyLoggedToday && streakCountAfter > 0 && streakCountAfter % STREAK_MILESTONE_INTERVAL === 0;

    tx.set(logRef, {
      id: logRef.id,
      workoutId: workout.id,
      workoutName: workout.name,
      workoutSource: workout.category,
      completedAt: new Date().toISOString(),
      durationSeconds,
      exercises,
      xpEarned,
      streakBonusEarned: streakBonus,
      streakCountAfter,
    });

    tx.update(userRef, {
      xp: FieldValue.increment(xpEarned),
      streakCount: streakCountAfter,
      lastWorkoutDate: today,
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

    return { xpEarned, streakBonus, streakCountAfter, badgeEarnedId };
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

// Deletes a user's account: their profile, everything nested under it,
// their workout history, custom workouts, their own friendships, their
// username claim, and the Auth account itself — plus removes them from
// each friend's friend list (a plain client write can't touch another
// user's data, so this has to run with Admin SDK privileges like addFriend).
// Note: activity feed items this user posted into *other* users' feeds are
// left as historical record, same as most social apps leave old posts after
// a deactivation.
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
  ]);

  await getAuth().deleteUser(uid);

  return { success: true };
});

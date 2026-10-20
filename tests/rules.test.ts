// Security-rules tests for firestore.rules and storage.rules, run against
// the Firebase emulators:
//
//   npm run test:rules
//
// (needs Java 21+ on PATH for the emulators).

import { readFileSync } from 'fs';
import { join } from 'path';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-iron-pillar',
    firestore: { rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(join(__dirname, '..', 'storage.rules'), 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

// IP-64: check-in photos are visible only to the owner and accepted friends.
describe('checkins/{uid}/{fileName}', () => {
  const path = 'checkins/alice/123-abc.jpg';

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), jpeg, { contentType: 'image/jpeg' });
      await setDoc(doc(ctx.firestore(), 'friendships/alice/friends/bob'), { since: 'x' });
      await setDoc(doc(ctx.firestore(), 'friendships/bob/friends/alice'), { since: 'x' });
    });
  });

  test('owner can read', async () => {
    await assertSucceeds(getBytes(ref(env.authenticatedContext('alice').storage(), path)));
  });

  test('accepted friend can read', async () => {
    await assertSucceeds(getBytes(ref(env.authenticatedContext('bob').storage(), path)));
  });

  test('signed-in non-friend cannot read', async () => {
    await assertFails(getBytes(ref(env.authenticatedContext('mallory').storage(), path)));
  });

  test('friendship only in the reader’s own list does not count', async () => {
    // mallory lists alice as a friend, but alice's list doesn't include mallory.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'friendships/mallory/friends/alice'), { since: 'x' });
    });
    await assertFails(getBytes(ref(env.authenticatedContext('mallory').storage(), path)));
  });

  test('signed-out cannot read', async () => {
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  });

  test('owner can upload; others cannot upload into the owner’s folder', async () => {
    const name = 'checkins/alice/456-def.jpg';
    await assertSucceeds(
      uploadBytes(ref(env.authenticatedContext('alice').storage(), name), jpeg, { contentType: 'image/jpeg' })
    );
    await assertFails(
      uploadBytes(ref(env.authenticatedContext('bob').storage(), name), jpeg, { contentType: 'image/jpeg' })
    );
  });
});

// IP-61: usernames/{username} can only be claimed by an account that has no
// profile yet (signup); later changes go through changeUsername.
describe('usernames/{username}', () => {
  test('signup transaction (profile + username together) still succeeds', async () => {
    const db = env.authenticatedContext('newbie').firestore();
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const candidate = doc(db, 'usernames', 'newbie');
        await tx.get(candidate);
        tx.set(doc(db, 'users', 'newbie'), {
          uid: 'newbie',
          username: 'newbie',
          name: 'New',
          level: 1,
          xp: 0,
          streakCount: 0,
          lastWorkoutDate: null,
          friendCount: 0,
          weeklyGoal: 3,
          createdAt: new Date().toISOString(),
        });
        tx.set(candidate, { uid: 'newbie' });
      })
    );
    await assertSucceeds(getDoc(doc(db, 'usernames', 'newbie')));
  });

  test('existing user cannot squat another name', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), { uid: 'alice', username: 'alice' });
      await setDoc(doc(ctx.firestore(), 'usernames/alice'), { uid: 'alice' });
    });
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'usernames', 'coolname'), { uid: 'alice' }));
  });

  test('cannot claim a name for someone else', async () => {
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(setDoc(doc(db, 'usernames', 'victimname'), { uid: 'alice' }));
  });

  test('cannot add extra fields to a username doc', async () => {
    const db = env.authenticatedContext('newbie').firestore();
    await assertFails(setDoc(doc(db, 'usernames', 'newbie'), { uid: 'newbie', extra: true }));
  });

  test('cannot update or delete a claimed name', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usernames/alice'), { uid: 'alice' });
    });
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'usernames', 'alice'), { uid: 'alice' }));
  });
});

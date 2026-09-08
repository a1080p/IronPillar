// One-off admin script to (re)seed the `workoutTemplates` collection.
// Requires a Firebase service account key — see README "Seeding workout data".
//
// Usage: npx tsx scripts/seed-workouts.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { workoutTemplates } from '../data/workoutTemplates';

const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

if (!existsSync(keyPath)) {
  console.error(
    'Missing serviceAccountKey.json at project root.\n' +
      'Firebase Console → Project Settings → Service Accounts → Generate new private key,\n' +
      'save the downloaded file as serviceAccountKey.json in the project root (it is gitignored).'
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function seed() {
  const batch = db.batch();
  for (const template of workoutTemplates) {
    const ref = db.collection('workoutTemplates').doc(template.id);
    batch.set(ref, template);
  }
  await batch.commit();
  console.log(`Seeded ${workoutTemplates.length} workout templates.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

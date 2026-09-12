// One-off admin script to publish firestore.rules + storage.rules via the
// Admin SDK, bypassing the Firebase CLI (whose pre-deploy check needs broader
// IAM permissions than the default Admin SDK service account has).
//
// Usage: npx tsx scripts/deploy-rules.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const firestoreRulesPath = join(__dirname, '..', 'firestore.rules');
const storageRulesPath = join(__dirname, '..', 'storage.rules');

if (!existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json at project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });

async function deploy() {
  const rules = getSecurityRules();

  const firestoreFile = rules.createRulesFileFromSource(
    'firestore.rules',
    readFileSync(firestoreRulesPath, 'utf8')
  );
  const firestoreRuleset = await rules.createRuleset(firestoreFile);
  await rules.releaseFirestoreRuleset(firestoreRuleset);
  console.log('Deployed firestore.rules ->', firestoreRuleset.name);

  const storageFile = rules.createRulesFileFromSource(
    'storage.rules',
    readFileSync(storageRulesPath, 'utf8')
  );
  const storageRuleset = await rules.createRuleset(storageFile);
  await rules.releaseStorageRuleset(storageRuleset);
  console.log('Deployed storage.rules ->', storageRuleset.name);
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});

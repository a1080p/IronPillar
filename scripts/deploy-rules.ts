// One-off admin script to publish firestore.rules via the Admin SDK,
// bypassing the Firebase CLI (whose pre-deploy check needs broader IAM
// permissions than the default Admin SDK service account has).
//
// Usage: npx tsx scripts/deploy-rules.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const rulesPath = join(__dirname, '..', 'firestore.rules');

if (!existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json at project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const rulesSource = readFileSync(rulesPath, 'utf8');

initializeApp({ credential: cert(serviceAccount) });

async function deploy() {
  const rules = getSecurityRules();
  const file = rules.createRulesFileFromSource('firestore.rules', rulesSource);
  const ruleset = await rules.createRuleset(file);
  await rules.releaseFirestoreRuleset(ruleset);
  console.log('Deployed firestore.rules ->', ruleset.name);
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});

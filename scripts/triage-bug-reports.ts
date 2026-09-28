// Data-access CLI for the bug-triage pipeline (IP-33). Firestore's
// `bugReports` collection is create-only from the client (see firestore.rules)
// — nothing in the app can read, validate, or update a report's status. This
// script is the Admin SDK side of that: a scheduled Claude session runs
// `list` to see what's new, uses its own judgment (+ the Jira MCP tools) to
// decide what's a real bug worth a ticket, then calls `mark-ticketed` /
// `mark-dismissed` to record the outcome. The actual triage judgment and
// Jira-ticket creation intentionally live in the agent prompt, not in this
// script — this is just plumbing.
//
// Usage:
//   npx tsx scripts/triage-bug-reports.ts list
//   npx tsx scripts/triage-bug-reports.ts mark-ticketed <reportId> <JIRA-KEY>
//   npx tsx scripts/triage-bug-reports.ts mark-dismissed <reportId> [reason]
//   npx tsx scripts/triage-bug-reports.ts mark-fixed <reportId>

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { BugReport } from '../types/models';

const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
if (!existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json at project root.');
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const bugReports = db.collection('bugReports');

async function list() {
  // A single equality where() needs no composite index, unlike where()+
  // orderBy() on different fields — sorting client-side instead avoids
  // requiring a one-time index creation step before this script works.
  const snap = await bugReports.where('status', '==', 'new').get();
  if (snap.empty) {
    console.log('No new bug reports.');
    return;
  }
  const docs = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<BugReport, 'id'>) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const doc of docs) {
    console.log(JSON.stringify(doc, null, 2));
  }
}

async function markTriaged(id: string, jiraKey: string) {
  if (!id || !jiraKey) {
    console.error('Usage: mark-ticketed <reportId> <JIRA-KEY>');
    process.exit(1);
  }
  await bugReports.doc(id).update({ status: 'ticketed', jiraKey });
  console.log(`Marked ${id} as ticketed (${jiraKey}).`);
}

async function markDismissed(id: string, reason?: string) {
  if (!id) {
    console.error('Usage: mark-dismissed <reportId> [reason]');
    process.exit(1);
  }
  await bugReports.doc(id).update({
    status: 'dismissed',
    ...(reason ? { dismissedReason: reason } : {}),
  });
  console.log(`Marked ${id} as dismissed.`);
}

async function markFixed(id: string) {
  if (!id) {
    console.error('Usage: mark-fixed <reportId>');
    process.exit(1);
  }
  await bugReports.doc(id).update({ status: 'fixed' });
  console.log(`Marked ${id} as fixed.`);
}

const [, , command, ...args] = process.argv;

const commands: Record<string, () => Promise<void>> = {
  list,
  'mark-ticketed': () => markTriaged(args[0], args[1]),
  'mark-dismissed': () => markDismissed(args[0], args[1]),
  'mark-fixed': () => markFixed(args[0]),
};

const run = commands[command];
if (!run) {
  console.error(`Unknown command: ${command}\nKnown commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

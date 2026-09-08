# Iron Pillar — Progress Log

Running log of what's been built, changed, and verified. Newest entries at the top. See also the [IP Jira board](https://studiogreatt.atlassian.net/browse/IP) and the build plan at `/Users/aidan/.claude/plans/lexical-inventing-wolf.md`.

---

## 2026-09-08 — Spacing polish + Delete Account moved into Account Details

- Removed the baked-in margins from the shared `TextField` and `SelectableOption` components (they were double-stacking with any parent that also tried to control spacing) and switched every touched screen (Settings, Account Details, History, welcome/onboarding) to explicit `gap` on the containing view instead — one consistent value between major blocks, a tighter consistent value inside grouped lists. Cleaned up several manual `<View style={{height: ...}}>` spacer hacks on the welcome screen along the way.
- Moved Delete Account out of Settings into a bordered red "Danger Zone" section at the bottom of Account Details.
- Added a real confirmation flow: expanding the section shows warning copy and a field that requires typing the exact username before the Delete button enables; pressing it still shows one more native "Are you sure?" alert before `deleteAccount` actually runs.
- **Verified live**: confirmed the new spacing looks even on Account Details, confirmed the Danger Zone panel expands/collapses and the Delete button is correctly disabled until the username matches. Did not run an actual deletion (same reasoning as before — don't want to destroy the test account's history).

## 2026-09-03 — Settings, History, Account Details (last piece of the original plan)

- History: lists every completed workout from `workoutLogs` (name, date, duration, xp, streak bonus), newest first.
- Account Details: view/edit name, birthday, goals, experience level (email + username shown read-only, username is immutable by design). Added `updateProfile` to AuthContext.
- Settings: links to Account Details/History, Sign Out, and Delete Account.
- New `deleteAccount` Cloud Function — deleting your own account needs to clean up data across many collections *and* remove you from friends' friend lists (which a plain client write can't do to someone else's data), so it runs the same way `addFriend` does: profile, badges, metrics, workout logs, custom workouts, both sides of every friendship (with friendCount decremented), activity feed items, and the username claim are all removed, then the Firebase Auth account itself is deleted.
- Extracted `GOAL_OPTIONS`/`EXPERIENCE_OPTIONS` into `constants/options.ts` (previously duplicated inline in the two onboarding screens) since Account Details needed the same lists.
- **Verified live**: History and Account Details both render correctly against the real account (4 logged workouts with correct math, profile fields pre-filled and matching); Settings screen confirmed visually. Did not run the actual account-deletion flow against the ongoing test account (would destroy the test history built up over this project) — confirmed via a clean deploy and type-check instead.
- This closes out the last item from the original build plan — all 10 steps done.

## 2026-09-02 — Custom workout builder

- New "Create Your Own Workout" screen (`app/workout/new.tsx`): name the workout, add exercises one at a time (Reps & Weight or Timed, set count, target label), remove any before saving. Saves to `userWorkouts/{uid}/customWorkouts`.
- New "My Workouts" section on Home, alongside presets and Quick Start, plus a "Create Your Own" card that opens the builder.
- Generalized workout lookup (`hooks/useWorkout.ts`) so the existing detail/log/completion screens work for custom workouts too, without a separate code path — merges `workoutTemplates` and the user's own `customWorkouts` by id.
- Also set up ongoing process going forward: this file, plus keeping the [IP Jira board](https://studiogreatt.atlassian.net/browse/IP) current as work happens (tickets created/moved/commented per feature). Backfilled today: closed out IP-3 (account creation) and IP-4 (Social tab), added a progress note to IP-2 (backend), created and closed IP-7 (this custom workout builder).
- **Verified live**: built a real workout ("Snack Day" — one timed exercise, one reps & weight exercise) through the actual UI, saved it, opened it from Home, and completed it through the full flow. XP came out exactly right (130 = 2 exercises×50 + 6 sets×5), and the streak logic correctly gave no duplicate bonus for a second workout on the same day.

## 2026-09-02 — Social tab (friends + activity feed)

- Added a `username` field to every profile (auto-generated from the email prefix at signup, uniqueness enforced via a `usernames/{username} -> uid` lookup collection).
- New `addFriend` Cloud Function: looks up a username, creates a mutual friendship (writes both sides + increments both `friendCount`s) — a single user's own permissions can't write to another user's friend list directly, so this runs server-side like the streak/XP work.
- `completeWorkout` extended to fan out activity feed items to friends: always on a completed workout, plus badge-earned and every-5th-day streak milestones.
- New Social tab UI: add-a-friend form, friend count, activity feed list.
- Firestore rules: `usernames/*` self-claimable once, `friendships/*` and `activityFeed/*` function-only, `friendCount` joined the locked gamification field set.
- **Verified live**: created a second test account, added it as a friend through the real app, completed a workout on the primary account, and confirmed in Firestore that the friend's activity feed received "Aidan completed Core Crusher!" and both `friendCount`s read 1. Also re-confirmed the streak day-boundary logic on a third calendar day (1 → 2).
- Backfilled `username` onto the original test profile (predates this feature).
- Jira: IP-3 (account creation) and IP-4 (Social tab) moved to Done; IP-2 (backend) updated with a progress comment; IP-7 (Custom Workout Builder) created and moved to In Progress.

## 2026-09-01 — Server-side streak/XP/badges (Cloud Functions)

- Added `functions/` (Cloud Functions v2, TypeScript): `completeWorkout` callable now does all the streak/XP/badge math using the *server's* clock, not anything the client reports.
- `firestore.rules` locked down: `xp`, `streakCount`, `level`, `lastWorkoutDate` on a profile can no longer be changed by a direct client write, only by the Cloud Function. Workout logs and badges are now fully read-only from the client.
- Client (`lib/workoutCompletion.ts`) is now a thin wrapper calling the Cloud Function and using its returned result directly.
- Required upgrading the Firebase project to the Blaze (pay-as-you-go) plan — Cloud Functions don't run on the free tier at all.
- **Verified live**: confirmed a direct API spoof attempt on `xp` was denied (403) after the rules deployed, then logged a real workout days after the previous one and confirmed the streak correctly *reset* to 1 (a case not exercised before) with exact XP math.

## 2026-08-26 — Profile and Analytics tabs

- Profile tab: avatar, name/handle, level/XP progress bar, stats row (streak, workouts, xp, friends), earned-badges "Collection" grid.
- Analytics tab: BMI and body-fat line charts (hand-rolled on `react-native-svg`, avoided pulling in a heavier charting library), an add-entry form writing to `users/{uid}/metrics`, and a live "total workouts completed" count.
- Hardened a bug class: Firestore listeners with no error handler could get stuck on "Loading..." forever if a permission error hit (this is what caused the workoutTemplates incident below) — added error handlers across all data hooks so a denied/broken listener now shows an empty state instead of hanging.
- **Verified live**: both tabs render correctly with real data; tested a full add-entry round trip (BMI 24.1 / body fat 18.5%) and watched the chart update immediately.

## 2026-08-25 — Core loop: workout data, logging, completion (plan steps 1–4)

- Scaffolded the Expo Router + TypeScript app at `/Users/aidan/Projects/iron-pillar`.
- Firebase project `iron-piller` set up: Auth (email/password), Firestore, security rules (initially just user-owns-their-own-profile).
- Welcome screen + 3-step onboarding (name/birthday, goals, experience) writing the initial profile.
- Tab shell (Home / Analytics / Social / Profile) with a shared top bar (streak flame + hamburger drawer).
- Seeded 4 workout templates (Upper Body Strength Builder, Outdoor Walk, HIIT Fat Burner, Core Crusher) — the wireframes didn't include a "create your own workout" flow, which became IP-7.
- Full workout detail (Overview/Tips/Equipment tabs) → exercise logging (live timer, sets/reps/weight or duration, motivational messages) → completion screen (streak/XP/streak-bonus) → badge-unlock screen.
- Fixed a real bug found via this work: Firestore rules were only ever published once early on and I kept editing the local file without redeploying, so `workoutTemplates` silently failed to load — fixed by writing an admin script (`npm run deploy:rules`) that publishes rules programmatically instead of relying on a manual console paste.
- **Verified live**: walked the entire golden path in the iOS Simulator (sign-up → onboarding → home → workout detail → full 7-exercise log → completion with correct XP math → "The Journey Begins" badge), then cross-checked every write against Firestore directly.

## Known gaps / not yet built

- No real exercise diagrams/icons — using emoji placeholders (Figma design assets not yet exported; see IP-5/IP-6).
- Cloud Functions runtime is Node 20, which Google deprecates 2026-10-30 — needs a runtime bump before then.
- The delete-account flow (`deleteAccount` Cloud Function) hasn't been live-tested end to end yet, only deployed + type-checked.
- No push notifications, no social login (Apple/Google/Facebook buttons on the welcome screen are present but non-functional placeholders), no dark mode.

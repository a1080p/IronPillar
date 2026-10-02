# Reply to App Review (Guideline 2.1 – Information Needed)

Paste the section below into the reply in App Store Connect, and paste it again
into App Review Information → Notes. Attach the screen recording to the reply.
Replace `[review account email]` / `[password]` with the demo account you added.

---

Hello App Review team, thank you for the review. Here is the information you requested.

**1. Screen recording**
Attached: a recording on a physical iPhone running the latest iOS. It starts at app launch and shows sign-up with email and the 6-digit verification code, onboarding, logging a workout, the post-workout summary and streak screen, an outdoor walk with the Lock Screen Live Activity, the Social tab with a friend's profile and the Report, Block and Remove Friend controls, subscribing to Iron Pillar Pro with a sandbox account and the Pro features it unlocks, Restore Purchases, signing out and back in, and deleting the account from Settings → Account Details → Delete Account.

**2. Purpose and audience**
Iron Pillar is a workout tracker for adults and teens (13+) who want to build a consistent exercise habit. It solves the problem of starting strong and then quitting: users follow or build workouts, log sets, reps, weight and time (or GPS-track walks, runs and rides), and earn XP, levels, streaks and badges that reward consistency and personal records. The value is a simple, motivating log of real training with clear progress over time.

**3. Setup and access**
- Demo account: `[review account email]` / `[password]` (email verification is already complete).
- Home → tap any workout → Get Started to log sets → Finish to see XP, the streak screen and any badges.
- Home → Walk / Run / Bike Ride starts GPS tracking (location permission is requested at that point; "Always" keeps tracking with the screen locked). Lock the phone to see the Live Activity.
- Pro: Settings → Upgrade to Pro, or the Insights tab. Purchase with a sandbox account. Pro unlocks the Insights tab (readiness score and strength analytics), Apple Health sync (Profile → Connected apps), CSV export (Settings), unlimited custom workouts, AI-filled details for custom workouts, and 2× XP. Restore Purchases is on the paywall.
- Social: Social tab → add a friend by username, view their profile, and Report, Block or Remove them from it. Blocked users are listed under Settings → Blocked Users.
- Account deletion: Settings → Account Details → Delete Account. It permanently deletes the account and all its data.
- Sign in with Apple and Google are also offered on the welcome screen.

**4. External services**
- Google Firebase: authentication, database (Cloud Firestore), photo storage, and server functions.
- RevenueCat: manages the Iron Pillar Pro auto-renewable subscription; payments are processed by Apple In-App Purchase.
- Resend: sends the email verification code and user reports to the developer.
- Anthropic (Claude): generates the overview, tips and equipment list for custom workouts created by Pro users. Only the workout name and exercise list are sent, no personal data.
- Apple HealthKit (optional, Pro): reads HRV, resting heart rate, sleep, steps, energy, weight and workouts to compute a readiness score, and writes completed workouts. Health data stays on the device and is never uploaded.
- Apple Maps (MapKit) shows outdoor routes; Sign in with Apple and Google Sign-In for login.

**5. Regional differences**
The app functions the same in all regions where it is available. Units (miles/pounds or kilometers/kilograms) follow the user's choice.

**6. Regulated industry / third-party material**
Iron Pillar is not in a regulated industry and is not a medical device. It does not provide medical advice (stated in the Terms of Use). All workout content, text and artwork are original to Iron Pillar.

**User-generated content (Guideline 1.2)**
The only user-generated content is names, usernames and profile photos, visible to friends a user has added. Names and usernames are checked against a blocked-word filter. Users can report and block from a friend's profile; reports are emailed to the developer and reviewed within 24 hours, and violating content or accounts are removed. Users must agree to the Terms of Use, which include zero-tolerance community rules, when they sign up. Contact: aidand510@gmail.com, also under Settings → Contact Support.

Thank you!

---

## Screen recording shot list (physical iPhone, latest iOS)

Settings → Control Center → add Screen Recording. Record in one take, about 3–5 minutes. Use a fresh test email for the sign-up part and delete that account at the end.

1. Start recording on the Home Screen, then tap Iron Pillar to launch it (the splash shows).
2. **Sign up:** Continue with Email → new email + password → enter the code from your inbox → onboarding (name, birthday, body, goals, avatar).
3. **Workout:** Home → a short workout → Get Started → log two sets → tap "Add notes for this exercise", type a note, save → Next Exercise … Finish → summary → Next → streak screen.
4. **Outdoor:** Home → Walk → Start → allow location → lock the phone briefly to show the Live Activity → unlock → Stop.
5. **Pro:** Settings → Upgrade to Pro → buy monthly with a sandbox account → open the Insights tab to show Pro content → back on the paywall, show Restore Purchases.
6. **Social:** Social tab → add a friend (use your second test account's username) → tap them → show Report (pick a reason, send) → show Block → Settings → Blocked Users → Unblock.
7. **Sign out and log in** with the account.
8. **Delete account:** Settings → Account Details → Delete Account → confirm → it returns to the welcome screen.

## Also check in App Store Connect before resubmitting
- Age Rating: answer the social media questions. Iron Pillar has a friends activity feed, so answer **Yes** to user-generated content / social features. The rating will probably move to 12+ or 13+.
- Version 1.0 → In-App Purchases and Subscriptions: both subscriptions are added.
- Build: select the new build.

export type FitnessGoal = 'lose_weight' | 'build_strength' | 'build_endurance';
export type ExperienceLevel = 'new' | 'some' | 'experienced';
export type Sex = 'male' | 'female';

export type UnitSystem = 'imperial' | 'metric';

export interface UserProfile {
  uid: string;
  username: string;
  name: string;
  avatarUrl?: string | null; // uploaded profile photo (Firebase Storage download URL)
  avatarKey?: string | null; // key of a built-in preset avatar (see constants/avatars)
  birthday: string; // MM-DD-YYYY
  goals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
  sex: Sex;
  heightInches: number; // total height in inches
  startingWeightLb: number; // weight captured at onboarding
  units?: UnitSystem; // display units; data is always stored in meters + lb. Default imperial.
  level: number;
  xp: number;
  streakCount: number;
  longestStreak?: number; // best streak ever; server-written (absent on older profiles)
  lastWorkoutDate: string | null; // last day that counted toward the streak (30+ min) // ISO date (yyyy-mm-dd), local to timeZone
  // Written only by the completeWorkout Cloud Function: the IANA zone streak
  // days are counted in, and when it last changed (changes are rate-limited).
  // Absent on older profiles, whose lastWorkoutDate is a UTC date.
  timeZone?: string;
  timeZoneUpdatedAt?: string;
  friendCount: number;
  createdAt: string;
}

export interface Friend {
  uid: string;
  name: string;
  username: string;
  since: string; // ISO timestamp
}

export interface ExerciseSpec {
  id: string;
  name: string;
  logType: 'reps_weight' | 'duration';
  tracksWeight?: boolean; // for reps_weight exercises with no external load (e.g. bodyweight); default true
  targetSets: number;
  targetRepsLabel: string; // e.g. "8-10 reps", or "45 sec" for duration exercises
  tips?: string;
  imageUrl?: string;
}

export interface InfoSection {
  heading: string;
  bullets: string[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesRangeLabel: string; // e.g. "320-450 Calories"
  equipmentRequired: boolean;
  category: 'preset' | 'quick_start' | 'browse';
  browseCategory?: string; // section label for the Browse tab, e.g. "Yoga" (only set when category is 'browse')
  tags: FitnessGoal[];
  overview?: string; // short prose summary shown on the Overview tab
  workoutTips: InfoSection[];
  equipment: InfoSection[];
  exercises: ExerciseSpec[];
  imageUrl?: string;
}

export interface CustomWorkout extends Omit<WorkoutTemplate, 'category'> {
  category: 'custom';
  createdBy: string;
  detailsGenerated?: boolean; // true once AI has filled in overview/tips/equipment/etc.
}

// Shape returned by the generateWorkoutDetails Cloud Function.
export interface GeneratedWorkoutDetails {
  durationMinutes: number;
  caloriesRangeLabel: string;
  equipmentRequired: boolean;
  overview: string;
  workoutTips: InfoSection[];
  equipment: InfoSection[];
  exerciseTips: { name: string; tips: string }[];
}

export interface LoggedSet {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  logType: 'reps_weight' | 'duration';
  sets: LoggedSet[];
}

export type OutdoorActivityType = 'walk' | 'run' | 'bike';

export interface RoutePoint {
  lat: number;
  lng: number;
  t: number; // ms since epoch
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  workoutSource: 'preset' | 'quick_start' | 'browse' | 'custom' | 'outdoor';
  completedAt: string; // ISO timestamp
  durationSeconds: number;
  exercises: ExerciseLog[]; // empty for outdoor activities — see activityType below
  xpEarned: number;
  xpMultiplier?: number; // 2 when earned as a Pro subscriber
  streakBonusEarned: number;
  streakCountAfter: number;
  // Present only when workoutSource is 'outdoor' (GPS-tracked walk/run/bike).
  activityType?: OutdoorActivityType;
  distanceMeters?: number;
  route?: RoutePoint[];
}

export type BadgeCategory =
  | 'workouts'
  | 'streaks'
  | 'levels'
  | 'records'
  | 'strength'
  | 'distance'
  | 'time'
  | 'habits';

// What a badge counts. Same names as the rules in functions/src/achievements.ts.
export type BadgeMetric =
  | 'workouts'
  | 'streak'
  | 'level'
  | 'prs'
  | 'volumeLb'
  | 'distanceMeters'
  | 'singleDistanceMeters'
  | 'seconds'
  | 'singleSeconds'
  | 'early'
  | 'late'
  | 'variety';

// A person's current value for each badge metric. A missing value means it
// isn't known (e.g. no lifetime totals recorded yet).
export type AchievementStats = Partial<Record<BadgeMetric, number>>;

// What a friend can see of someone's profile (from getFriendProfile).
export interface FriendProfile {
  uid: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  avatarKey: string | null;
  xp: number;
  streakCount: number;
  friendCount: number;
  badges: { badgeId: string; earnedAt: string | null }[];
  stats: AchievementStats;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconKey: string; // an Ionicons glyph name
  category: BadgeCategory;
  tier: BadgeTier;
  metric: BadgeMetric; // what it counts
  threshold: number; // value of `metric` that unlocks it
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
}

export interface ProgressMetric {
  id: string;
  recordedAt: string; // ISO timestamp
  weightLb: number;
}

export interface ActivityFeedItem {
  id: string;
  type:
    | 'badge_earned'
    | 'streak_milestone'
    | 'friend_workout'
    | 'reaction'
    | 'check_in'
    | 'comment'
    | 'friend_request_accepted';
  actorUid: string;
  actorName: string;
  message: string;
  subject?: string; // e.g. "Core Crusher" or "the Journey Begins badge"
  myReactions?: { heart?: boolean; congrats?: boolean }; // reactions you've sent
  postId?: string; // the post this item is a copy of (workouts, check-ins), for comments
  photoUrl?: string; // check-in photo
  caption?: string; // check-in caption
  createdAt: string;
}

// A workout or check-in photo friends can comment on (posts/{id}).
export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  type: 'friend_workout' | 'check_in';
  message: string;
  subject?: string;
  caption?: string;
  photoUrl?: string;
  commentCount: number;
  createdAt: string;
}

export interface PostComment {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface FriendRequest {
  uid: string;
  name: string;
  username: string;
  createdAt: string;
}

export type BugReportCategory = 'bug' | 'crash' | 'confusing_ui' | 'feature_idea' | 'other';
export type BugReportStatus = 'new' | 'triaged' | 'ticketed' | 'fixed' | 'dismissed';

// In-app bug/feedback report, filed from the floating report button on any
// screen. Read/triaged server-side only (see firestore.rules) — a Claude Code
// job reviews `status: 'new'` reports, files a Jira ticket, and updates
// status/jiraKey as it works the fix.
export interface BugReport {
  id: string;
  uid: string;
  screen: string; // route pathname the report was filed from, e.g. "/workout/abc123"
  category: BugReportCategory;
  description: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  status: BugReportStatus;
  jiraKey?: string;
  createdAt: string; // ISO timestamp
}

export type WearableProvider = 'whoop';

// Non-sensitive connection status + latest synced metrics for a wearable
// integration — safe for the client to read directly (see firestore.rules).
// The actual OAuth access/refresh tokens live in a separate, fully
// server-only `wearableTokens/{uid}` doc that this type never represents.
export interface WearableSnapshot {
  provider: WearableProvider;
  connected: boolean;
  connectedAt?: string; // ISO timestamp
  lastSyncedAt?: string; // ISO timestamp
  recoveryScore?: number; // 0-100
  hrvMs?: number;
  restingHeartRateBpm?: number;
  sleepPerformancePct?: number; // 0-100
  dayStrain?: number; // WHOOP's 0-21 strain scale
}

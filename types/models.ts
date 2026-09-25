export type FitnessGoal = 'lose_weight' | 'build_strength' | 'build_endurance';
export type ExperienceLevel = 'new' | 'some' | 'experienced';
export type Sex = 'male' | 'female';

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
  level: number;
  xp: number;
  streakCount: number;
  lastWorkoutDate: string | null; // ISO date (yyyy-mm-dd)
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
  streakBonusEarned: number;
  streakCountAfter: number;
  // Present only when workoutSource is 'outdoor' (GPS-tracked walk/run/bike).
  activityType?: OutdoorActivityType;
  distanceMeters?: number;
  route?: RoutePoint[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconKey: string;
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
  type: 'badge_earned' | 'streak_milestone' | 'friend_workout';
  actorUid: string;
  actorName: string;
  message: string;
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

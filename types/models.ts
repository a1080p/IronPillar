export type FitnessGoal = 'lose_weight' | 'build_strength' | 'build_endurance';
export type ExperienceLevel = 'new' | 'some' | 'experienced';

export interface UserProfile {
  uid: string;
  username: string;
  name: string;
  birthday: string; // MM-DD-YYYY
  goals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
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
  category: 'preset' | 'quick_start';
  tags: FitnessGoal[];
  workoutTips: InfoSection[];
  equipment: InfoSection[];
  exercises: ExerciseSpec[];
  imageUrl?: string;
}

export interface CustomWorkout extends Omit<WorkoutTemplate, 'category'> {
  category: 'custom';
  createdBy: string;
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

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  workoutSource: 'preset' | 'quick_start' | 'custom';
  completedAt: string; // ISO timestamp
  durationSeconds: number;
  exercises: ExerciseLog[];
  xpEarned: number;
  streakBonusEarned: number;
  streakCountAfter: number;
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
  bmi: number;
  bodyFatPercent: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'badge_earned' | 'streak_milestone' | 'friend_workout';
  actorUid: string;
  actorName: string;
  message: string;
  createdAt: string;
}

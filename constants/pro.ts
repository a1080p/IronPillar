import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface PlanFeature {
  icon: IconName;
  title: string;
  description: string;
}

export const FREE_CUSTOM_WORKOUT_LIMIT = 5;

// Everything Iron Pillar Pro unlocks. Shared by the paywall and mirrored in
// the website copy (website/index.html) — keep the two in sync.
export const PRO_FEATURES: PlanFeature[] = [
  {
    icon: 'pulse',
    title: 'Daily readiness score',
    description:
      'A 0–100 score from your HRV, resting heart rate, sleep, and training load, with a clear call on whether to push or back off.',
  },
  {
    icon: 'watch',
    title: 'Apple Health & Apple Watch',
    description:
      'Workouts save to Apple Health and count toward your rings. Watch HRV, sleep, and workouts feed your readiness score.',
  },
  {
    icon: 'fitness',
    title: 'WHOOP sync',
    description: 'Pull in recovery, HRV, sleep performance, and strain from your WHOOP.',
  },
  {
    icon: 'trending-up',
    title: 'Advanced strength analytics',
    description: 'Per-exercise 1RM trends, next-session weight and rep targets, and plateau alerts.',
  },
  {
    icon: 'sparkles',
    title: 'AI workout details',
    description:
      'Build a custom workout and AI writes the overview, coaching tips, equipment list, and calorie estimate.',
  },
  {
    icon: 'infinite',
    title: 'Unlimited custom workouts',
    description: `Free accounts can save up to ${FREE_CUSTOM_WORKOUT_LIMIT}. Pro removes the cap.`,
  },
  {
    icon: 'download',
    title: 'Data export',
    description: 'Export every set you have ever logged to a CSV spreadsheet.',
  },
];

// What stays free, listed on the paywall so it's clear nobody loses the core
// app by not subscribing.
export const FREE_FEATURES = [
  'Unlimited workout logging, streaks, XP, and badges',
  'Rest timer and "last time" numbers while you lift',
  'Consistency calendar, weekly stats, and personal records',
  'GPS walks, runs, and rides',
  'Friends and activity feed',
];

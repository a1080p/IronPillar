// Lock-screen / Dynamic Island Live Activity for a workout in progress
// (iOS 16.1+). Every call here is safe to make anywhere: on Android, in Expo
// Go, or on a build made before expo-widgets was added, the native module is
// missing and these all quietly do nothing.
import { Platform } from 'react-native';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';
import type { WorkoutActivityProps } from '../widgets/WorkoutActivity';

export type { WorkoutActivityProps };

let factory: LiveActivityFactory<WorkoutActivityProps> | null | undefined;

function getFactory() {
  if (factory !== undefined) return factory;
  factory = null;
  if (Platform.OS === 'ios') {
    try {
      // Required lazily: importing it at module load would throw on builds
      // without the native module.
      factory = require('../widgets/WorkoutActivity').default as LiveActivityFactory<WorkoutActivityProps>;
    } catch {
      factory = null;
    }
  }
  return factory;
}

function instances(): LiveActivity<WorkoutActivityProps>[] {
  try {
    return getFactory()?.getInstances() ?? [];
  } catch {
    return [];
  }
}

// Starts the activity, replacing any left over from an earlier workout.
export function startWorkoutActivity(props: WorkoutActivityProps) {
  try {
    const f = getFactory();
    if (!f) return;
    for (const existing of f.getInstances()) existing.end('immediate').catch(() => {});
    f.start(props);
  } catch {
    // Live Activities are switched off in Settings, or unsupported.
  }
}

// Updates whichever activity is running. Reads the running instance from the
// system each time, so it also works from a background task after the app
// process was relaunched.
export function updateWorkoutActivity(props: WorkoutActivityProps) {
  for (const activity of instances()) activity.update(props).catch(() => {});
}

export function endWorkoutActivity() {
  for (const activity of instances()) activity.end('immediate').catch(() => {});
}

export function hasWorkoutActivity() {
  return instances().length > 0;
}

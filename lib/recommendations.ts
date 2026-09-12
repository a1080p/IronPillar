// Lightweight, on-device "taste model" for the home screen's Recommended
// Workout card. There's no separate memory store — a user's workoutLogs
// (already persisted for History/streaks) *is* the memory. Because
// useWorkoutLogs/useWorkoutTemplates are live Firestore listeners, recomputing
// this from `logs` on every render means the recommendation updates the
// instant a workout is completed, with no extra plumbing.
import { BROWSE_CATEGORIES } from '../data/browseWorkoutTemplates';
import type { FitnessGoal, WorkoutLog, WorkoutTemplate } from '../types/models';

type PreferenceKey = FitnessGoal | (typeof BROWSE_CATEGORIES)[number];

const ALL_GOALS: FitnessGoal[] = ['lose_weight', 'build_strength', 'build_endurance'];
const ALL_KEYS: PreferenceKey[] = [...ALL_GOALS, ...BROWSE_CATEGORIES];

// Baseline weight every key gets regardless of history, so categories the
// user has never tried still have a real (if small) chance of surfacing —
// this is what lets recommendations "branch out" over time instead of
// narrowing forever onto whatever was done first.
const EXPLORE_EPSILON = 0.6;

// Half-life-ish decay: a workout done today counts fully, one from ~3 weeks
// ago counts for about a third as much. Taste drifts as habits change
// instead of being locked in by whatever was done once, long ago.
const AFFINITY_DECAY_DAYS = 21;

// Don't re-recommend something just finished today/yesterday even if it's
// still the user's strongest affinity match.
const RECENTLY_DONE_COOLDOWN_MS = 20 * 60 * 60 * 1000;

function templateKeys(template: WorkoutTemplate): PreferenceKey[] {
  const keys: PreferenceKey[] = [...template.tags];
  if (template.browseCategory) keys.push(template.browseCategory as PreferenceKey);
  return keys;
}

function computeAffinity(
  logs: WorkoutLog[],
  templatesById: Map<string, WorkoutTemplate>
): Map<PreferenceKey, number> {
  const affinity = new Map<PreferenceKey, number>();
  const now = Date.now();
  for (const log of logs) {
    const template = templatesById.get(log.workoutId);
    if (!template) continue;
    const daysAgo = (now - new Date(log.completedAt).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-daysAgo / AFFINITY_DECAY_DAYS);
    for (const key of templateKeys(template)) {
      affinity.set(key, (affinity.get(key) ?? 0) + weight);
    }
  }
  return affinity;
}

// Deterministic per user per day (so the pick doesn't flicker on every
// re-render) but shifts the moment new history changes the odds, and again
// the next calendar day.
function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickRecommendedWorkout(
  templates: WorkoutTemplate[],
  logs: WorkoutLog[],
  profileGoals: FitnessGoal[] | undefined,
  uid: string | undefined
): WorkoutTemplate | undefined {
  // `templates` here is only presets/quick-starts/browse (custom workouts are
  // a separate type, already front-and-center under "My Workouts").
  const discoverable = templates;
  if (discoverable.length === 0) return undefined;

  if (logs.length === 0) {
    // Cold start: no history yet, so lean on the goals picked at onboarding.
    return (
      discoverable.find((t) => profileGoals?.some((g) => t.tags.includes(g))) ?? discoverable[0]
    );
  }

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const affinity = computeAffinity(logs, templatesById);

  const todaySeed = hashSeed(`${uid ?? 'anon'}-${new Date().toISOString().slice(0, 10)}`);
  const rand = mulberry32(todaySeed);

  const keyWeights = ALL_KEYS.map((k) => (affinity.get(k) ?? 0) + EXPLORE_EPSILON);
  const chosenKey = weightedPick(ALL_KEYS, keyWeights, rand);

  const recentlyDoneIds = new Set(
    logs
      .filter((l) => Date.now() - new Date(l.completedAt).getTime() < RECENTLY_DONE_COOLDOWN_MS)
      .map((l) => l.workoutId)
  );

  const matching = discoverable.filter((t) => templateKeys(t).includes(chosenKey));
  const pool = matching.filter((t) => !recentlyDoneIds.has(t.id));
  const candidates = pool.length > 0 ? pool : matching.length > 0 ? matching : discoverable;

  // Within the chosen category, prefer whichever workout best matches the
  // user's overall affinities (not just the one key branched into) so the
  // pick still feels coherent with everything else they tend to do.
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const template of candidates) {
    const score =
      templateKeys(template).reduce((sum, k) => sum + (affinity.get(k) ?? 0), 0) + rand() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return best;
}

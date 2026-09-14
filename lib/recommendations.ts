// Lightweight, on-device "taste model" for the home screen's Recommended
// Workout card and the rotating Quick Start row. There's no separate memory
// store — a user's workoutLogs (already persisted for History/streaks) *is*
// the memory. Because useWorkoutLogs/useWorkoutTemplates are live Firestore
// listeners, recomputing this from `logs` on every render means picks update
// the instant a workout is completed, with no extra plumbing.
import { BROWSE_CATEGORIES } from '../data/browseWorkoutTemplates';
import type { ExperienceLevel, FitnessGoal, UserProfile, WorkoutLog, WorkoutTemplate } from '../types/models';

type PreferenceKey = FitnessGoal | (typeof BROWSE_CATEGORIES)[number];
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

const ALL_GOALS: FitnessGoal[] = ['lose_weight', 'build_strength', 'build_endurance'];
const ALL_KEYS: PreferenceKey[] = [...ALL_GOALS, ...BROWSE_CATEGORIES];
const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

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

// A workout done under 30 minutes is fair game for the "Quick Start" row.
const QUICK_START_MAX_MINUTES = 30;

// Bonus added to a template's score when its estimated difficulty lines up
// with the user's onboarding experience level — on the same scale as
// affinity (which typically ranges roughly 0-5), so it nudges rather than
// overrides taste.
const SKILL_EXACT_MATCH_BONUS = 1.5;
const SKILL_ADJACENT_MATCH_BONUS = 0.5;

function templateKeys(template: WorkoutTemplate): PreferenceKey[] {
  const keys: PreferenceKey[] = [...template.tags];
  if (template.browseCategory) keys.push(template.browseCategory as PreferenceKey);
  return keys;
}

// No workout is explicitly tagged with a skill level, so it's estimated from
// what's already on the template: short + no equipment reads as approachable
// for a beginner, long + equipment reads as advanced, everything else is
// intermediate. Quick Starts are always beginner-friendly by design.
function estimateDifficulty(template: WorkoutTemplate): Difficulty {
  if (template.category === 'quick_start') return 'beginner';
  if (!template.equipmentRequired && template.durationMinutes <= 20) return 'beginner';
  if (template.equipmentRequired && template.durationMinutes >= 45) return 'advanced';
  return 'intermediate';
}

const EXPERIENCE_TO_DIFFICULTY: Record<ExperienceLevel, Difficulty> = {
  new: 'beginner',
  some: 'intermediate',
  experienced: 'advanced',
};

function skillMatchBonus(template: WorkoutTemplate, experienceLevel: ExperienceLevel | undefined): number {
  if (!experienceLevel) return 0;
  const templateDifficulty = estimateDifficulty(template);
  const userDifficulty = EXPERIENCE_TO_DIFFICULTY[experienceLevel];
  if (templateDifficulty === userDifficulty) return SKILL_EXACT_MATCH_BONUS;
  const gap = Math.abs(
    DIFFICULTY_ORDER.indexOf(templateDifficulty) - DIFFICULTY_ORDER.indexOf(userDifficulty)
  );
  return gap === 1 ? SKILL_ADJACENT_MATCH_BONUS : 0;
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

function recentlyDoneWorkoutIds(logs: WorkoutLog[]): Set<string> {
  return new Set(
    logs
      .filter((l) => Date.now() - new Date(l.completedAt).getTime() < RECENTLY_DONE_COOLDOWN_MS)
      .map((l) => l.workoutId)
  );
}

// Deterministic per user per day (so picks don't flicker on every re-render)
// but shifts the moment new history changes the odds, and again the next
// calendar day. `salt` keeps the Recommended pick and the Quick Start row
// from drawing the exact same random sequence.
function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

function dailyRand(uid: string | undefined, salt: string): () => number {
  const seed = hashSeed(`${uid ?? 'anon'}-${salt}-${new Date().toISOString().slice(0, 10)}`);
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

// Combined taste score for one template: affinity summed across every tag/
// category it matches, plus a bonus if its estimated difficulty suits the
// user's experience level, plus a pinch of randomness to break ties.
function scoreTemplate(
  template: WorkoutTemplate,
  affinity: Map<PreferenceKey, number>,
  experienceLevel: ExperienceLevel | undefined,
  rand: () => number
): number {
  const affinityScore = templateKeys(template).reduce((sum, k) => sum + (affinity.get(k) ?? 0), 0);
  return affinityScore + skillMatchBonus(template, experienceLevel) + rand() * 0.01;
}

export function pickRecommendedWorkout(
  templates: WorkoutTemplate[],
  logs: WorkoutLog[],
  profile: Pick<UserProfile, 'goals' | 'experienceLevel'> | null | undefined,
  uid: string | undefined
): WorkoutTemplate | undefined {
  // `templates` here is only presets/quick-starts/browse (custom workouts are
  // a separate type, already front-and-center under "My Workouts").
  const discoverable = templates;
  if (discoverable.length === 0) return undefined;

  if (logs.length === 0) {
    // Cold start: no history yet, so lean on the goals picked at onboarding,
    // preferring one that also matches the user's skill level.
    const goalMatches = discoverable.filter((t) => profile?.goals?.some((g) => t.tags.includes(g)));
    const pool = goalMatches.length > 0 ? goalMatches : discoverable;
    const skillMatch = pool.find(
      (t) => estimateDifficulty(t) === (profile?.experienceLevel ? EXPERIENCE_TO_DIFFICULTY[profile.experienceLevel] : undefined)
    );
    return skillMatch ?? pool[0];
  }

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const affinity = computeAffinity(logs, templatesById);
  const rand = dailyRand(uid, 'recommended');

  const keyWeights = ALL_KEYS.map((k) => (affinity.get(k) ?? 0) + EXPLORE_EPSILON);
  const chosenKey = weightedPick(ALL_KEYS, keyWeights, rand);

  const recentlyDoneIds = recentlyDoneWorkoutIds(logs);
  const matching = discoverable.filter((t) => templateKeys(t).includes(chosenKey));
  const pool = matching.filter((t) => !recentlyDoneIds.has(t.id));
  const candidates = pool.length > 0 ? pool : matching.length > 0 ? matching : discoverable;

  // Within the chosen category, prefer whichever workout best matches the
  // user's overall affinities and skill level (not just the one key branched
  // into) so the pick still feels coherent with everything else they do.
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const template of candidates) {
    const score = scoreTemplate(template, affinity, profile?.experienceLevel, rand);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return best;
}

// Picks `count` short workouts for the Quick Start row, weighted by the same
// taste model as the Recommended card — rotating toward what the user
// typically does (with a little room to explore) instead of always showing
// the same fixed list.
export function pickQuickStartWorkouts(
  templates: WorkoutTemplate[],
  logs: WorkoutLog[],
  profile: Pick<UserProfile, 'experienceLevel'> | null | undefined,
  uid: string | undefined,
  count: number,
  excludeIds: string[] = []
): WorkoutTemplate[] {
  const pool = templates.filter(
    (t) => t.durationMinutes <= QUICK_START_MAX_MINUTES && !excludeIds.includes(t.id)
  );
  if (pool.length === 0) return [];

  if (logs.length === 0) {
    // Cold start: keep the original curated Quick Start list.
    const quickStarts = pool.filter((t) => t.category === 'quick_start');
    return (quickStarts.length > 0 ? quickStarts : pool).slice(0, count);
  }

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const affinity = computeAffinity(logs, templatesById);
  const rand = dailyRand(uid, 'quickstart');
  const recentlyDoneIds = recentlyDoneWorkoutIds(logs);

  // Weighted sample without replacement: score everything once, then repeatedly
  // pick and remove so the row doesn't show the same workout twice.
  const remaining = pool.map((template) => ({
    template,
    weight:
      templateKeys(template).reduce((sum, k) => sum + (affinity.get(k) ?? 0), 0) +
      skillMatchBonus(template, profile?.experienceLevel) +
      EXPLORE_EPSILON -
      (recentlyDoneIds.has(template.id) ? EXPLORE_EPSILON : 0),
  }));

  const picked: WorkoutTemplate[] = [];
  while (picked.length < count && remaining.length > 0) {
    const chosen = weightedPick(
      remaining,
      remaining.map((r) => Math.max(r.weight, 0.01)),
      rand
    );
    picked.push(chosen.template);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return picked;
}

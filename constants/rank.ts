// Ranks: the progress people see and chase. Seven tiers, Iron to Pillar,
// three divisions each (III, II, I) except Pillar. Rank comes from total XP,
// so it only ever goes up and everyone starts at Iron III. Levels still exist
// underneath (level badges, the server's level field) but aren't shown.
//
// Pacing, at roughly 350 XP a workout three times a week (~4,500 XP a
// month): Silver in about 5 weeks, Gold in about 4 months, Pillar in a bit
// over 2 years. Early ranks come fast; the top is rare.

export type RankTier = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'pillar';

export interface Rank {
  index: number; // 0 (Iron III) to RANKS.length - 1 (Pillar)
  tier: RankTier;
  division: 'III' | 'II' | 'I' | null; // null for Pillar
  name: string; // "Silver II"
  minXp: number;
}

export const TIER_NAMES: Record<RankTier, string> = {
  iron: 'Iron',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  pillar: 'Pillar',
};

// Emblem colors per tier: [light, dark] for the shield's gradient.
export const TIER_COLORS: Record<RankTier, [string, string]> = {
  iron: ['#9AA0A8', '#5A5F66'],
  bronze: ['#D9955A', '#8A4F22'],
  silver: ['#DDE3EA', '#8C97A3'],
  gold: ['#FFD866', '#C58A00'],
  platinum: ['#7FE3D8', '#1F8F86'],
  diamond: ['#9CC2FF', '#3A63D8'],
  pillar: ['#C4A6FF', '#6A35E0'],
};

const TIERS: RankTier[] = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'pillar'];
const DIVISIONS = ['III', 'II', 'I'] as const;

// Total XP each rank starts at, Iron III first.
const THRESHOLDS = [
  0, 500, 1_200, // Iron
  2_000, 3_000, 4_200, // Bronze
  5_500, 8_000, 12_000, // Silver
  17_000, 23_000, 30_000, // Gold
  38_000, 47_000, 57_000, // Platinum
  68_000, 82_000, 100_000, // Diamond
  125_000, // Pillar
];

export const RANKS: Rank[] = THRESHOLDS.map((minXp, index) => {
  const tier = TIERS[Math.min(Math.floor(index / 3), TIERS.length - 1)];
  const division = tier === 'pillar' ? null : DIVISIONS[index % 3];
  return { index, tier, division, name: division ? `${TIER_NAMES[tier]} ${division}` : TIER_NAMES[tier], minXp };
});

export function rankForXp(xp: number | null | undefined): Rank {
  const total = Math.max(0, xp ?? 0);
  let rank = RANKS[0];
  for (const r of RANKS) if (total >= r.minXp) rank = r;
  return rank;
}

export interface RankProgress {
  rank: Rank;
  next: Rank | null; // null at Pillar
  xpInto: number; // XP since this rank started
  xpNeeded: number; // XP from this rank to the next (0 at Pillar)
  xpToNext: number;
  progress: number; // 0-1
}

export function rankProgress(xp: number | null | undefined): RankProgress {
  const total = Math.max(0, xp ?? 0);
  const rank = rankForXp(total);
  const next = RANKS[rank.index + 1] ?? null;
  if (!next) return { rank, next, xpInto: total - rank.minXp, xpNeeded: 0, xpToNext: 0, progress: 1 };
  const xpNeeded = next.minXp - rank.minXp;
  const xpInto = total - rank.minXp;
  return { rank, next, xpInto, xpNeeded, xpToNext: next.minXp - total, progress: xpInto / xpNeeded };
}

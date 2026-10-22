// Ranks: the progress people see and chase. Seven tiers, Bronze to Pillar:
// Bronze, Iron and Silver have four divisions (IV to I), Gold, Platinum and
// Diamond three (III to I), and Pillar is one rank. Rank comes from total XP,
// so it only ever goes up and everyone starts at Bronze IV. Levels still
// exist underneath (level badges, the server's level field) but aren't shown.
//
// Pacing, at roughly 350 XP a workout three times a week (~4,500 XP a
// month): a new rank most weeks early on, Silver in about 5 weeks, Gold in
// about 4 months, Pillar in a bit over 2 years. Early ranks come fast; the
// top is rare.

export type RankTier = 'bronze' | 'iron' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'pillar';
export type RankDivision = 'IV' | 'III' | 'II' | 'I';

export interface Rank {
  index: number; // 0 (Bronze IV) to RANKS.length - 1 (Pillar)
  tier: RankTier;
  division: RankDivision | null; // null for Pillar
  name: string; // "Silver II"
  minXp: number;
}

export const TIER_NAMES: Record<RankTier, string> = {
  bronze: 'Bronze',
  iron: 'Iron',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  pillar: 'Pillar',
};

// Emblem colors per tier: [light, dark] for the shield's gradient.
export const TIER_COLORS: Record<RankTier, [string, string]> = {
  bronze: ['#D9955A', '#8A4F22'],
  iron: ['#9AA0A8', '#5A5F66'],
  silver: ['#DDE3EA', '#8C97A3'],
  gold: ['#FFD866', '#C58A00'],
  platinum: ['#7FE3D8', '#1F8F86'],
  diamond: ['#9CC2FF', '#3A63D8'],
  pillar: ['#C4A6FF', '#6A35E0'],
};

// Total XP each division starts at, lowest first.
const LADDER: { tier: RankTier; thresholds: number[] }[] = [
  { tier: 'bronze', thresholds: [0, 300, 700, 1_200] },
  { tier: 'iron', thresholds: [1_800, 2_500, 3_300, 4_200] },
  { tier: 'silver', thresholds: [5_500, 7_000, 9_000, 12_000] },
  { tier: 'gold', thresholds: [17_000, 23_000, 30_000] },
  { tier: 'platinum', thresholds: [38_000, 47_000, 57_000] },
  { tier: 'diamond', thresholds: [68_000, 82_000, 100_000] },
  { tier: 'pillar', thresholds: [125_000] },
];

const DIVISIONS: Record<number, RankDivision[]> = {
  4: ['IV', 'III', 'II', 'I'],
  3: ['III', 'II', 'I'],
};

export const RANKS: Rank[] = LADDER.flatMap(({ tier, thresholds }) =>
  thresholds.map((minXp, i) => {
    const division = tier === 'pillar' ? null : DIVISIONS[thresholds.length][i];
    return { tier, division, name: division ? `${TIER_NAMES[tier]} ${division}` : TIER_NAMES[tier], minXp };
  })
).map((r, index) => ({ index, ...r }));

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

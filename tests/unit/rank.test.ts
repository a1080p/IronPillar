import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RANKS, rankForXp, rankProgress } from '../../constants/rank';

describe('RANKS', () => {
  it('has 22 ranks, Bronze IV to Pillar, with rising thresholds', () => {
    assert.equal(RANKS.length, 22);
    assert.deepEqual(
      RANKS.map((r) => r.name),
      [
        'Bronze IV', 'Bronze III', 'Bronze II', 'Bronze I',
        'Iron IV', 'Iron III', 'Iron II', 'Iron I',
        'Silver IV', 'Silver III', 'Silver II', 'Silver I',
        'Gold III', 'Gold II', 'Gold I',
        'Platinum III', 'Platinum II', 'Platinum I',
        'Diamond III', 'Diamond II', 'Diamond I',
        'Pillar',
      ]
    );
    assert.deepEqual(RANKS[21], { index: 21, tier: 'pillar', division: null, name: 'Pillar', minXp: 125_000 });
    RANKS.forEach((r, i) => {
      assert.equal(r.index, i);
      if (i > 0) assert.ok(r.minXp > RANKS[i - 1].minXp, `${r.name} threshold rises`);
    });
  });

  it('keeps the published thresholds', () => {
    assert.deepEqual(
      RANKS.map((r) => r.minXp),
      [0, 300, 700, 1_200, 1_800, 2_500, 3_300, 4_200, 5_500, 7_000, 9_000, 12_000, 17_000, 23_000, 30_000,
        38_000, 47_000, 57_000, 68_000, 82_000, 100_000, 125_000]
    );
  });
});

describe('rankForXp', () => {
  it('starts everyone at Bronze IV, including missing or negative XP', () => {
    assert.equal(rankForXp(0).name, 'Bronze IV');
    assert.equal(rankForXp(null).name, 'Bronze IV');
    assert.equal(rankForXp(undefined).name, 'Bronze IV');
    assert.equal(rankForXp(-50).name, 'Bronze IV');
  });

  it('changes rank exactly at each threshold', () => {
    for (const r of RANKS.slice(1)) {
      assert.equal(rankForXp(r.minXp).index, r.index, `${r.name} at ${r.minXp}`);
      assert.equal(rankForXp(r.minXp - 1).index, r.index - 1, `below ${r.name}`);
    }
  });

  it('stays Pillar past the top', () => {
    assert.equal(rankForXp(10_000_000).name, 'Pillar');
  });
});

describe('rankProgress', () => {
  it('measures progress within a rank', () => {
    const p = rankProgress(2_000); // Iron IV: 1,800 -> 2,500
    assert.equal(p.rank.name, 'Iron IV');
    assert.equal(p.next?.name, 'Iron III');
    assert.equal(p.xpInto, 200);
    assert.equal(p.xpNeeded, 700);
    assert.equal(p.xpToNext, 500);
    assert.equal(p.progress, 200 / 700);
  });

  it('is zero at the start of a rank', () => {
    const p = rankProgress(17_000);
    assert.equal(p.rank.name, 'Gold III');
    assert.equal(p.progress, 0);
  });

  it('is full at Pillar with nothing next', () => {
    for (const xp of [125_000, 200_000]) {
      const p = rankProgress(xp);
      assert.equal(p.rank.name, 'Pillar');
      assert.equal(p.next, null);
      assert.equal(p.xpNeeded, 0);
      assert.equal(p.xpToNext, 0);
      assert.equal(p.progress, 1);
      assert.equal(p.xpInto, xp - 125_000);
    }
  });
});

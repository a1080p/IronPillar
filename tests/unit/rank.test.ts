import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RANKS, rankForXp, rankProgress } from '../../constants/rank';

describe('RANKS', () => {
  it('has 19 ranks, Iron III to Pillar, with rising thresholds', () => {
    assert.equal(RANKS.length, 19);
    assert.equal(RANKS[0].name, 'Iron III');
    assert.equal(RANKS[0].minXp, 0);
    assert.equal(RANKS[2].name, 'Iron I');
    assert.equal(RANKS[3].name, 'Bronze III');
    assert.equal(RANKS[17].name, 'Diamond I');
    assert.deepEqual(RANKS[18], { index: 18, tier: 'pillar', division: null, name: 'Pillar', minXp: 125_000 });
    RANKS.forEach((r, i) => {
      assert.equal(r.index, i);
      if (i > 0) assert.ok(r.minXp > RANKS[i - 1].minXp, `${r.name} threshold rises`);
    });
  });

  it('keeps the published thresholds', () => {
    assert.deepEqual(
      RANKS.map((r) => r.minXp),
      [0, 500, 1_200, 2_000, 3_000, 4_200, 5_500, 8_000, 12_000, 17_000, 23_000, 30_000, 38_000, 47_000, 57_000,
        68_000, 82_000, 100_000, 125_000]
    );
  });
});

describe('rankForXp', () => {
  it('starts everyone at Iron III, including missing or negative XP', () => {
    assert.equal(rankForXp(0).name, 'Iron III');
    assert.equal(rankForXp(null).name, 'Iron III');
    assert.equal(rankForXp(undefined).name, 'Iron III');
    assert.equal(rankForXp(-50).name, 'Iron III');
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
    const p = rankProgress(750); // Iron II: 500 -> 1,200
    assert.equal(p.rank.name, 'Iron II');
    assert.equal(p.next?.name, 'Iron I');
    assert.equal(p.xpInto, 250);
    assert.equal(p.xpNeeded, 700);
    assert.equal(p.xpToNext, 450);
    assert.equal(p.progress, 250 / 700);
  });

  it('is zero at the start of a rank', () => {
    const p = rankProgress(2_000);
    assert.equal(p.rank.name, 'Bronze III');
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

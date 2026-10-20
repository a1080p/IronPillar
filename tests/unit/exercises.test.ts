import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXERCISE_CATALOG,
  canonicalExerciseName,
  catalogExerciseById,
  findCatalogExercise,
  normalizeExerciseName,
  swapSuggestions,
} from '../../data/exercises';
import { PROGRAM_DAYS } from '../../data/programs';
import { workoutTemplates } from '../../data/workoutTemplates';

describe('catalog', () => {
  it('has unique ids, and no name or alias claimed by two entries', () => {
    const ids = new Set<string>();
    const names = new Map<string, string>();
    for (const e of EXERCISE_CATALOG) {
      assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
      ids.add(e.id);
      for (const n of [e.name, ...(e.aliases ?? [])]) {
        const owner = names.get(normalizeExerciseName(n));
        assert.ok(!owner || owner === e.id, `"${n}" is on both ${owner} and ${e.id}`);
        names.set(normalizeExerciseName(n), e.id);
      }
    }
  });
});

describe('findCatalogExercise', () => {
  it('prefers the catalogId', () => {
    assert.equal(findCatalogExercise({ name: 'Anything', catalogId: 'plank' })?.id, 'plank');
  });

  it('falls back to the name or an alias', () => {
    assert.equal(findCatalogExercise({ name: 'Barbell Deadlift' })?.id, 'barbell-deadlift');
    assert.equal(findCatalogExercise({ name: 'Conventional Deadlift' })?.id, 'barbell-deadlift');
    assert.equal(findCatalogExercise({ name: '  rdl ' })?.id, 'romanian-deadlift');
    assert.equal(findCatalogExercise({ name: 'Bogus', catalogId: 'no-such-id' }), undefined);
  });

  it('finds nothing for segments that are not exercises', () => {
    assert.equal(findCatalogExercise({ name: 'Cool-Down Spin' }), undefined);
  });
});

describe('canonicalExerciseName', () => {
  it('maps aliases to the catalog name', () => {
    assert.equal(canonicalExerciseName('Bent-Over Barbell Row'), 'Barbell Bent-Over Row');
    assert.equal(canonicalExerciseName('front plank'), 'Plank');
    assert.equal(canonicalExerciseName('Pull-Ups (or Lat Pulldown)'), 'Pull-Ups');
    assert.equal(canonicalExerciseName('OHP'), 'Barbell Overhead Press');
  });

  it('straightens curly apostrophes', () => {
    assert.equal(canonicalExerciseName('Child’s Pose'), "Child's Pose");
    assert.equal(canonicalExerciseName('Supported Child‘s Pose'), "Child's Pose");
  });

  it('keeps unknown names, trimmed', () => {
    assert.equal(canonicalExerciseName('  My Weird Move '), 'My Weird Move');
  });

  it('is stable for catalog names', () => {
    for (const e of EXERCISE_CATALOG) assert.equal(canonicalExerciseName(e.name), e.name);
  });
});

describe('swapSuggestions', () => {
  it('only suggests the same log type and main muscle, never itself', () => {
    for (const e of EXERCISE_CATALOG) {
      for (const s of swapSuggestions(e, 100)) {
        assert.notEqual(s.id, e.id);
        assert.equal(s.logType, e.logType, `${e.id} -> ${s.id}`);
        assert.equal(s.primaryMuscles[0], e.primaryMuscles[0], `${e.id} -> ${s.id}`);
      }
    }
  });

  it('keeps timed holds and rep exercises apart', () => {
    const ids = swapSuggestions(catalogExerciseById('plank'), 100).map((s) => s.id);
    assert.ok(ids.includes('side-plank'));
    assert.ok(!ids.includes('crunches'));
  });

  it('lists same-equipment swaps first and honours the limit', () => {
    for (const e of EXERCISE_CATALOG) {
      const all = swapSuggestions(e, 100);
      const firstOther = all.findIndex((s) => s.equipment !== e.equipment);
      if (firstOther >= 0) assert.ok(all.slice(firstOther).every((s) => s.equipment !== e.equipment), e.id);
      assert.ok(swapSuggestions(e).length <= 8);
    }
    assert.deepEqual(swapSuggestions(undefined), []);
  });
});

describe('templates', () => {
  it('every template and program exercise with a catalogId resolves', () => {
    let checked = 0;
    for (const t of [...workoutTemplates, ...PROGRAM_DAYS]) {
      for (const e of t.exercises) {
        if (!e.catalogId) continue;
        checked++;
        assert.ok(catalogExerciseById(e.catalogId), `${t.id} / ${e.name}: unknown catalogId ${e.catalogId}`);
      }
    }
    assert.ok(checked > 50, `only ${checked} exercises had a catalogId`);
  });
});

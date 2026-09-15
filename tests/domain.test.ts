import { describe, expect, it } from 'vitest';
import {
  canTransition,
  completion,
  csvCell,
  pairedResults,
  publishBlockers,
  weightedScore,
} from '../src/lib/domain';

describe('program state machine', () => {
  it('allows only the declared transitions', () => {
    expect(canTransition('Draft', 'Published')).toBe(true);
    expect(canTransition('RegistrationOpen', 'RegistrationClosed')).toBe(true);
    expect(canTransition('Completed', 'Archived')).toBe(true);
  });

  it('rejects skipping ahead or going backwards', () => {
    expect(canTransition('Draft', 'Active')).toBe(false);
    expect(canTransition('Active', 'RegistrationOpen')).toBe(false);
    expect(canTransition('Archived', 'Draft')).toBe(false);
  });

  it('treats an unknown state as terminal', () => {
    expect(canTransition('Nonsense', 'Draft')).toBe(false);
  });
});

describe('weightedScore', () => {
  const rubric = [{ weight: 40 }, { weight: 35 }, { weight: 25 }];

  it('scales a perfect score to 100', () => {
    expect(weightedScore(rubric, [5, 5, 5])).toBe(100);
  });

  it('scales the floor to 0', () => {
    expect(weightedScore(rubric, [0, 0, 0])).toBe(0);
  });

  it('weights each criterion by its share', () => {
    // 40*4/5 + 35*3/5 + 25*5/5 = 32 + 21 + 25
    expect(weightedScore(rubric, [4, 3, 5])).toBeCloseTo(78, 10);
  });

  it('refuses weights that do not total 100', () => {
    expect(() => weightedScore([{ weight: 50 }, { weight: 30 }], [5, 5])).toThrow();
  });

  it('refuses a score count that does not match the rubric', () => {
    expect(() => weightedScore(rubric, [5, 5])).toThrow();
  });

  it('refuses out-of-range and non-finite scores', () => {
    expect(() => weightedScore(rubric, [6, 5, 5])).toThrow();
    expect(() => weightedScore(rubric, [-1, 5, 5])).toThrow();
    expect(() => weightedScore(rubric, [Number.NaN, 5, 5])).toThrow();
  });
});

describe('pairedResults', () => {
  const rows = (
    entries: Array<[string, string, number, string]>,
  ): Array<{ enrollmentId: string; period: string; value: number; status: string }> =>
    entries.map(([enrollmentId, period, value, status]) => ({
      enrollmentId,
      period,
      value,
      status,
    }));

  it('averages the change across complete verified pairs', () => {
    const result = pairedResults(
      rows([
        ['a', 'Baseline', 40, 'Verified'],
        ['a', 'Endline', 60, 'Verified'],
        ['b', 'Baseline', 50, 'Verified'],
        ['b', 'Endline', 80, 'Verified'],
      ]),
      2,
    );
    expect(result.pairs).toBe(2);
    expect(result.change).toBe(25); // (20 + 30) / 2
    expect(result.coverage).toBe(100);
  });

  it('ignores measurements that are not verified', () => {
    const result = pairedResults(
      rows([
        ['a', 'Baseline', 40, 'Verified'],
        ['a', 'Endline', 60, 'Draft'],
      ]),
      1,
    );
    expect(result.pairs).toBe(0);
    expect(result.change).toBeNull();
  });

  it('ignores an enrollment with only one side of the pair', () => {
    const result = pairedResults(rows([['a', 'Baseline', 40, 'Verified']]), 1);
    expect(result.pairs).toBe(0);
    expect(result.change).toBeNull();
  });

  it('reports a negative change when the endline falls', () => {
    const result = pairedResults(
      rows([
        ['a', 'Baseline', 70, 'Verified'],
        ['a', 'Endline', 50, 'Verified'],
      ]),
      1,
    );
    expect(result.change).toBe(-20);
  });

  it('returns null coverage when there is no target population', () => {
    expect(pairedResults([], 0).coverage).toBeNull();
  });
});

describe('completion', () => {
  it('passes when the present share meets the threshold', () => {
    expect(completion(['Present', 'Present', 'Present', 'Absent'], 75)).toBe(true);
  });

  it('fails when the present share is below the threshold', () => {
    expect(completion(['Present', 'Absent', 'Absent', 'Absent'], 75)).toBe(false);
  });

  it('excludes excused sessions from the denominator', () => {
    // 2 of 2 counted sessions present -> 100%, despite two excused absences.
    expect(completion(['Present', 'Present', 'Excused', 'Excused'], 100)).toBe(true);
  });

  it('fails while any session is still unrecorded', () => {
    expect(completion(['Present', 'Present', 'NotRecorded'], 50)).toBe(false);
  });

  it('fails when every session was excused, leaving no evidence', () => {
    expect(completion(['Excused', 'Excused'], 50)).toBe(false);
  });
});

describe('csvCell', () => {
  it('quotes plain values', () => {
    expect(csvCell('hello')).toBe('"hello"');
  });

  it('escapes embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell('+cmd')).toBe(`"'+cmd"`);
    expect(csvCell('-2')).toBe(`"'-2"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe('publishBlockers (FR-008)', () => {
  const complete = {
    form: [{ id: 'motivation' }],
    rubric: [{ weight: 60 }, { weight: 40 }],
    privacyAr: 'إشعار',
    privacyEn: 'Notice',
    ownerId: 'owner-1',
  };

  it('lets a complete program through', () => {
    expect(publishBlockers(complete, true)).toEqual([]);
  });

  it('names every missing piece rather than the first one', () => {
    expect(publishBlockers({ ...complete, form: [], rubric: [{ weight: 90 }], privacyEn: '  ', ownerId: null }, false)).toEqual([
      'form',
      'rubric',
      'privacy',
      'owner',
    ]);
  });

  it('treats an owner who left the workspace as missing', () => {
    expect(publishBlockers(complete, false)).toEqual(['owner']);
  });

  it('rejects weights that do not add up to 100', () => {
    expect(publishBlockers({ ...complete, rubric: [{ weight: 50 }, { weight: 40 }] }, true)).toEqual(['rubric']);
  });
});

import { getLaneCount } from '../src/utils/layout';

describe('responsive lane policy', () => {
  it.each([
    [0, 1],
    [260, 1],
    [279, 1],
    [280, 2],
    [320, 2],
    [415, 2],
    [416, 3],
    [420, 3],
    [551, 3],
    [552, 4],
    [600, 4],
    [1200, 8],
  ] as const)('uses %i px as %i lane(s)', (width, expected) => {
    expect(getLaneCount('masonry', width)).toBe(expected);
  });

  it('always uses one lane in list mode', () => {
    expect(getLaneCount('list', 1200)).toBe(1);
  });
});

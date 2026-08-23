import { normalizeTags } from '../src/services/enhancements';

describe('bookmark enhancement helpers', () => {
  it('trims, removes empty values, and deduplicates tags', () => {
    expect(normalizeTags([' 待读 ', '', '工作', '待读'])).toEqual(['待读', '工作']);
  });

  it('limits metadata to fifty tags', () => {
    expect(normalizeTags(Array.from({ length: 60 }, (_, index) => `tag-${index}`))).toHaveLength(50);
  });

  it('limits each tag to a compact display-safe length', () => {
    expect(normalizeTags(['x'.repeat(100)])[0]).toHaveLength(64);
  });
});

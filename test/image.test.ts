import { calculateCenterCrop } from '../src/services/image';

describe('calculateCenterCrop', () => {
  it('crops wide screenshots horizontally to 16:10', () => {
    const crop = calculateCenterCrop(1920, 900);
    expect(crop.height).toBe(900);
    expect(crop.width).toBe(1440);
    expect(crop.x).toBe(240);
  });

  it('crops tall screenshots vertically to 16:10', () => {
    const crop = calculateCenterCrop(1200, 1000);
    expect(crop.width).toBe(1200);
    expect(crop.height).toBe(750);
    expect(crop.y).toBe(125);
  });
});


import { describe, expect, it } from 'vitest';
import { formatTransferNumber, toRomanMonth } from '@/modules/assets/transfer-number';

describe('toRomanMonth', () => {
  it('maps every month to its Roman numeral', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(toRomanMonth)).toEqual([
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
    ]);
  });
});

describe('formatTransferNumber', () => {
  it('builds sequence/BBP/category/roman month/year', () => {
    expect(formatTransferNumber(3, 'IT', 10, 2026)).toBe('3/BBP/IT/X/2026');
  });

  it('keeps the category code as given', () => {
    expect(formatTransferNumber(1, 'ELECTRONICS', 7, 2026)).toBe('1/BBP/ELECTRONICS/VII/2026');
  });
});

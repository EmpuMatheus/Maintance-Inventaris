const ROMAN_MONTHS = [
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
] as const;

/** Converts a 1-based month number to its Roman numeral (I-XII). */
export function toRomanMonth(month: number): string {
  const roman = ROMAN_MONTHS[month - 1];
  if (!roman) throw new Error(`Invalid month: ${month}`);
  return roman;
}

/**
 * Transfer proof number: `{sequence}/BBP/{categoryCode}/{romanMonth}/{year}`.
 * The sequence resets every month, per category.
 */
export function formatTransferNumber(
  sequence: number,
  categoryCode: string,
  month: number,
  year: number,
): string {
  return `${sequence}/BBP/${categoryCode}/${toRomanMonth(month)}/${year}`;
}
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle);
  return normalizedNeedle.length === 0 || normalizeText(haystack).includes(normalizedNeedle);
}

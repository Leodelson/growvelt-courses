/**
 * Public course descriptions must be readable prose. Long unbroken values are
 * commonly accidental keyboard input, so keep them out of cards and metadata.
 */
export function normalizePublicCourseCopy(value: string | null | undefined): string | null {
  const copy = value?.trim() ?? "";
  if (!copy) return null;

  if (copy.length >= 80 && !/\s/u.test(copy) && /^[\p{L}\p{N}_-]+$/u.test(copy)) {
    return null;
  }

  // Reject long, highly repetitive tokens that commonly come from accidental
  // keyboard input, even when spaces make the overall value look like prose.
  const words = copy.match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words) {
    const characters = Array.from(word.toLowerCase());
    if (characters.length < 12) continue;

    const frequencies = new Map<string, number>();
    for (const character of characters) {
      frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
    }

    const uniqueRatio = frequencies.size / characters.length;
    const mostRepeatedRatio = Math.max(...frequencies.values()) / characters.length;
    if (uniqueRatio <= 0.42 && mostRepeatedRatio >= 0.24) return null;
  }

  return copy;
}

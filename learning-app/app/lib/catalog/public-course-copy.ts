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

  return copy;
}

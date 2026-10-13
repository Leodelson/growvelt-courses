export function parseNgNPriceToMinorUnits(value: string): number | null {
  const match = /^(\d{1,11})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const minorUnits = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) return null;
  return minorUnits;
}

export function parseSelectedSubscriptionCourseIds(values: string[]): number[] | null {
  if (values.length < 1 || values.length > 50) return null;

  if (values.some((value) => !/^[1-9]\d*$/.test(value))) return null;
  const courseIds = values.map((value) => Number(value));
  if (courseIds.some((courseId) => !Number.isSafeInteger(courseId) || courseId <= 0)) return null;
  if (new Set(courseIds).size !== courseIds.length) return null;
  return courseIds;
}

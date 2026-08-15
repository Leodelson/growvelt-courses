export type OperationsQuery = {
  query: string;
  status: string;
  category: string;
  level: string;
  page: number;
};

export function normalizeOperationsQuery(searchParams: Record<string, string | string[] | undefined>): OperationsQuery {
  const read = (key: string) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const page = Number.parseInt(read("page"), 10);
  return {
    query: read("q").trim().slice(0, 120),
    status: read("status").trim().slice(0, 40),
    category: read("category").trim().slice(0, 100),
    level: read("level").trim().slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}

export function operationsHref(pathname: string, query: OperationsQuery, changes: Partial<OperationsQuery> = {}) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.status) params.set("status", next.status);
  if (next.category) params.set("category", next.category);
  if (next.level) params.set("level", next.level);
  if (next.page > 1) params.set("page", String(next.page));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

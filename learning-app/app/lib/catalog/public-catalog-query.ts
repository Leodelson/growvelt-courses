export type PublicCatalogQuery = {
  query: string;
  category: string;
  level: string;
  access: "all" | "free" | "paid";
  sort: "newest" | "title_asc" | "title_desc";
  page: number;
};

export function normalizePublicCatalogQuery(searchParams: Record<string, string | string[] | undefined>): PublicCatalogQuery {
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const value = (key: string, maxLength = 100) => read(key).trim().slice(0, maxLength);
  const access = read("access");
  const sort = read("sort");
  const page = Number.parseInt(read("page"), 10);

  return {
    query: value("q", 120),
    category: value("category"),
    level: value("level"),
    access: access === "free" || access === "paid" ? access : "all",
    sort: sort === "title_asc" || sort === "title_desc" ? sort : "newest",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}

export function publicCatalogHref(query: PublicCatalogQuery, changes: Partial<PublicCatalogQuery> = {}, basePath = "/learn") {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.level) params.set("level", next.level);
  if (next.access !== "all") params.set("access", next.access);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

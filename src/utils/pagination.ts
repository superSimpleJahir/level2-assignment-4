// Turns ?page=2&limit=10 into safe skip/take values
export const getPagination = (query: { page?: unknown; limit?: unknown }) => {
  const page = Math.max(parseInt(String(query.page ?? "1"), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? "10"), 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});

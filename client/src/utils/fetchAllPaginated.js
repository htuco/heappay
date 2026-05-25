/** Matches backend `limit` max (users/cards routers). */
export const API_MAX_PAGE_SIZE = 1000

/**
 * Fetch every page from a limit/offset list endpoint until a short page is returned.
 *
 * @template T
 * @param {(params: { limit: number, offset: number }) => Promise<T[]>} fetchPage
 * @param {{ pageSize?: number }} [options]
 * @returns {Promise<T[]>}
 */
export async function fetchAllPaginated(fetchPage, { pageSize = API_MAX_PAGE_SIZE } = {}) {
  const all = []
  let offset = 0

  while (true) {
    const page = await fetchPage({ limit: pageSize, offset })
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

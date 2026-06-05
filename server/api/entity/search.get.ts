/**
 * Entity search.
 *
 * Same-origin route that returns the top matches (with flavor + score) for
 * a name query, fetched via `qsFetch` (direct in-cluster QS when configured,
 * else the Portal proxy). Kept server-side so the page stays focused on UI
 * state and never handles QS auth in component code.
 *
 * Query params:
 *   - q: string (required)        — the search query
 *   - maxResults: number (default 8) — upper bound on matches returned
 */
import { isQsConfigured, qsFetch } from '~/server/utils/elementalQs';

interface SearchMatch {
    neid: string;
    name: string;
    flavor: string;
    score: number;
}

export default defineEventHandler(async (event): Promise<{ matches: SearchMatch[] }> => {
    const { q, maxResults } = getQuery(event);
    const query = typeof q === 'string' ? q.trim() : '';
    if (!query) return { matches: [] };

    if (!isQsConfigured()) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Query Server is not configured',
        });
    }

    const limit = Math.min(20, Math.max(1, Number(maxResults) || 8));

    try {
        const res = (await qsFetch('entities/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                queries: [{ queryId: 1, query }],
                maxResults: limit,
                includeNames: true,
            }),
            timeout: 15000,
        })) as any;

        const raw: any[] = res?.results?.[0]?.matches ?? [];
        const matches: SearchMatch[] = raw.map((m) => ({
            neid: String(m?.neid ?? ''),
            name: String(m?.name ?? m?.neid ?? ''),
            flavor: String(m?.flavor ?? ''),
            score: typeof m?.score === 'number' ? m.score : 0,
        }));
        return { matches };
    } catch (err: any) {
        const status = err?.statusCode ?? err?.response?.status ?? 502;
        throw createError({
            statusCode: status,
            statusMessage: `Entity search failed: ${err?.message || 'unknown error'}`,
        });
    }
});

/**
 * Entity search proxy.
 *
 * Same-origin wrapper around `POST {gateway}/api/qs/{org}/entities/search`
 * that returns the top matches (with flavor + score) for a name query.
 * Kept server-side so the page can stay focused on UI state instead of
 * gateway wiring, and so the QS API key isn't read directly from
 * `useRuntimeConfig().public` in component code.
 *
 * Query params:
 *   - q: string (required)        — the search query
 *   - maxResults: number (default 8) — upper bound on matches returned
 */
import { isQsConfigured } from '~/server/utils/elementalQs';

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

    const pub = useRuntimeConfig().public as Record<string, string>;
    const url = `${pub.gatewayUrl}/api/qs/${pub.tenantOrgId}/entities/search`;
    const limit = Math.min(20, Math.max(1, Number(maxResults) || 8));

    try {
        const res = await $fetch<any>(url, {
            method: 'POST',
            headers: {
                'X-Api-Key': pub.qsApiKey,
                'Content-Type': 'application/json',
            },
            body: {
                queries: [{ queryId: 1, query }],
                maxResults: limit,
                includeNames: true,
            },
            timeout: 15000,
        });

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

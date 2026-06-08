/**
 * Resolve a NEID to `{ neid, name, flavor }` so a linked entity can be loaded
 * as the explorer's target. The Query Server has no single flavor-by-NEID
 * endpoint, so flavor is recovered via search/graph-layout (see
 * `resolveEntityFlavor`). `flavor` may come back empty if neither strategy
 * succeeds — the caller surfaces that as a schema error.
 *
 * Query params:
 *   - neid: string (required)  — entity NEID (zero-padded to 20 chars here)
 *   - name: string (optional)  — display-name hint; speeds up flavor lookup
 */
import {
    padNeid,
    isQsConfigured,
    resolveEntityFlavor,
    resolveEntityNames,
} from '~/server/utils/elementalQs';

interface ResolveResponse {
    neid: string;
    name: string;
    flavor: string;
}

export default defineEventHandler(async (event): Promise<ResolveResponse> => {
    const { neid, name } = getQuery(event);
    const rawNeid = typeof neid === 'string' ? neid.trim() : '';
    const nameHint = typeof name === 'string' ? name.trim() : '';

    if (!rawNeid || !/^\d+$/.test(rawNeid)) {
        throw createError({ statusCode: 400, statusMessage: 'neid must be a numeric string' });
    }
    if (!isQsConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Query Server is not configured' });
    }

    const neidStr = padNeid(rawNeid);

    // Prefer the canonical name; fall back to the hint, then the NEID itself.
    const nameMap = await resolveEntityNames([neidStr]);
    const resolvedName = nameMap[neidStr] || nameHint || neidStr;

    const flavor = await resolveEntityFlavor(neidStr, resolvedName);

    return { neid: neidStr, name: resolvedName, flavor };
});

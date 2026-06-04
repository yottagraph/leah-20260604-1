/**
 * Fetch up to 5 unique values for a single property on an entity.
 *
 * The Query Server returns one row per `(eid, pid, efid)` source, so a
 * property like `name` may come back as a dozen identical rows. We
 * deduplicate by value, cap at 5, and report the total unique count so
 * the UI can render "showing 5 of N" hints.
 *
 * For relationship properties (`data_nindex`) the raw value is a numeric
 * entity id that must be zero-padded to a 20-char NEID and then resolved
 * to a display name via `GET /entities/{neid}/name`.
 *
 * Query params:
 *   - neid: string (required)  — entity NEID (20-char, zero-padded)
 *   - pid:  string (required)  — property id (opaque string — may be a
 *                                64-bit negative like -5294792805565584640)
 *   - type: string (optional)  — property type from /schema. When
 *                                "data_nindex" we resolve linked names.
 */
import { isQsConfigured, padNeid, qsParse, resolveEntityNames } from '~/server/utils/elementalQs';

interface ValueItem {
    /** Raw value (string). For data_nindex this is the padded 20-char NEID. */
    value: string;
    /** Display label — the resolved entity name for data_nindex, else == value. */
    label: string;
}

interface ValuesResponse {
    type: string;
    items: ValueItem[];
    /** Total number of unique values found (before the 5-item cap). */
    totalCount: number;
}

export default defineEventHandler(async (event): Promise<ValuesResponse> => {
    const { neid, pid, type } = getQuery(event);
    const neidStr = typeof neid === 'string' ? neid.trim() : '';
    const pidStr = typeof pid === 'string' ? pid.trim() : '';
    const typeStr = typeof type === 'string' ? type.trim() : '';

    if (!neidStr || !pidStr) {
        throw createError({
            statusCode: 400,
            statusMessage: 'neid and pid query params are required',
        });
    }
    if (!/^-?\d+$/.test(pidStr)) {
        throw createError({ statusCode: 400, statusMessage: 'pid must be a numeric string' });
    }
    if (!isQsConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Query Server is not configured' });
    }

    const pub = useRuntimeConfig().public as Record<string, string>;
    const url = `${pub.gatewayUrl}/api/qs/${pub.tenantOrgId}/elemental/entities/properties`;

    // Build the form body with the pid as a literal — JSON.stringify would
    // round large negatives.
    const form = new URLSearchParams();
    form.set('eids', JSON.stringify([padNeid(neidStr)]));
    form.set('pids', `[${pidStr}]`);

    let parsed: any;
    try {
        const text = await $fetch<string>(url, {
            method: 'POST',
            headers: {
                'X-Api-Key': pub.qsApiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
            responseType: 'text',
            timeout: 15000,
        });
        parsed = qsParse(text);
    } catch (err: any) {
        const status = err?.statusCode ?? err?.response?.status ?? 502;
        if (status === 404) {
            return { type: typeStr, items: [], totalCount: 0 };
        }
        throw createError({
            statusCode: status,
            statusMessage: `Property fetch failed: ${err?.message || 'unknown error'}`,
        });
    }

    const rows: any[] = Array.isArray(parsed?.values) ? parsed.values : [];

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const row of rows) {
        if (row?.value === null || row?.value === undefined) continue;
        const v = String(row.value);
        if (seen.has(v)) continue;
        seen.add(v);
        unique.push(v);
    }

    const isRef = typeStr === 'data_nindex';
    const capped = unique.slice(0, 5);

    let items: ValueItem[];
    if (isRef) {
        const neids = capped.map((v) => padNeid(v));
        const nameByNeid = neids.length ? await resolveEntityNames(neids) : {};
        items = neids.map((n) => ({ value: n, label: nameByNeid[n] ?? n }));
    } else {
        items = capped.map((v) => ({ value: v, label: v }));
    }

    return {
        type: typeStr,
        items,
        totalCount: unique.length,
    };
});

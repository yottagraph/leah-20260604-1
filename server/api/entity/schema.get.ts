/**
 * Flavor-scoped schema discovery.
 *
 * Fetches the full Elemental metadata schema (cached in-process), then
 * returns the subset of properties / relationships whose `domain_flavors`
 * include the requested flavor.
 *
 * The raw schema response is parsed via `qsParse()` so 64-bit PIDs / FIDs
 * survive intact (a plain JSON.parse would silently round large negatives
 * like `-5294792805565584640`). Every id is returned as an opaque string.
 *
 * Query params:
 *   - flavor: string (required)  — the entity flavor (e.g. "organization")
 */
import { isQsConfigured, qsFetch } from '~/server/utils/elementalQs';

interface SchemaProperty {
    pid: string;
    name: string;
    type: string;
    targetFlavors?: string[];
}

interface SchemaResponse {
    flavor: string;
    flavorDisplayName: string | null;
    flavorDescription: string | null;
    properties: SchemaProperty[];
    relationships: SchemaProperty[];
}

let rawSchemaCache: any = null;
let rawSchemaPromise: Promise<any> | null = null;

async function fetchRawSchema(): Promise<any> {
    if (rawSchemaCache) return rawSchemaCache;
    if (rawSchemaPromise) return rawSchemaPromise;

    rawSchemaPromise = (async () => {
        rawSchemaCache = await qsFetch('elemental/metadata/schema', { timeout: 20000 });
        return rawSchemaCache;
    })().finally(() => {
        rawSchemaPromise = null;
    });

    return rawSchemaPromise;
}

export default defineEventHandler(async (event): Promise<SchemaResponse> => {
    const { flavor } = getQuery(event);
    const flavorName = typeof flavor === 'string' ? flavor.trim() : '';
    if (!flavorName) {
        throw createError({ statusCode: 400, statusMessage: 'flavor query param is required' });
    }
    if (!isQsConfigured()) {
        throw createError({ statusCode: 503, statusMessage: 'Query Server is not configured' });
    }

    const raw = await fetchRawSchema();
    const rawProps: any[] = raw?.schema?.properties ?? raw?.properties ?? [];
    const rawFlavors: any[] = raw?.schema?.flavors ?? raw?.flavors ?? [];

    const flavorInfo = rawFlavors.find((f) => f?.name === flavorName);
    if (!flavorInfo) {
        throw createError({
            statusCode: 404,
            statusMessage: `Unknown flavor: ${flavorName}`,
        });
    }

    const properties: SchemaProperty[] = [];
    const relationships: SchemaProperty[] = [];

    for (const p of rawProps) {
        const domains: string[] = Array.isArray(p?.domain_flavors) ? p.domain_flavors : [];
        if (!domains.includes(flavorName)) continue;

        const entry: SchemaProperty = {
            pid: String(p?.pid ?? ''),
            name: String(p?.name ?? ''),
            type: String(p?.type ?? ''),
        };
        if (!entry.pid || !entry.name) continue;

        if (entry.type === 'data_nindex') {
            const targets = Array.isArray(p?.target_flavors)
                ? (p.target_flavors as unknown[]).map(String)
                : [];
            if (targets.length) entry.targetFlavors = targets;
            relationships.push(entry);
        } else {
            properties.push(entry);
        }
    }

    const byName = (a: SchemaProperty, b: SchemaProperty) => a.name.localeCompare(b.name);
    properties.sort(byName);
    relationships.sort(byName);

    return {
        flavor: flavorName,
        flavorDisplayName: flavorInfo?.singular_display_name ?? null,
        flavorDescription: flavorInfo?.description ?? null,
        properties,
        relationships,
    };
});

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
    uid: string;
    direction?: 'incoming' | 'outgoing';
    targetFlavors?: string[];
}

interface SchemaResponse {
    flavor: string;
    flavorDisplayName: string | null;
    flavorDescription: string | null;
    properties: SchemaProperty[];
    relationships: SchemaProperty[];
    incomingRelationships: SchemaProperty[];
}

let rawSchemaCache: any = null;
let rawSchemaPromise: Promise<any> | null = null;

async function fetchRawSchema(force = false): Promise<any> {
    if (rawSchemaCache && !force) return rawSchemaCache;
    if (rawSchemaPromise && !force) return rawSchemaPromise;

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

    let raw = await fetchRawSchema();
    let rawFlavors: any[] = raw?.schema?.flavors ?? raw?.flavors ?? [];
    let flavorInfo = rawFlavors.find((f) => f?.name === flavorName);

    // The metadata schema is cached in-process and never expires, so a
    // flavor minted after we cached (e.g. a newly-ingested custom-source
    // flavor) would look "unknown" until the app restarts. Refetch once
    // before giving up — cheap, and it self-heals as new flavors land.
    if (!flavorInfo) {
        raw = await fetchRawSchema(true);
        rawFlavors = raw?.schema?.flavors ?? raw?.flavors ?? [];
        flavorInfo = rawFlavors.find((f) => f?.name === flavorName);
    }

    if (!flavorInfo) {
        throw createError({
            statusCode: 404,
            statusMessage: `Unknown flavor: ${flavorName}`,
        });
    }

    const rawProps: any[] = raw?.schema?.properties ?? raw?.properties ?? [];

    const properties: SchemaProperty[] = [];
    const relationships: SchemaProperty[] = [];
    const incomingRelationships: SchemaProperty[] = [];

    for (const p of rawProps) {
        const pid = String(p?.pid ?? '');
        const name = String(p?.name ?? '');
        const type = String(p?.type ?? '');
        if (!pid || !name) continue;

        const domains: string[] = Array.isArray(p?.domain_flavors) ? p.domain_flavors : [];
        const targets: string[] = Array.isArray(p?.target_flavors)
            ? (p.target_flavors as unknown[]).map(String)
            : [];

        // Outgoing: this flavor is the source of the property.
        if (domains.includes(flavorName)) {
            if (type === 'data_nindex') {
                relationships.push({
                    pid,
                    name,
                    type,
                    uid: pid,
                    direction: 'outgoing',
                    ...(targets.length ? { targetFlavors: targets } : {}),
                });
            } else {
                properties.push({ pid, name, type, uid: pid });
            }
        }

        // Incoming: this flavor is the target of another entity's relationship.
        if (type === 'data_nindex' && targets.includes(flavorName)) {
            incomingRelationships.push({
                pid,
                name,
                type,
                uid: `${pid}:in`,
                direction: 'incoming',
                // The "other side" of an incoming edge is the source flavor.
                ...(domains.length ? { targetFlavors: domains } : {}),
            });
        }
    }

    const byName = (a: SchemaProperty, b: SchemaProperty) => a.name.localeCompare(b.name);
    properties.sort(byName);
    relationships.sort(byName);
    incomingRelationships.sort(byName);

    return {
        flavor: flavorName,
        flavorDisplayName: flavorInfo?.singular_display_name ?? null,
        flavorDescription: flavorInfo?.description ?? null,
        properties,
        relationships,
        incomingRelationships,
    };
});

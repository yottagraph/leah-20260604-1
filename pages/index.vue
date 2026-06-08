<template>
    <div class="d-flex flex-column fill-height entity-explorer">
        <div class="flex-shrink-0 pa-4 pb-2">
            <PageHeader title="Entity Explorer" icon="mdi-graph-outline" />
        </div>

        <div class="flex-grow-1 overflow-y-auto pa-4 pt-2">
            <div class="explorer-container">
                <v-card class="mb-4">
                    <v-card-text class="pa-4">
                        <v-text-field
                            v-model="searchInput"
                            label="Find an entity"
                            placeholder="e.g. Japan, India, Yen, Rupee…"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            hide-details
                            autofocus
                            :loading="searching"
                            @keyup.enter="runSearch(true)"
                            @click:clear="clearSearch"
                        />

                        <v-alert
                            v-if="searchError"
                            type="error"
                            variant="tonal"
                            density="compact"
                            class="mt-3"
                        >
                            {{ searchError }}
                        </v-alert>

                        <div v-if="matches.length" class="mt-4">
                            <div class="text-caption text-medium-emphasis mb-2">
                                {{ matches.length }} match{{ matches.length === 1 ? '' : 'es' }} —
                                click one to explore
                            </div>
                            <div class="d-flex flex-wrap ga-2">
                                <v-chip
                                    v-for="m in matches"
                                    :key="m.neid"
                                    :color="selected?.neid === m.neid ? 'primary' : undefined"
                                    :variant="selected?.neid === m.neid ? 'flat' : 'tonal'"
                                    clickable
                                    @click="selectEntity(m)"
                                >
                                    <span class="font-weight-medium">{{ m.name }}</span>
                                    <span class="ml-2 text-caption flavor-tag">
                                        {{ m.flavor }}
                                    </span>
                                </v-chip>
                            </div>
                        </div>

                        <v-empty-state
                            v-else-if="hasSearched && !searching"
                            headline="No matches"
                            text="Try a different name or check for typos."
                            icon="mdi-database-search"
                            class="mt-3"
                            density="compact"
                        />
                    </v-card-text>
                </v-card>

                <template v-if="selected">
                    <v-card class="mb-4 entity-card">
                        <v-card-text class="pa-4">
                            <div class="d-flex align-start justify-space-between flex-wrap ga-3">
                                <div class="flex-grow-1" style="min-width: 0">
                                    <h2 class="text-h5 font-weight-medium text-truncate">
                                        {{ selected.name }}
                                    </h2>
                                    <div
                                        v-if="schema?.flavorDescription"
                                        class="text-body-2 text-medium-emphasis mt-1"
                                    >
                                        {{ schema.flavorDescription }}
                                    </div>
                                    <div class="text-caption text-medium-emphasis mt-2 neid-line">
                                        <span class="opacity-60">NEID</span>
                                        <code class="ml-2">{{ selected.neid }}</code>
                                    </div>
                                </div>
                                <v-chip color="primary" variant="tonal" size="default">
                                    <v-icon start size="small">mdi-shape</v-icon>
                                    {{ schema?.flavorDisplayName || selected.flavor }}
                                </v-chip>
                            </div>
                        </v-card-text>
                    </v-card>

                    <div v-if="schemaLoading" class="text-center py-8">
                        <v-progress-circular indeterminate color="primary" />
                        <div class="text-medium-emphasis mt-3">
                            Loading schema for {{ selected.flavor }}…
                        </div>
                    </div>

                    <v-alert v-else-if="schemaError" type="error" variant="tonal" density="compact">
                        {{ schemaError }}
                    </v-alert>

                    <template v-else-if="schema">
                        <PropertySection
                            v-if="schema.properties.length"
                            title="Properties"
                            icon="mdi-tag-multiple-outline"
                            :items="schema.properties"
                            :neid="selected.neid"
                            :loading-uid="loadingUid"
                            :expanded-uid="expandedUid"
                            :values-cache="valuesCache"
                            @select="loadValues"
                            class="mb-4"
                        />
                        <PropertySection
                            v-if="relationshipItems.length"
                            title="Relationships"
                            icon="mdi-graph"
                            :items="relationshipItems"
                            :neid="selected.neid"
                            :loading-uid="loadingUid"
                            :expanded-uid="expandedUid"
                            :values-cache="valuesCache"
                            @select="loadValues"
                            @navigate="navigateToEntity"
                        />

                        <v-empty-state
                            v-if="!schema.properties.length && !relationshipItems.length"
                            headline="No properties or relationships"
                            text="The schema defines no fields for this flavor yet."
                            icon="mdi-database-off"
                        />
                    </template>
                </template>

                <v-empty-state
                    v-else-if="!hasSearched && !searching"
                    headline="Search the Lovelace knowledge graph"
                    text="Type the name of an organization, person, location, or other entity above. Pick a match to see its properties and relationships."
                    icon="mdi-database-search"
                    class="mt-8"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import PropertySection from '~/components/PropertySection.vue';
    import type {
        EntityMatch,
        FlavorSchema,
        SchemaProperty,
        ValueItem,
        ValuesPayload,
    } from '~/composables/useEntityExplorer';

    const searchInput = ref('');
    const searching = ref(false);
    const matches = ref<EntityMatch[]>([]);
    const hasSearched = ref(false);
    const searchError = ref<string | null>(null);

    const selected = ref<EntityMatch | null>(null);
    const schema = ref<FlavorSchema | null>(null);
    const schemaLoading = ref(false);
    const schemaError = ref<string | null>(null);

    // Cache schema responses keyed by flavor to avoid re-fetching when the
    // user jumps between entities of the same type.
    const schemaCache = new Map<string, FlavorSchema>();

    // Cache property values keyed by `${neid}::${uid}`.
    const valuesCache = reactive<Record<string, ValuesPayload>>({});
    const loadingUid = ref<string | null>(null);
    const expandedUid = ref<string | null>(null);

    // Outgoing + incoming relationships shown together in the Relationships
    // section; the per-item `direction` distinguishes them in the UI.
    const relationshipItems = computed<SchemaProperty[]>(() => {
        if (!schema.value) return [];
        return [...schema.value.relationships, ...schema.value.incomingRelationships];
    });

    let searchToken = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    watch(searchInput, (val) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        const q = (val ?? '').trim();
        if (!q) {
            matches.value = [];
            hasSearched.value = false;
            searchError.value = null;
            return;
        }
        if (q.length < 2) return;
        debounceTimer = setTimeout(() => runSearch(false), 250);
    });

    async function runSearch(_explicit: boolean) {
        const q = searchInput.value?.trim();
        if (!q) return;
        const token = ++searchToken;
        searching.value = true;
        searchError.value = null;
        try {
            const res = await $fetch<{ matches: EntityMatch[] }>('/api/entity/search', {
                params: { q, maxResults: 8 },
            });
            if (token !== searchToken) return;
            matches.value = res.matches ?? [];
            hasSearched.value = true;
        } catch (err: any) {
            if (token !== searchToken) return;
            matches.value = [];
            hasSearched.value = true;
            searchError.value =
                err?.statusMessage || err?.data?.statusMessage || err?.message || 'Search failed';
        } finally {
            if (token === searchToken) searching.value = false;
        }
    }

    function clearSearch() {
        searchInput.value = '';
        matches.value = [];
        hasSearched.value = false;
        searchError.value = null;
    }

    async function selectEntity(m: EntityMatch) {
        if (selected.value?.neid === m.neid) return;
        selected.value = m;
        expandedUid.value = null;
        await loadSchemaForFlavor(m.flavor);
    }

    // Load a related entity (clicked inside a relationship's values) as the new
    // target. Its flavor isn't known from the link alone, so resolve it first.
    async function navigateToEntity(item: ValueItem) {
        const neid = item.value;
        if (!neid || selected.value?.neid === neid) return;

        searchError.value = null;
        selected.value = { neid, name: item.label, flavor: '', score: 0 };
        expandedUid.value = null;
        schema.value = null;
        schemaError.value = null;
        schemaLoading.value = true;

        let resolved: { neid: string; name: string; flavor: string };
        try {
            resolved = await $fetch<{ neid: string; name: string; flavor: string }>(
                '/api/entity/resolve',
                { params: { neid, name: item.label } }
            );
        } catch (err: any) {
            schemaLoading.value = false;
            schemaError.value =
                err?.statusMessage ||
                err?.data?.statusMessage ||
                err?.message ||
                'Failed to load this entity';
            return;
        }

        selected.value = {
            neid: resolved.neid,
            name: resolved.name || item.label,
            flavor: resolved.flavor,
            score: 0,
        };
        schemaLoading.value = false;

        if (!resolved.flavor) {
            schemaError.value =
                "Couldn't determine this entity's type, so its schema can't be loaded.";
            return;
        }
        await loadSchemaForFlavor(resolved.flavor);
    }

    async function loadSchemaForFlavor(flavor: string) {
        if (!flavor) {
            schema.value = null;
            schemaError.value = 'Entity has no flavor associated with it.';
            return;
        }
        const cached = schemaCache.get(flavor);
        if (cached) {
            schema.value = cached;
            schemaError.value = null;
            return;
        }
        schemaLoading.value = true;
        schemaError.value = null;
        schema.value = null;
        try {
            const res = await $fetch<FlavorSchema>('/api/entity/schema', {
                params: { flavor },
            });
            schemaCache.set(flavor, res);
            schema.value = res;
        } catch (err: any) {
            schemaError.value =
                err?.statusMessage ||
                err?.data?.statusMessage ||
                err?.message ||
                'Failed to load schema for this entity';
        } finally {
            schemaLoading.value = false;
        }
    }

    async function loadValues(prop: SchemaProperty) {
        if (!selected.value) return;
        const cacheKey = `${selected.value.neid}::${prop.uid}`;

        // Toggle collapse when clicking the same item again.
        if (expandedUid.value === prop.uid) {
            expandedUid.value = null;
            return;
        }

        expandedUid.value = prop.uid;

        if (valuesCache[cacheKey]) return;

        loadingUid.value = prop.uid;
        try {
            const res = await $fetch<ValuesPayload>('/api/entity/values', {
                params: {
                    neid: selected.value.neid,
                    pid: prop.pid,
                    type: prop.type,
                    ...(prop.direction === 'incoming' ? { direction: 'incoming' } : {}),
                },
            });
            valuesCache[cacheKey] = res;
        } catch (err: any) {
            valuesCache[cacheKey] = {
                type: prop.type,
                items: [],
                totalCount: 0,
                error:
                    err?.statusMessage ||
                    err?.data?.statusMessage ||
                    err?.message ||
                    'Failed to load values',
            };
        } finally {
            if (loadingUid.value === prop.uid) loadingUid.value = null;
        }
    }
</script>

<style scoped>
    .entity-explorer {
        background: var(--lv-bg, transparent);
    }

    .explorer-container {
        max-width: 1080px;
        margin: 0 auto;
    }

    .flavor-tag {
        opacity: 0.7;
        font-family: var(--font-mono);
        font-size: 0.7rem;
    }

    .neid-line code {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.04);
    }

    .entity-card {
        border-color: rgba(63, 234, 0, 0.25);
    }
</style>

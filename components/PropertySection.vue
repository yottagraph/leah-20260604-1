<template>
    <v-card>
        <v-card-text class="pa-0">
            <div class="section-header d-flex align-center pa-3">
                <v-icon :icon="icon" class="mr-2" color="primary" />
                <span class="text-h6 font-weight-medium">{{ title }}</span>
                <v-chip class="ml-2" size="x-small" variant="tonal">
                    {{ items.length }}
                </v-chip>
                <v-spacer />
                <v-text-field
                    v-model="filterText"
                    placeholder="Filter…"
                    prepend-inner-icon="mdi-filter-variant"
                    hide-details
                    density="compact"
                    clearable
                    style="max-width: 280px"
                />
            </div>

            <v-divider />

            <div class="items-scroll">
                <v-list density="compact" class="py-0">
                    <template v-for="item in visibleItems" :key="item.pid">
                        <v-list-item
                            :active="expandedPid === item.pid"
                            class="property-item"
                            @click="$emit('select', item)"
                        >
                            <template v-slot:prepend>
                                <v-icon
                                    :icon="
                                        expandedPid === item.pid
                                            ? 'mdi-chevron-down'
                                            : 'mdi-chevron-right'
                                    "
                                    size="small"
                                />
                            </template>
                            <v-list-item-title class="font-monospace prop-name">
                                {{ item.name }}
                            </v-list-item-title>
                            <template v-slot:append>
                                <div class="d-flex align-center ga-1">
                                    <v-chip
                                        v-if="item.targetFlavors?.length"
                                        size="x-small"
                                        variant="tonal"
                                        color="secondary"
                                    >
                                        <v-icon start size="x-small">mdi-arrow-right-thin</v-icon>
                                        {{ item.targetFlavors.join(', ') }}
                                    </v-chip>
                                    <v-chip size="x-small" variant="tonal" class="type-chip">
                                        {{ shortType(item.type) }}
                                    </v-chip>
                                </div>
                            </template>
                        </v-list-item>

                        <v-expand-transition>
                            <div v-if="expandedPid === item.pid" class="values-block">
                                <div
                                    v-if="loadingPid === item.pid"
                                    class="d-flex align-center pa-3"
                                >
                                    <v-progress-circular
                                        indeterminate
                                        size="16"
                                        width="2"
                                        color="primary"
                                    />
                                    <span class="ml-2 text-caption text-medium-emphasis">
                                        Querying values…
                                    </span>
                                </div>
                                <template v-else>
                                    <ValuesDisplay :payload="valuesCache[cacheKeyFor(item.pid)]" />
                                </template>
                            </div>
                        </v-expand-transition>

                        <v-divider />
                    </template>
                </v-list>

                <v-empty-state
                    v-if="!visibleItems.length"
                    headline="Nothing matches"
                    text="Adjust the filter to see more entries."
                    icon="mdi-filter-off-outline"
                    density="compact"
                />
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
    import ValuesDisplay from '~/components/ValuesDisplay.vue';
    import type { SchemaProperty, ValuesPayload } from '~/composables/useEntityExplorer';

    interface Props {
        title: string;
        icon: string;
        items: SchemaProperty[];
        neid: string;
        expandedPid: string | null;
        loadingPid: string | null;
        valuesCache: Record<string, ValuesPayload>;
    }

    const props = defineProps<Props>();
    defineEmits<{ (e: 'select', item: SchemaProperty): void }>();

    const filterText = ref('');

    const visibleItems = computed(() => {
        const f = filterText.value?.trim().toLowerCase();
        if (!f) return props.items;
        return props.items.filter((p) => p.name.toLowerCase().includes(f));
    });

    function cacheKeyFor(pid: string) {
        return `${props.neid}::${pid}`;
    }

    function shortType(type: string) {
        // Trim the `data_` prefix the QS uses on every property type.
        return type.replace(/^data_/, '');
    }
</script>

<style scoped>
    .section-header {
        background: rgba(255, 255, 255, 0.02);
    }

    .items-scroll {
        max-height: 480px;
        overflow-y: auto;
    }

    .property-item {
        min-height: 44px;
        cursor: pointer;
    }

    .property-item :deep(.v-list-item__prepend) {
        opacity: 0.6;
    }

    .prop-name {
        font-family: var(--font-mono);
        font-size: 0.85rem;
    }

    .type-chip {
        font-family: var(--font-mono);
        opacity: 0.7;
    }

    .values-block {
        background: rgba(255, 255, 255, 0.02);
        border-left: 2px solid var(--v-theme-primary, #3fea00);
    }
</style>

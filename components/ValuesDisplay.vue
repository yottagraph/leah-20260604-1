<template>
    <div class="pa-3">
        <v-alert v-if="payload?.error" type="error" variant="tonal" density="compact">
            {{ payload.error }}
        </v-alert>

        <template v-else-if="payload">
            <v-empty-state
                v-if="!payload.items.length"
                headline="No values"
                text="The knowledge graph has no data for this property on this entity."
                icon="mdi-circle-off-outline"
                density="compact"
            />

            <template v-else>
                <div class="d-flex flex-column ga-1">
                    <div
                        v-for="(item, idx) in payload.items"
                        :key="`${item.value}-${idx}`"
                        class="value-row d-flex align-center ga-2"
                        :class="{ 'value-row--link': isRef }"
                        :role="isRef ? 'button' : undefined"
                        @click="isRef && $emit('navigate', item)"
                    >
                        <v-icon
                            :icon="isRef ? 'mdi-link-variant' : 'mdi-circle-small'"
                            size="small"
                            :color="isRef ? 'secondary' : undefined"
                        />
                        <span class="value-label">{{ item.label }}</span>
                        <span v-if="isRef && item.label !== item.value" class="value-neid">
                            {{ item.value }}
                        </span>
                        <v-icon
                            v-if="isRef"
                            icon="mdi-arrow-right-circle-outline"
                            size="x-small"
                            class="value-go ml-auto"
                        />
                    </div>
                </div>

                <div
                    v-if="payload.totalCount > payload.items.length"
                    class="text-caption text-medium-emphasis mt-2"
                >
                    Showing {{ payload.items.length }} of {{ payload.totalCount }} unique value{{
                        payload.totalCount === 1 ? '' : 's'
                    }}
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
    import type { ValueItem, ValuesPayload } from '~/composables/useEntityExplorer';

    const props = defineProps<{ payload: ValuesPayload | undefined }>();
    defineEmits<{ (e: 'navigate', item: ValueItem): void }>();

    // Relationship values are entity references the user can navigate into.
    const isRef = computed(() => props.payload?.type === 'data_nindex');
</script>

<style scoped>
    .value-row {
        padding: 4px 0;
    }

    .value-row--link {
        cursor: pointer;
        border-radius: 4px;
        padding-left: 4px;
        padding-right: 4px;
        margin: 0 -4px;
        transition: background 0.12s ease;
    }

    .value-row--link:hover {
        background: rgba(63, 234, 0, 0.08);
    }

    .value-go {
        opacity: 0;
        transition: opacity 0.12s ease;
        color: var(--v-theme-primary, #3fea00);
    }

    .value-row--link:hover .value-go {
        opacity: 0.8;
    }

    .value-label {
        font-size: 0.9rem;
        word-break: break-word;
    }

    .value-neid {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        opacity: 0.5;
        margin-left: 4px;
    }
</style>

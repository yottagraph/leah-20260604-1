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
                    >
                        <v-icon
                            :icon="
                                payload.type === 'data_nindex'
                                    ? 'mdi-link-variant'
                                    : 'mdi-circle-small'
                            "
                            size="small"
                            :color="payload.type === 'data_nindex' ? 'secondary' : undefined"
                        />
                        <span class="value-label">{{ item.label }}</span>
                        <span
                            v-if="payload.type === 'data_nindex' && item.label !== item.value"
                            class="value-neid"
                        >
                            {{ item.value }}
                        </span>
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
    import type { ValuesPayload } from '~/composables/useEntityExplorer';

    defineProps<{ payload: ValuesPayload | undefined }>();
</script>

<style scoped>
    .value-row {
        padding: 4px 0;
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

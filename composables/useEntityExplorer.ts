/**
 * Shared types for the Entity Explorer page (`pages/index.vue`) and its
 * `PropertySection` component. Keeping them in a composable file lets the
 * page and the component import a single source of truth without
 * forcing a real Vue composable (there is no shared reactive state — the
 * page owns it all).
 */

export interface EntityMatch {
    neid: string;
    name: string;
    flavor: string;
    score: number;
}

export interface SchemaProperty {
    pid: string;
    name: string;
    type: string;
    targetFlavors?: string[];
}

export interface FlavorSchema {
    flavor: string;
    flavorDisplayName: string | null;
    flavorDescription: string | null;
    properties: SchemaProperty[];
    relationships: SchemaProperty[];
}

export interface ValueItem {
    value: string;
    label: string;
}

export interface ValuesPayload {
    type: string;
    items: ValueItem[];
    totalCount: number;
    error?: string;
}

// No runtime export needed — this file is a types-only module so it
// doesn't pollute Nuxt's auto-import scope with an unused composable.
export const __entityExplorerTypes = true;

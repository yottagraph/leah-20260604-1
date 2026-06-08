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
    /**
     * Stable identity within a section. For scalar properties and outgoing
     * relationships this is the `pid`; for incoming relationships it's
     * `${pid}:in` so the same relationship pid can appear in both directions
     * without colliding on expand/cache state.
     */
    uid: string;
    /**
     * Only set on relationship (`data_nindex`) items. `outgoing` = this entity
     * is the source (its property points at the target); `incoming` = this
     * entity is the target (other entities point at it via this relationship).
     */
    direction?: 'incoming' | 'outgoing';
    /** Flavors of the entities shown when expanded (target side for the given direction). */
    targetFlavors?: string[];
}

export interface FlavorSchema {
    flavor: string;
    flavorDisplayName: string | null;
    flavorDescription: string | null;
    properties: SchemaProperty[];
    /** Outgoing relationships: this flavor is the source. */
    relationships: SchemaProperty[];
    /** Incoming relationships: this flavor is the target of another entity's relationship. */
    incomingRelationships: SchemaProperty[];
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

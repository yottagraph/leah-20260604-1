# leah-20260604-1

## Vision

This app is a simple entity search. A user can enter an entity name, the entity is resolved, and the user sees the name of the entity and see properties and relationships associated with that flavor. The user can then click on a property/relationship and find the values associated with the entity. We show max 5 values. We try to optimize query time when deciding what to display.

## Status

Initial entity-explorer build complete. The home page (`/`) is the explorer
— search → resolve → flavor-scoped property/relationship list → click to
load up to 5 unique values per property.

## Modules

### Entity Explorer (`pages/index.vue`)

Single-page workflow that implements the entire vision:

1. **Search** — debounced (250 ms) name search that POSTs to
   `/api/entity/search` and renders the top 8 matches as clickable chips,
   each tagged with its flavor (organization, person, product, …).
2. **Resolve** — clicking a match selects it; we show the entity name,
   NEID, and flavor with description.
3. **Schema for the flavor** — once an entity is selected we fetch
   `/api/entity/schema?flavor=<flavor>` once per flavor (cached in
   memory). The response is split into two filterable lists: **Properties**
   (scalars — `data_cat`, `data_int`, `data_float`, `data_bool`) and
   **Relationships** (`data_nindex` references with their target flavors).
4. **Values on demand** — clicking a row hits
   `/api/entity/values?neid=…&pid=…&type=…`, deduplicates the response
   (the QS returns one row per `(eid, pid, efid)` source), caps at 5
   unique values, and renders them inline. For `data_nindex` rows we
   zero-pad to 20-char NEIDs and batch-resolve display names via
   `GET /entities/{neid}/name`. The card shows "Showing 5 of N" when the
   underlying set is larger.

### Query-time optimizations

- **Lazy fetching.** Property values are fetched only when a row is
  expanded — never up-front for the whole flavor (organization alone has
  ~440 properties).
- **Per-flavor schema cache.** The schema for each flavor is fetched
  once per session both on the server (module-level cache for the raw
  metadata) and on the client (Map keyed by flavor).
- **Per-(neid, pid) value cache.** Re-expanding a row is free.
- **Single-PID requests.** Each click sends one PID, so the response
  stays small and dedup is cheap.
- **64-bit-safe id handling.** Server routes use `qsParse()` to keep
  large PIDs intact through `JSON.parse` and interpolate the literal PID
  into the `pids` form value so big negatives (e.g.
  `-5294792805565584640` for `ticker_symbol`) survive.
- **Server-side proxying.** Every QS call is funneled through Nitro
  routes so the page stays focused on UI state and never touches the
  gateway URL or API key directly.

### Server API

| Route                                        | Purpose                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/entity/search?q=…`                 | Wraps `POST /entities/search`; returns `{ neid, name, flavor, score }` for the top matches. |
| `GET /api/entity/schema?flavor=…`            | Returns the `properties` and `relationships` defined on the requested flavor.               |
| `GET /api/entity/values?neid=…&pid=…&type=…` | Fetches up to 5 unique values; resolves linked-entity names for `data_nindex` types.        |

### Components

- `pages/index.vue` — the explorer page (search, selection, layout).
- `components/PropertySection.vue` — reusable list for either properties
  or relationships, with an inline filter input and expand-to-show-values
  rows.
- `components/ValuesDisplay.vue` — renders the 5-value payload, with
  link icons for relationship values and a "showing 5 of N" hint.
- `composables/useEntityExplorer.ts` — shared TypeScript types
  (`EntityMatch`, `FlavorSchema`, `SchemaProperty`, `ValuesPayload`).

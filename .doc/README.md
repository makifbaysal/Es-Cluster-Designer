# Elastic Calculator — documentation

## Purpose

Single-page tool to estimate Elasticsearch cluster capacity from user-supplied topology and index assumptions.

## Domain rules (heuristics)

- Heap per data node: `min(memoryPerNode * 0.5, 31)` GB
- Guideline max shards per node: `heapGb * 20`
- Total shards per index: `primary * (1 + replicas)`
- Replicated data volume: `primaryTotalSize * (1 + replicas)` per index
- Cluster overhead factor on stored data: `1.15`
- Shard size warnings: outside 10–50 GB; docs per shard critical above 200M
- Disk pressure: estimated usage on data nodes vs provisioned disk per node

## Persistence

- Key: `elastic-calculator-state-v1` in `localStorage`
- Stores `cluster` and `indices` JSON

## CSV import / export

- **Download CSV** writes `elastic-calculator-export.csv`: first block is **state** (`elastic-calculator-state-v1`, cluster row, index rows — see `buildStateCsv` / `parseStateCsv` in `csvState.ts`). After `---node-export---`, the previous node/metrics dump is appended for reference; **import only reads the state block** (lines before `---`).
- **Import CSV** loads cluster + indices from a file whose first line is `elastic-calculator-state-v1`. Mapping JSON per index is **not** included in CSV; imported indices get new ids. `generateIndexId` is exported from `storage.ts` for new index rows.

## Elasticsearch Cluster Connection

- `EsConnectionPanel` component handles cluster URL, auth (none / basic / apiKey), probe and connect flows
- On successful connect, `onConnectionChange` callback fires with `EsConnection { baseUrl, headers }` — lifted to App and shared with `MappingModal`
- **Cluster hints**: `fetchClusterHints` calls `/_cat/nodes?bytes=b&h=name,node.roles,ram.max,disk.total,heap.max` and parses node roles using both full names (`data`, `master`) and ES abbreviations (`d`, `m`, `data_hot`, etc.). Falls back to `/_cluster/stats` when `_cat/nodes` fails. Fills `dataNodeCount`, `masterNodeCount`, `memoryPerNode`, `totalDiskSize` in cluster config.
- **Index import**: `fetchCatIndices` → `catRowsToIndexConfigs` populates doc count, store size, primary/replica shard counts.

### Mapping Modal with live cluster data

When `EsConnection` is available (cluster connected), the mapping modal shows two extra buttons:

- **Load mapping from cluster**: calls `fetchIndexMappings` → `/{index}/_mapping`, extracts the `mappings` object and populates the JSON editor
- **Fetch live doc count**: calls `fetchIndexDocCount` → `/_cat/indices/{index}?h=docs.count`, shows a checkbox to switch between stored and live doc count for size estimation
- **Apply estimate**: if "use live doc count" is checked, applies updated `documentCount` to the index alongside `mapping` and `totalSize`

## UI

- Baklava components: inputs, tables, alerts, dialogs, accordions for indices
- Responsive grid: on wide viewports (≥960px) main layout is **1 : 2** (`1fr` / `2fr`) — configuration column left, results column right; stacked on narrow (same scrollable page)
- `.app-column` vertical flex gap aligns spacing between Cluster / Indices and Recommendations / Warnings / Node breakdown
- Mapping dialog: `--bl-dialog-width: min(94vw, 800px)` on `.mapping-dialog-root`
- Mapping JSON editor: Monaco Editor (`@monaco-editor/react`, `theme: vs`), JSON language, indent and bracket guides, line numbers. Toolbar: Baklava buttons Clear and Beautify; status line (line count + valid or fixed text `JSON not valid`). Editor chunk lazy-loaded when the dialog opens. Vite uses `vite-plugin-monaco-editor` with JSON and editor workers
- Section titles: Cluster, Indices, Recommendations, Limits and checks, Node breakdown, Index metrics
- Indices panel: accordion stack spacing (`.index-accordion-stack`); each index form uses `.index-form` as a **container** (`container-type: inline-size`): two columns only when the form is wide enough (`@container index-form (min-width: 480px)`), otherwise one column; grid uses `minmax(0, 1fr)` and `bl-input` hosts get `width: 100%` / `min-width: 0` to avoid horizontal overflow in narrow columns. Titled subsection “Primary shard data before replicas”, footer `.index-form-actions`. Baklava’s `bl-accordion-group` clears the bottom border on `:first-child` for stacking; when only one accordion exists, `bl-accordion:only-child` restores `--bl-accordion-border-bottom` and corner radii in `index.css`
- Node breakdown: `buildMasterNodeVisuals` maps `result.masterNodes`; `buildDataNodeVisuals` assigns primary shards round-robin across data nodes and replica copies on other nodes (heuristic). Grid order: **master** columns first (violet: badge, gradient caps/footer, matching shard strip and summary card tint), then **data** columns (teal/cyan: same structure with “Data” badge and `node N`). Shared layout: cluster-tone **Shards & replicas** strip, **Node summary** card, then primary/replica cards on data nodes only; yellow callout when a primary shard exceeds 28 GB; index metrics table below

# Elastic Calculator — documentation

## Purpose

Single-page tool to estimate Elasticsearch cluster capacity from user-supplied topology and index assumptions.

## Domain rules (heuristics)

- Heap per data node: `min(memoryPerNode * 0.5, 31)` GB
- Guideline max shards per node: `heapGb * 20`
- Total shards per index: `primary * (1 + replicas)`
- Replicated data volume: `primaryTotalSize * (1 + replicas)` per index
- Cluster overhead factor on stored data: base `1.15` (write-dominant `1.30`), further tuned by **workload profile** (`balanced` / `search_heavy` / `ingest_heavy`) via heap buffer ratios and a disk tuning multiplier (capped combined overhead ~1.45×)
- **Growth projection**: `growthGbPerDay × growthProjectionDays` is added to indexed data before disk and hot-tier heap math; ILM hot tier includes the same growth increment
- **Rough snapshot estimate**: repository size ≈ `(total data incl. growth × disk overhead) × 1.08`; duration heuristic ≈ size / 120 GB per hour
- Shard size warnings: outside 10–50 GB; docs per shard critical above 200M
- Disk pressure: estimated usage on data nodes vs provisioned disk per node

## Persistence

- Key: `elastic-calculator-state-v1` in `localStorage`
- Stores `cluster`, `indices`, optional `locale` (`en` | `tr`), optional `theme` (`light` | `dark`)
- Extended `ClusterConfig` fields: `workloadProfile`, `growthGbPerDay`, `growthProjectionDays`, `costUsdPerGbRamMonth`, `costUsdPerGbDiskMonth`, `costUsdPerDataNodeMonth` (defaults in `storage.ts`, CSV import/export). On **Cost**, `AdvancedPlanningForm` edits these as **local-only** state (`costPlanning` in `App.tsx`) seeded from the current workspace `cluster` when entering the tab; each comparison column merges that planning with workspace or snapshot topology via `mergeTopologyWithCostPlanning` in `costViewMerge.ts`, without updating persisted `cluster`. Monthly RAM/disk/node USD parts use `monthlyCostUsd.ts`

## CSV import / export

- **Download CSV** writes `elastic-calculator-export.csv`: first block is **state** (`elastic-calculator-state-v1`, cluster row, index rows — see `buildStateCsv` / `parseStateCsv` in `csvState.ts`). After `---node-export---`, the previous node/metrics dump is appended for reference; **import only reads the state block** (lines before `---`).
- **Import CSV** loads cluster + indices from a file whose first line is `elastic-calculator-state-v1`. Cluster row supports the legacy 5 columns or the extended header including workload and cost columns (see `CLUSTER_HEADER` in `csvState.ts`). Mapping JSON per index is **not** included in CSV; imported indices get new ids. `generateIndexId` is exported from `storage.ts` for new index rows.

## Elasticsearch Cluster Connection

- **Connect cluster** is opened from the header (`headerConnectCluster`); `EsConnectionModal` wraps `EsConnectionPanel` in a Baklava dialog (not an accordion). Same panel handles URL, auth (none / basic / apiKey), probe, and connect.
- After a successful connect, the user chooses what to pull: optional **cluster hints**, optional **ILM policies** and **index templates** (JSON cached in `ConfigurationSection` for index forms), radio **index list** (`none` / replace all / add missing), then **Fetch selected data** runs the chosen steps in order (hints, index sync, then ILM/templates if checked). Replace still uses a browser `confirm` before destructive overwrite.
- On successful connect, `onConnectionChange` fires with `EsConnection { baseUrl, headers }` — lifted to App and shared with `MappingModal` and each `IndexForm` (via `IndexList`).
- **Cluster hints**: `fetchClusterHints` calls `/_cat/nodes?bytes=b&h=name,node.roles,ram.max,disk.total,heap.max` and parses node roles using both full names (`data`, `master`) and ES abbreviations (`d`, `m`, `data_hot`, etc.). Falls back to `/_cluster/stats` when `_cat/nodes` fails. Fills `dataNodeCount`, `masterNodeCount`, `memoryPerNode`, `totalDiskSize` in cluster config.
- **Index import**: `fetchCatIndices` → `catRowsToIndexConfigs` populates doc count, store size, primary/replica shard counts.
- **ILM / index templates**: still fetched from the connect modal when selected; **per-index** apply is in `IndexForm` (`listIlmPolicyNamesFromRaw`, `extractMappingsJsonFromIndexTemplateResponse`). The old **Cluster data** accordion (settings, `_cat/allocation`, shards, component templates, snapshot repos UI) was removed; `calculateCluster` optional `ClusterLimitsHint` from `/_cluster/settings` is no longer set from the UI.

### Mapping Modal with live cluster data

When `EsConnection` is available (cluster connected), the mapping modal shows two extra buttons:

- **Load mapping from cluster**: calls `fetchIndexMappings` → `/{index}/_mapping`, extracts the `mappings` object and populates the JSON editor
- **Fetch live doc count**: calls `fetchIndexDocCount` → `/_cat/indices/{index}?h=docs.count`, shows a checkbox to switch between stored and live doc count for size estimation
- **Apply estimate**: if "use live doc count" is checked, applies updated `documentCount` to the index alongside `mapping` and `totalSize`

### i18n and theme

- `I18nProvider` + `useI18n()` in `src/i18n/`; `AppTopNav` uses `<select>` dropdowns for theme (light/dark) and locale (EN/TR). **Designer**, **Compare**, and **Cost** are plain text page links (`AppViewNav`, not Baklava buttons) next to the brand. The left brand text is fixed as **Elastic Cluster Designer** (not translated). `document.documentElement.dataset.theme` drives `[data-theme="dark"]` overrides in `index.css`, including Baklava `bl-alert` semantic contrast backgrounds (`--bl-color-*-contrast`) so recommendation and limit alerts stay readable on dark UI.
- Field-level explanations: `BaklavaInputWithInfoHint` wraps `bl-input` with no extra chrome: **pointerdown** on the field opens an anchored popover (`.field-info-popover--anchored`) with the hint text; **focusout** when the control is no longer `:focus-within` dismisses it. `useCloseOnOutsidePointer` uses `composedPath()` so clicks inside Baklava’s shadow DOM still count as “inside,” and it closes on outside **pointerdown** or **Escape**. `InfoHintInline` still uses a compact **info** button next to non-`bl-input` titles (ILM heading, etc.); its wrapper sets the same `--field-info-panel-*` tokens as `.field-with-info` so light-mode popovers stay opaque, and `.field-info-popover` uses fallbacks if a token is missing. Copy lives under `clusterHint*`, `indexHint*`, `costHint*`, and `esApiKeyHoverHint` in `translations.ts`.

## UI

- Baklava components: inputs, tables, alerts, dialogs, accordions for indices
- Responsive grid: on wide viewports (≥960px) main layout is **1 : 2** (`1fr` / `2fr`) — configuration column left, results column right; stacked on narrow (same scrollable page). **Cost** uses the same `.app-grid--compare` two-column layout as **Compare**: left sidebar has snapshot list (**Open in Designer** / **Delete**) plus `AdvancedPlanningForm` (summary hidden; numbers appear in `CostComparePanel`). Right column is `CostComparePanel` with `costColA` / `costColB` / `costColC` selects above a table of **cost-only** metrics (monthly USD total and RAM/disk/node subtotals from `monthlyCostUsd.ts`, data incl. growth GB, rough snapshot repo GB and duration). The main **Header** (CSV, snapshot, reset, connect) stays hidden on Cost. No live ES connection is required on this screen.
- **Compare** view uses `.app-grid--compare`: the left column is only the snapshot list (**Open in Designer** / **Delete**). Source `<select>`s (`compareColA` / `compareColB` / `compareColC` in `App.tsx`, optional third = `__none__` in `compareSources.ts`) live **above** the tables inside `ComparePanel`. `ComparePanel` resolves columns via `resolveCompareColumns`, runs `calculateCluster` per source, shows cluster metrics (including page cache vs hot data, `heapBreakdown.cacheRatio`, ILM tier disk usage % when tiers exist), **data** node slot tables (disk usage %, shards vs guideline %, GB/shard, traffic, absolutes from `NodeBreakdown`), then indices-by-name row groups. Snapshots remain newest-first, max 10 (`storage.ts`). No Cluster/Indices accordion or header on this page.
- Designer view: **`.app-grid`** keeps **Cluster / Indices** in the first column (`ConfigurationSection`). The second column is a single stack **`.designer-results-stack`**: **`DesignerSummaryColumn`** (Özet: RAM + cluster recommendations + cluster limits) first, then **`NodeBreakdownTable`** — no separate right column. In the summary column, **`RecommendationPanel`** `variant="summary"` uses **`summary-assessment`** (tone by **`ScalingAssessment`**) plus a **`summary-metric-grid`** row list (label left, value right) instead of stacked **`bl-tag`** pills; actionable alerts sit in **`heap-breakdown--reco-callout`**.
- Index-scoped limits and shard recommendations: **`WarningItem.indexId`** / **`RecommendationItem.indexId`** are set in **`limitChecker`** (per-index shard/doc checks) and **`recommender`** (shard sizing hints). **`AppMain`** builds **`IndexInsightBuckets`** maps; **`WarningPanel`** / **`RecommendationPanel`** show only items **without** `indexId` (cluster-wide). **`IndexList`** uses **`bl-accordion`** `slot="caption"` for the index name plus a compact badge (count; critical styling if any linked warning is critical); expanding the accordion shows **`IndexForm`** then index-level **`BaklavaAlert`** lists under **`index-insights`**.
- Mapping dialog: `--bl-dialog-width: min(94vw, 800px)` on `.mapping-dialog-root`
- Mapping JSON editor: Monaco Editor (`@monaco-editor/react`, `theme: vs`), JSON language, indent and bracket guides, line numbers. Toolbar: Baklava buttons Clear and Beautify; status line (line count + valid or fixed text `JSON not valid`). Editor chunk lazy-loaded when the dialog opens. Vite uses `vite-plugin-monaco-editor` with JSON and editor workers
- Section titles: Cluster, Indices, and (when locale is TR) Turkish strings for Recommendations, Limits and checks, Node breakdown, Index metrics; dynamic recommender/limit messages stay in their source language; index names and ES-oriented chip labels (shards, replicas, read, write, docs, etc.) stay as in the UI code
- Indices panel: accordion stack spacing (`.index-accordion-stack`); each index form uses `.index-form` as a **container** (`container-type: inline-size`): two columns only when the form is wide enough (`@container index-form (min-width: 480px)`), otherwise one column; grid uses `minmax(0, 1fr)` and `bl-input` hosts get `width: 100%` / `min-width: 0` to avoid horizontal overflow in narrow columns. Titled subsection “Primary shard data before replicas”, footer `.index-form-actions`. Baklava’s `bl-accordion-group` clears the bottom border on `:first-child` for stacking; when only one accordion exists, `bl-accordion:only-child` restores `--bl-accordion-border-bottom` and corner radii in `index.css`
- Node breakdown: `buildMasterNodeVisuals` maps `result.masterNodes`; `buildDataNodeVisuals` assigns primary shards round-robin across data nodes and replica copies on other nodes (heuristic). Grid order: **master** columns first (violet: badge, gradient caps/footer, matching shard strip and summary card tint), then **data** columns (teal/cyan: same structure with “Data” badge and `node N`). Shared layout: cluster-tone **Shards & replicas** strip, **Node summary** card, then primary/replica cards on data nodes only; yellow callout when a primary shard exceeds 28 GB; index metrics table below. When at least one master column exists, **Hide master nodes** (`nbHideMasterNodes`) filters master columns out of the horizontal grid; if that leaves no columns (masters-only topology), `nbHideMastersEmpty` explains how to show masters again

import { Fragment, useMemo } from "react";
import type {
  CalculationResult,
  ClusterConfig,
  IndexConfig,
  NodeBreakdown,
  Snapshot,
} from "../types";
import { BaklavaAlert } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";
import { calculateCluster } from "../utils/calculator";
import { COMPARE_NONE, COMPARE_WORKSPACE, resolveCompareColumns } from "../utils/compareSources";

type Props = {
  workspaceCluster: ClusterConfig;
  workspaceIndices: IndexConfig[];
  snapshots: Snapshot[];
  colA: string;
  colB: string;
  colC: string;
  setCompareColA: (id: string) => void;
  setCompareColB: (id: string) => void;
  setCompareColC: (id: string) => void;
};

type CellRank = "best" | "worst" | "mid" | "eq" | "na";

type MetricDef = {
  key: string;
  label: string;
  values: string[];
  nums: number[] | null;
  lowerIsBetter?: boolean;
};

function rankNumericCells(values: number[], lowerIsBetter: boolean): CellRank[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(min - max) < 1e-9) return values.map(() => "eq");
  return values.map((v) => {
    if (lowerIsBetter) {
      if (Math.abs(v - min) < 1e-9) return "best";
      if (Math.abs(v - max) < 1e-9) return "worst";
      return "mid";
    }
    if (Math.abs(v - max) < 1e-9) return "best";
    if (Math.abs(v - min) < 1e-9) return "worst";
    return "mid";
  });
}

function pickIndex(indices: IndexConfig[], name: string): IndexConfig | null {
  return indices.find((i) => i.name === name) ?? null;
}

function cellsFieldRowDiff<T>(
  cells: (T | null)[],
  fmt: (item: T) => string
): boolean {
  const tokens = cells.map((c) => (c === null ? "\u0000missing" : fmt(c)));
  return new Set(tokens).size > 1;
}

function cellsNodeRowDiff(
  cells: (NodeBreakdown | null)[],
  results: CalculationResult[],
  fmt: (n: NodeBreakdown, r: CalculationResult) => string
): boolean {
  const tokens = cells.map((c, i) =>
    c === null ? "\u0000missing" : fmt(c, results[i])
  );
  return new Set(tokens).size > 1;
}

function pickDataAt(result: CalculationResult, slot1Based: number): NodeBreakdown | null {
  return result.dataNodes[slot1Based - 1] ?? null;
}

const INDEX_COMPARE_ROWS: {
  key: string;
  labelKey: string;
  format: (i: IndexConfig) => string;
}[] = [
  {
    key: "pri",
    labelKey: "compareIdxAttrPrimary",
    format: (i) => String(i.primaryShardCount),
  },
  {
    key: "rep",
    labelKey: "compareIdxAttrReplicas",
    format: (i) => String(i.replicaShardCount),
  },
  {
    key: "size",
    labelKey: "compareIdxAttrStoreGb",
    format: (i) => i.totalSize.toFixed(2),
  },
  {
    key: "docs",
    labelKey: "compareIdxAttrDocs",
    format: (i) => i.documentCount.toLocaleString(),
  },
  {
    key: "write",
    labelKey: "compareIdxAttrWrite",
    format: (i) => String(i.writeRate),
  },
  {
    key: "read",
    labelKey: "compareIdxAttrRead",
    format: (i) => String(i.readRate),
  },
];

const DATA_NODE_COMPARE_ROWS: {
  key: string;
  labelKey: string;
  format: (n: NodeBreakdown, r: CalculationResult) => string;
}[] = [
  {
    key: "diskpct",
    labelKey: "compareNodeDiskUsagePct",
    format: (n) =>
      n.storageGb > 0
        ? `${Math.min(100, (n.dataStorageGb / n.storageGb) * 100).toFixed(1)}%`
        : "—",
  },
  {
    key: "shrpct",
    labelKey: "compareNodeShardsGuidelinePct",
    format: (n, r) =>
      r.maxShardsPerNode > 0
        ? `${Math.min(500, (n.shardCount / r.maxShardsPerNode) * 100).toFixed(1)}%`
        : "—",
  },
  {
    key: "dps",
    labelKey: "compareNodeDataGbPerShard",
    format: (n) =>
      n.shardCount > 0 ? (n.dataStorageGb / n.shardCount).toFixed(2) : "—",
  },
  {
    key: "wr",
    labelKey: "compareNodeWriteRate",
    format: (n) => n.writeRate.toFixed(1),
  },
  {
    key: "rd",
    labelKey: "compareNodeReadRate",
    format: (n) => n.readRate.toFixed(1),
  },
  {
    key: "sh",
    labelKey: "compareNodeShardCount",
    format: (n) => n.shardCount.toFixed(1),
  },
  {
    key: "ds",
    labelKey: "compareNodeDataStorageGb",
    format: (n) => n.dataStorageGb.toFixed(2),
  },
  {
    key: "st",
    labelKey: "compareNodeStorageGb",
    format: (n) => n.storageGb.toFixed(2),
  },
];

function formatScaling(
  v: CalculationResult["scalingAssessment"],
  t: (k: string) => string
): string {
  if (v === "optimal") return t("compareScalingOptimal");
  if (v === "underscale") return t("compareScalingUnderscale");
  return t("compareScalingOverscale");
}

function buildClusterMetrics(results: CalculationResult[], t: (k: string) => string): MetricDef[] {
  return [
    {
      key: "compareMetricScaling",
      label: t("compareMetricScaling"),
      values: results.map((r) => formatScaling(r.scalingAssessment, t)),
      nums: null,
    },
    {
      key: "compareMetricTotalShards",
      label: t("compareMetricTotalShards"),
      values: results.map((r) => String(r.totalShards)),
      nums: results.map((r) => r.totalShards),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricTotalPrimaryShards",
      label: t("compareMetricTotalPrimaryShards"),
      values: results.map((r) => String(r.totalPrimaryShards)),
      nums: results.map((r) => r.totalPrimaryShards),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricShardsPerNode",
      label: t("compareMetricShardsPerNode"),
      values: results.map((r) => r.shardsPerNode.toFixed(1)),
      nums: results.map((r) => r.shardsPerNode),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricHeapPerNode",
      label: t("compareMetricHeapPerNode"),
      values: results.map((r) => r.heapPerNodeGb.toFixed(2)),
      nums: results.map((r) => r.heapPerNodeGb),
      lowerIsBetter: false,
    },
    {
      key: "compareMetricGuidelineShards",
      label: t("compareMetricGuidelineShards"),
      values: results.map((r) => r.maxShardsPerNode.toFixed(0)),
      nums: results.map((r) => r.maxShardsPerNode),
      lowerIsBetter: false,
    },
    {
      key: "compareMetricDiskUsage",
      label: t("compareMetricDiskUsage"),
      values: results.map((r) => `${r.diskUsagePercent.toFixed(1)}%`),
      nums: results.map((r) => r.diskUsagePercent),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricEstDiskPct",
      label: t("compareMetricEstDiskPct"),
      values: results.map((r) => `${r.estimatedDiskUsagePercent.toFixed(1)}%`),
      nums: results.map((r) => r.estimatedDiskUsagePercent),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricIlmHotDiskPct",
      label: t("compareMetricIlmHotDiskPct"),
      values: results.map((r) =>
        r.ilmBreakdown.hot.nodeCount > 0
          ? `${r.ilmBreakdown.hot.diskUsagePercent.toFixed(1)}%`
          : "—"
      ),
      nums: null,
    },
    {
      key: "compareMetricIlmWarmDiskPct",
      label: t("compareMetricIlmWarmDiskPct"),
      values: results.map((r) =>
        r.ilmBreakdown.warm.nodeCount > 0
          ? `${r.ilmBreakdown.warm.diskUsagePercent.toFixed(1)}%`
          : "—"
      ),
      nums: null,
    },
    {
      key: "compareMetricIlmColdDiskPct",
      label: t("compareMetricIlmColdDiskPct"),
      values: results.map((r) =>
        r.ilmBreakdown.cold.nodeCount > 0
          ? `${r.ilmBreakdown.cold.diskUsagePercent.toFixed(1)}%`
          : "—"
      ),
      nums: null,
    },
    {
      key: "compareMetricDataGrowth",
      label: t("compareMetricDataGrowth"),
      values: results.map((r) => r.totalDataWithGrowthGb.toFixed(1)),
      nums: results.map((r) => r.totalDataWithGrowthGb),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricDataReplicas",
      label: t("compareMetricDataReplicas"),
      values: results.map((r) => r.totalDataWithReplicasGb.toFixed(1)),
      nums: results.map((r) => r.totalDataWithReplicasGb),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricGrowthExtra",
      label: t("compareMetricGrowthExtra"),
      values: results.map((r) => r.growthProjectedExtraGb.toFixed(1)),
      nums: results.map((r) => r.growthProjectedExtraGb),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricDiskOverhead",
      label: t("compareMetricDiskOverhead"),
      values: results.map((r) => `${r.diskOverheadFactor}×`),
      nums: results.map((r) => r.diskOverheadFactor),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricAvailableHeap",
      label: t("compareMetricAvailableHeap"),
      values: results.map((r) => r.heapBreakdown.availableGb.toFixed(1)),
      nums: results.map((r) => r.heapBreakdown.availableGb),
      lowerIsBetter: false,
    },
    {
      key: "compareMetricTotalHeapGb",
      label: t("compareMetricTotalHeapGb"),
      values: results.map((r) => r.heapBreakdown.totalHeapGb.toFixed(2)),
      nums: results.map((r) => r.heapBreakdown.totalHeapGb),
      lowerIsBetter: false,
    },
    {
      key: "compareMetricOsPageCache",
      label: t("compareMetricOsPageCache"),
      values: results.map((r) => r.heapBreakdown.osPageCacheGb.toFixed(1)),
      nums: results.map((r) => r.heapBreakdown.osPageCacheGb),
      lowerIsBetter: false,
    },
    {
      key: "compareMetricPageCacheCoverage",
      label: t("compareMetricPageCacheCoverage"),
      values: results.map((r) => {
        const { cacheRatio, hotDataPerNodeGb } = r.heapBreakdown;
        if (!Number.isFinite(cacheRatio) || hotDataPerNodeGb <= 0) return "—";
        return `${Math.min(100, cacheRatio * 100).toFixed(0)}%`;
      }),
      nums: null,
    },
    {
      key: "compareMetricTotalWriteRate",
      label: t("compareMetricTotalWriteRate"),
      values: results.map((r) => String(r.totalWriteRate)),
      nums: results.map((r) => r.totalWriteRate),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricTotalReadRate",
      label: t("compareMetricTotalReadRate"),
      values: results.map((r) => String(r.totalReadRate)),
      nums: results.map((r) => r.totalReadRate),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricRoughSnapGb",
      label: t("compareMetricRoughSnapGb"),
      values: results.map((r) => r.roughSnapshotRepoGb.toFixed(1)),
      nums: results.map((r) => r.roughSnapshotRepoGb),
      lowerIsBetter: true,
    },
    {
      key: "compareMetricRoughSnapHours",
      label: t("compareMetricRoughSnapHours"),
      values: results.map((r) => r.roughSnapshotDurationHours.toFixed(2)),
      nums: results.map((r) => r.roughSnapshotDurationHours),
      lowerIsBetter: true,
    },
  ];
}

function cellClass(rank: CellRank): string {
  if (rank === "best") return " compare-val--winner";
  if (rank === "worst") return " compare-val--loser";
  return "";
}

export function ComparePanel({
  workspaceCluster,
  workspaceIndices,
  snapshots,
  colA,
  colB,
  colC,
  setCompareColA,
  setCompareColB,
  setCompareColC,
}: Props) {
  const { t } = useI18n();

  const abOpts = useMemo(
    () => [
      { value: COMPARE_WORKSPACE, label: t("compareCurrentWorkspace") },
      ...snapshots.map((s) => ({
        value: s.id,
        label: `${s.label} — ${new Date(s.savedAt).toLocaleString()}`,
      })),
    ],
    [snapshots, t]
  );

  const cOpts = useMemo(
    () => [
      { value: COMPARE_NONE, label: t("compareColNone") },
      { value: COMPARE_WORKSPACE, label: t("compareCurrentWorkspace") },
      ...snapshots.map((s) => ({
        value: s.id,
        label: `${s.label} — ${new Date(s.savedAt).toLocaleString()}`,
      })),
    ],
    [snapshots, t]
  );

  const sources = useMemo(
    () =>
      resolveCompareColumns(
        colA,
        colB,
        colC,
        workspaceCluster,
        workspaceIndices,
        snapshots
      ),
    [colA, colB, colC, workspaceCluster, workspaceIndices, snapshots]
  );

  const sourceTitles = useMemo(
    () =>
      sources.map((s) =>
        s.id === COMPARE_WORKSPACE
          ? { title: t("compareCurrentWorkspace"), subtitle: t("compareCurrentWorkspaceHint") }
          : { title: s.title, subtitle: s.subtitle }
      ),
    [sources, t]
  );

  const results = useMemo(
    () =>
      sources.map((s) => calculateCluster(s.cluster, s.indices, undefined)),
    [sources]
  );

  const duplicateSources = useMemo(() => {
    const ids = sources.map((s) => s.id);
    return new Set(ids).size < ids.length;
  }, [sources]);

  const tableReady =
    snapshots.length > 0 && sources.length >= 2 && !duplicateSources;

  const metricRows = useMemo(
    () => (tableReady ? buildClusterMetrics(results, t) : []),
    [tableReady, results, t]
  );

  const indexNames = useMemo(() => {
    if (!tableReady) return [];
    const s = new Set<string>();
    sources.forEach((src) => src.indices.forEach((i) => s.add(i.name)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [tableReady, sources]);

  const maxDataSlots = useMemo(() => {
    if (!tableReady) return 0;
    return Math.max(0, ...results.map((r) => r.dataNodes.length));
  }, [tableReady, results]);

  const sourceBar =
    snapshots.length > 0 ? (
      <div className="compare-source-bar compare-source-bar--top">
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cmp-src-a">
            {t("compareSourceA")}
          </label>
          <select
            id="cmp-src-a"
            className="es-select compare-source-select"
            value={colA}
            onChange={(e) => setCompareColA(e.target.value)}
            aria-label={t("compareSourceA")}
          >
            {abOpts.map((o) => (
              <option key={`a-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cmp-src-b">
            {t("compareSourceB")}
          </label>
          <select
            id="cmp-src-b"
            className="es-select compare-source-select"
            value={colB}
            onChange={(e) => setCompareColB(e.target.value)}
            aria-label={t("compareSourceB")}
          >
            {abOpts.map((o) => (
              <option key={`b-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cmp-src-c">
            {t("compareSourceC")}
          </label>
          <select
            id="cmp-src-c"
            className="es-select compare-source-select"
            value={colC}
            onChange={(e) => setCompareColC(e.target.value)}
            aria-label={t("compareSourceC")}
          >
            {cOpts.map((o) => (
              <option key={`c-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    ) : null;

  return (
    <section className="panel compare-panel-out">
      <h2 className="panel-title">{t("compareMetricsTitle")}</h2>
      {sourceBar}
      {snapshots.length === 0 ? (
        <BaklavaAlert
          variant="info"
          caption={t("compareNoSnapshotsTitle")}
          description={t("compareNoSnapshotsBody")}
        />
      ) : null}
      {snapshots.length > 0 && sources.length < 2 ? (
        <BaklavaAlert
          variant="info"
          caption={t("compareNeedTwoSourcesTitle")}
          description={t("compareNeedTwoSourcesBody")}
        />
      ) : null}
      {snapshots.length > 0 && duplicateSources ? (
        <BaklavaAlert
          variant="warning"
          caption={t("compareDuplicateTitle")}
          description={t("compareDuplicateBody")}
        />
      ) : null}
      {tableReady ? (
        <>
          <div
            className="compare-table compare-table--dynamic"
            style={{ ["--compare-cols" as string]: String(sources.length) }}
          >
            <div className="compare-grid-row compare-grid-row--head">
              <div className="compare-label-col">{t("compareMetricCol")}</div>
              {sourceTitles.map((st, i) => (
                <div key={sources[i].id} className={`compare-val-col compare-val-col--${i}`}>
                  <span className="compare-snap-name">{st.title}</span>
                  <span className="compare-snap-date">{st.subtitle}</span>
                </div>
              ))}
            </div>
            {metricRows.map((row) => {
              const ranks =
                row.nums && typeof row.lowerIsBetter === "boolean"
                  ? rankNumericCells(row.nums, row.lowerIsBetter)
                  : null;
              return (
                <div key={row.key} className="compare-grid-row">
                  <div className="compare-label-col">{row.label}</div>
                  {row.values.map((v, i) => {
                    const rank = ranks ? ranks[i] ?? "na" : "na";
                    const rc =
                      rank === "na" || rank === "eq" || rank === "mid" ? "" : cellClass(rank);
                    return (
                      <div
                        key={`${row.key}-${sources[i].id}`}
                        className={`compare-val-col compare-val-col--${i}${rc}`}
                      >
                        {v}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {maxDataSlots > 0 ? (
            <>
              <h3 className="compare-index-section-title">{t("compareNodesDataTitle")}</h3>
              <p className="compare-index-section-desc">{t("compareNodesDataDesc")}</p>
              <div className="compare-index-wrap">
                <table className="compare-index-table">
                  <thead>
                    <tr>
                      <th>{t("compareNodeColSlot")}</th>
                      <th>{t("compareIdxColAttribute")}</th>
                      {sourceTitles.map((st, i) => (
                        <th key={`dh-${sources[i].id}`}>{st.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxDataSlots }, (_, idx) => idx + 1).map((slot) => {
                      const cells = results.map((r) => pickDataAt(r, slot));
                      const rowSpan = DATA_NODE_COMPARE_ROWS.length;
                      const slotLabel = t("compareNodeSlotData").replace("{n}", String(slot));
                      return (
                        <Fragment key={`d-${slot}`}>
                          {DATA_NODE_COMPARE_ROWS.map((fr, fi) => {
                            const rowDiff = cellsNodeRowDiff(cells, results, fr.format);
                            const displayVals = cells.map((c, i) =>
                              c ? fr.format(c, results[i]) : t("compareIdxMissing")
                            );
                            return (
                              <tr key={`d-${slot}-${fr.key}`}>
                                {fi === 0 ? (
                                  <td rowSpan={rowSpan} className="compare-index-name-cell">
                                    {slotLabel}
                                  </td>
                                ) : null}
                                <td className="compare-index-attr">{t(fr.labelKey)}</td>
                                {displayVals.map((val, ci) => (
                                  <td
                                    key={`d-${slot}-${fr.key}-${sources[ci].id}`}
                                    className={
                                      rowDiff
                                        ? "compare-index-td compare-index-td--diff"
                                        : "compare-index-td"
                                    }
                                  >
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <h3 className="compare-index-section-title">{t("compareIndicesByNameTitle")}</h3>
          <p className="compare-index-section-desc">{t("compareIndicesByNameDesc")}</p>
          <div className="compare-index-wrap">
            <table className="compare-index-table">
              <thead>
                <tr>
                  <th>{t("compareIdxColIndex")}</th>
                  <th>{t("compareIdxColAttribute")}</th>
                  {sourceTitles.map((st, i) => (
                    <th key={sources[i].id}>{st.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indexNames.map((name) => {
                  const cells = sources.map((src) => pickIndex(src.indices, name));
                  const rowSpan = INDEX_COMPARE_ROWS.length;
                  return (
                    <Fragment key={name}>
                      {INDEX_COMPARE_ROWS.map((fr, fi) => {
                        const rowDiff = cellsFieldRowDiff(cells, fr.format);
                        const displayVals = cells.map((c) =>
                          c ? fr.format(c) : t("compareIdxMissing")
                        );
                        return (
                          <tr key={`${name}-${fr.key}`}>
                            {fi === 0 ? (
                              <td rowSpan={rowSpan} className="compare-index-name-cell">
                                <code>{name}</code>
                              </td>
                            ) : null}
                            <td className="compare-index-attr">{t(fr.labelKey)}</td>
                            {displayVals.map((val, ci) => (
                              <td
                                key={`${name}-${fr.key}-${sources[ci].id}`}
                                className={
                                  rowDiff ? "compare-index-td compare-index-td--diff" : "compare-index-td"
                                }
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

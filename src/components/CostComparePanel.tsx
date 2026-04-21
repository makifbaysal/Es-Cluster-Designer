import { useMemo } from "react";
import type { ClusterConfig, IndexConfig, Snapshot } from "../types";
import { BaklavaAlert } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";
import { calculateCluster } from "../utils/calculator";
import { COMPARE_NONE, COMPARE_WORKSPACE, resolveCompareColumns } from "../utils/compareSources";
import { mergeTopologyWithCostPlanning } from "../utils/costViewMerge";
import { monthlyCostUsdComponents } from "../utils/monthlyCostUsd";

type Props = {
  workspaceCluster: ClusterConfig;
  workspaceIndices: IndexConfig[];
  snapshots: Snapshot[];
  colA: string;
  colB: string;
  colC: string;
  setColA: (id: string) => void;
  setColB: (id: string) => void;
  setColC: (id: string) => void;
  costPlanning: Partial<ClusterConfig>;
};

type CellRank = "best" | "worst" | "mid" | "eq" | "na";

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

function cellClass(rank: CellRank): string {
  if (rank === "best") return " compare-val--winner";
  if (rank === "worst") return " compare-val--loser";
  return "";
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CostComparePanel({
  workspaceCluster,
  workspaceIndices,
  snapshots,
  colA,
  colB,
  colC,
  setColA,
  setColB,
  setColC,
  costPlanning,
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
      sources.map((s) => {
        const merged = mergeTopologyWithCostPlanning(s.cluster, costPlanning);
        return calculateCluster(merged, s.indices, undefined);
      }),
    [sources, costPlanning]
  );

  const mergedClusters = useMemo(
    () => sources.map((s) => mergeTopologyWithCostPlanning(s.cluster, costPlanning)),
    [sources, costPlanning]
  );

  const duplicateSources = useMemo(() => {
    const ids = sources.map((s) => s.id);
    return new Set(ids).size < ids.length;
  }, [sources]);

  const tableReady =
    snapshots.length > 0 && sources.length >= 2 && !duplicateSources;

  const costRows = useMemo(() => {
    if (!tableReady) return [];
    const comps = mergedClusters.map((c) => monthlyCostUsdComponents(c));
    const monthlyNums = comps.map((c) => c.totalUsd);
    const ramNums = comps.map((c) => c.ramUsd);
    const diskNums = comps.map((c) => c.diskUsd);
    const nodeNums = comps.map((c) => c.nodeUsd);
    return [
      {
        key: "monthly",
        label: t("costCompareRowMonthly"),
        values: monthlyNums.map((n) => (n > 0 ? formatUsd(n) : "—")),
        nums: monthlyNums,
        lowerIsBetter: true,
      },
      {
        key: "ramusd",
        label: t("costCompareRowRamUsd"),
        values: ramNums.map((n) => (n > 0 ? formatUsd(n) : "—")),
        nums: null as number[] | null,
      },
      {
        key: "diskusd",
        label: t("costCompareRowDiskUsd"),
        values: diskNums.map((n) => (n > 0 ? formatUsd(n) : "—")),
        nums: null,
      },
      {
        key: "nodeusd",
        label: t("costCompareRowNodeUsd"),
        values: nodeNums.map((n) => (n > 0 ? formatUsd(n) : "—")),
        nums: null,
      },
      {
        key: "growthgb",
        label: t("dataWithGrowth"),
        values: results.map((r) => `${r.totalDataWithGrowthGb.toFixed(2)} GB`),
        nums: results.map((r) => r.totalDataWithGrowthGb),
        lowerIsBetter: true,
      },
      {
        key: "snaprepo",
        label: t("snapshotRough"),
        values: results.map((r) => `${r.roughSnapshotRepoGb.toFixed(2)} GB`),
        nums: results.map((r) => r.roughSnapshotRepoGb),
        lowerIsBetter: true,
      },
      {
        key: "snaph",
        label: t("snapshotHours"),
        values: results.map((r) => `${r.roughSnapshotDurationHours.toFixed(2)} h`),
        nums: results.map((r) => r.roughSnapshotDurationHours),
        lowerIsBetter: true,
      },
    ];
  }, [tableReady, mergedClusters, results, t]);

  const sourceBar =
    snapshots.length > 0 ? (
      <div className="compare-source-bar compare-source-bar--top">
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cost-cmp-a">
            {t("compareSourceA")}
          </label>
          <select
            id="cost-cmp-a"
            className="es-select compare-source-select"
            value={colA}
            onChange={(e) => setColA(e.target.value)}
            aria-label={t("compareSourceA")}
          >
            {abOpts.map((o) => (
              <option key={`ca-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cost-cmp-b">
            {t("compareSourceB")}
          </label>
          <select
            id="cost-cmp-b"
            className="es-select compare-source-select"
            value={colB}
            onChange={(e) => setColB(e.target.value)}
            aria-label={t("compareSourceB")}
          >
            {abOpts.map((o) => (
              <option key={`cb-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="compare-source-field">
          <label className="compare-source-label" htmlFor="cost-cmp-c">
            {t("compareSourceC")}
          </label>
          <select
            id="cost-cmp-c"
            className="es-select compare-source-select"
            value={colC}
            onChange={(e) => setColC(e.target.value)}
            aria-label={t("compareSourceC")}
          >
            {cOpts.map((o) => (
              <option key={`cc-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    ) : null;

  return (
    <section className="panel compare-panel-out">
      <h2 className="panel-title">{t("costCompareTitle")}</h2>
      {sourceBar}
      <p className="compare-index-section-desc">{t("costCompareIntro")}</p>
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
          {costRows.map((row) => {
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
        </>
      ) : null}
    </section>
  );
}

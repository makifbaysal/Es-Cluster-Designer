import { useMemo, useState } from "react";
import type {
  CalculationResult,
  ClusterConfig,
  IndexConfig,
  UiTheme,
} from "../types";
import { useI18n } from "../i18n/I18nContext";
import {
  BaklavaAlert,
  BaklavaProgressIndicator,
  BaklavaTable,
  BaklavaTableBody,
  BaklavaTableCell,
  BaklavaTableHeader,
  BaklavaTableHeaderCell,
  BaklavaTableRow,
} from "../baklava/components";
import { MetricChip } from "./MetricChip";
import {
  buildDataNodeVisuals,
  buildMasterNodeVisuals,
  clusterVisualSummary,
} from "../utils/nodeVisualization";

type Props = {
  theme: UiTheme;
  result: CalculationResult;
  cluster: ClusterConfig;
  indices: IndexConfig[];
};

const SHARD_WARN_GB = 28;

function ilmTierVisual(theme: UiTheme, tier: "hot" | "warm" | "cold") {
  const light = {
    hot: { bg: "#fff7ed", border: "#fb923c", label: "#c2410c" },
    warm: { bg: "#faf5ff", border: "#a78bfa", label: "#6d28d9" },
    cold: { bg: "#eff6ff", border: "#60a5fa", label: "#1d4ed8" },
  };
  const dark = {
    hot: { bg: "#2a1f14", border: "#ea580c", label: "#fdba74" },
    warm: { bg: "#221528", border: "#9333ea", label: "#d8b4fe" },
    cold: { bg: "#0f172a", border: "#3b82f6", label: "#93c5fd" },
  };
  return (theme === "dark" ? dark : light)[tier];
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return "0";
  }
  if (n >= 1e9) {
    return `${(n / 1e9).toFixed(1)}b`;
  }
  if (n >= 1e6) {
    return `${(n / 1e6).toFixed(1)}m`;
  }
  if (n >= 1e3) {
    return `${(n / 1e3).toFixed(1)}k`;
  }
  return n.toFixed(1);
}

function formatGb(n: number): string {
  return `${n.toFixed(1)}GB`;
}

export function NodeBreakdownTable({ theme, result, cluster, indices }: Props) {
  const { t } = useI18n();
  const [hideMasterNodes, setHideMasterNodes] = useState(false);
  const allNodeColumns = useMemo(
    () => [
      ...buildMasterNodeVisuals(result),
      ...buildDataNodeVisuals(cluster, indices, result),
    ],
    [cluster, indices, result]
  );
  const visibleNodeColumns = useMemo(
    () =>
      hideMasterNodes
        ? allNodeColumns.filter((n) => n.nodeRole !== "master")
        : allNodeColumns,
    [allNodeColumns, hideMasterNodes]
  );
  const summary = useMemo(() => clusterVisualSummary(result), [result]);

  return (
    <section className="panel node-breakdown-panel">
      <h2 className="panel-title">{t("nbPanelTitle")}</h2>

      <div className="nb-cluster-bar">
        <div className="nb-cluster-title">{t("nbClusterTitle")}</div>
        <div className="nb-cluster-badges">
          <MetricChip
            tone="cluster"
            label="shards"
            value={String(summary.totalPrimaryShards)}
          />
          <MetricChip
            tone="cluster"
            label="replicas"
            value={String(summary.totalReplicaCopies)}
          />
          <MetricChip
            tone="cluster"
            label="data"
            value={formatGb(summary.totalDataGb)}
          />
        </div>
      </div>

      {allNodeColumns.some((n) => n.nodeRole === "master") && (
        <div className="nb-hide-masters-row">
          <label className="nb-hide-masters-label" htmlFor="nb-hide-master-nodes">
            <input
              id="nb-hide-master-nodes"
              type="checkbox"
              checked={hideMasterNodes}
              onChange={(e) => setHideMasterNodes(e.target.checked)}
            />
            {t("nbHideMasterNodes")}
          </label>
        </div>
      )}

      {allNodeColumns.length === 0 ? (
        <p className="nb-empty">{t("nbEmptyNodes")}</p>
      ) : visibleNodeColumns.length === 0 ? (
        <p className="nb-empty">{t("nbHideMastersEmpty")}</p>
      ) : (
        <div className="nb-node-grid-scroll">
        <div className="nb-node-grid">
          {visibleNodeColumns.map((node) => {
            const isMaster = node.nodeRole === "master";
            const roleClass = isMaster ? " nb-node-column--master" : " nb-node-column--data";
            const capTone = isMaster ? " nb-node-cap--master" : " nb-node-cap--data";
            return (
            <div
              key={node.nodeId}
              className={`nb-node-column${roleClass}`}
            >
              <div className={`nb-node-cap${capTone}`}>
                <span className="nb-node-cap-role">
                  {isMaster ? t("nbMasterRole") : t("nbDataRole")}
                </span>
                <span className="nb-node-cap-name">{node.displayLabel}</span>
              </div>
              <div
                className={`nb-node-shard-bar${isMaster ? " nb-node-shard-bar--master" : " nb-node-shard-bar--data"}`}
              >
                <div className="nb-node-shard-bar-title">{t("nbShardsReplicasTitle")}</div>
                <div className="nb-node-shard-bar-badges">
                  <MetricChip
                    tone="cluster"
                    label="shards"
                    value={String(node.primaryCount)}
                  />
                  <MetricChip
                    tone="cluster"
                    label="replicas"
                    value={String(node.replicaCount)}
                  />
                </div>
              </div>
              {!isMaster && (
                <div className="nb-node-metrics">
                  <div className="nb-block-label nb-block-label--node">
                    {t("nbNodeSummary")}
                  </div>
                  <div className="nb-node-metrics-card nb-node-metrics-card--data">
                    <div className="nb-node-metrics-chips">
                      <MetricChip
                        tone="read"
                        label="read"
                        value={`${formatCompact(node.readRate)}/s`}
                      />
                      <MetricChip
                        tone="write"
                        label="write"
                        value={`${formatCompact(node.writeRate)}/s`}
                      />
                      <MetricChip
                        tone="docs"
                        label="docs"
                        value={`~${formatCompact(node.approxDocs)}`}
                      />
                      <MetricChip
                        tone="size"
                        label="data"
                        value={formatGb(node.dataStorageGb)}
                      />
                      <MetricChip
                        tone="meta"
                        label="disk"
                        value={formatGb(node.storageGb)}
                      />
                      <MetricChip
                        tone="meta"
                        label="page cache"
                        value={formatGb(result.heapBreakdown.osPageCacheGb)}
                      />
                    </div>
                    {node.storageGb > 0 && (
                      <div className="nb-disk-progress">
                        <span className="nb-disk-progress-label">
                          {t("nbDiskPct")}{" "}
                          {Math.round((node.dataStorageGb / node.storageGb) * 100)}%
                        </span>
                        <BaklavaProgressIndicator
                          value={Math.round((node.dataStorageGb / node.storageGb) * 100)}
                          failed={(node.dataStorageGb / node.storageGb) >= 0.95}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div
                className={`nb-node-body${isMaster ? " nb-node-body--master" : " nb-node-body--data"}`}
              >
                {node.warnings.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {node.warnings.map((w, i) => (
                      <BaklavaAlert
                        key={i}
                        variant={w.level === "critical" ? "danger" : "warning"}
                        description={w.message}
                      />
                    ))}
                  </div>
                )}
                {isMaster && (
                  <BaklavaAlert
                    variant="info"
                    description={t("nbDedicatedMasterInfo")}
                  />
                )}
                {node.primaryShards.length > 0 && (
                  <div className="nb-primary-shards">
                    <div className="nb-block-label nb-block-label--primary">
                      {t("nbPrimaryShards")}
                    </div>
                    {node.primaryShards.map((p) => (
                      <div
                        key={p.id}
                        className="nb-shard-card nb-shard-card--primary"
                      >
                        <div className="nb-shard-card-title">{p.shardLabel}</div>
                        <div className="nb-shard-card-sub">{p.indexName}</div>
                        <div className="nb-shard-pills">
                          <MetricChip
                            tone="read"
                            label="read"
                            value={`${formatCompact(p.readPerSec)}/s`}
                          />
                          <MetricChip
                            tone="write"
                            label="write"
                            value={`${formatCompact(p.writePerSec)}/s`}
                          />
                          <MetricChip
                            tone="docs"
                            label="docs"
                            value={`~${formatCompact(p.docsPerShard)}`}
                          />
                          <MetricChip
                            tone="size"
                            label="size"
                            value={formatGb(p.shardSizeGb)}
                          />
                        </div>
                        {p.shardSizeGb > SHARD_WARN_GB && (
                          <BaklavaAlert
                            variant="warning"
                            description={t("nbShardTooLarge").replace(
                              "{n}",
                              String(SHARD_WARN_GB)
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {node.replicaShards.length > 0 && (
                  <div className="nb-replica-section">
                    <div className="nb-block-label nb-block-label--replica">
                      {t("nbReplicasSection")}
                    </div>
                    <div className="nb-replica-row">
                      {node.replicaShards.map((r) => (
                        <div
                          key={r.id}
                          className="nb-shard-card nb-shard-card--replica"
                        >
                          <div className="nb-shard-card-title nb-shard-card-title--replica">
                            {t("nbReplicaTitle")} ({r.sourceShardLabel})
                          </div>
                          <div className="nb-shard-pills nb-shard-pills--replica">
                            <MetricChip
                              tone="read"
                              label="read"
                              value={`${formatCompact(r.readPerSec)}/s`}
                            />
                            <MetricChip
                              tone="docs"
                              label="docs"
                              value={`~${formatCompact(r.docsPerShard)}`}
                            />
                            <MetricChip
                              tone="size"
                              label="size"
                              value={formatGb(r.dataGb)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`nb-node-cap nb-node-cap--footer${capTone}`}
              >
                <span className="nb-node-cap-role">
                  {isMaster ? t("nbMasterRole") : t("nbDataRole")}
                </span>
                <span className="nb-node-cap-name">{node.displayLabel}</span>
              </div>
            </div>
            );
          })}
        </div>
        </div>
      )}

      {result.ilmBreakdown.enabled && (
        <div className="nb-ilm-breakdown">
          <h3 className="nb-index-metrics-title">{t("nbIlmTierTitle")}</h3>
          <div className="nb-ilm-tiers">
            {(["hot", "warm", "cold"] as const).map((tier) => {
              const tierStats = result.ilmBreakdown[tier];
              if (tierStats.nodeCount === 0 && tier !== "hot") return null;
              const c = ilmTierVisual(theme, tier);
              return (
                <div
                  key={tier}
                  className="nb-ilm-tier-card"
                  style={{ background: c.bg, borderColor: c.border }}
                >
                  <div className="nb-ilm-tier-header" style={{ color: c.label }}>
                    {tier.toUpperCase()} {t("nbIlmTierSuffix")}
                  </div>
                  <div className="nb-ilm-tier-stats">
                    <span>
                      {tierStats.nodeCount} {t("nbNodesCount")}
                    </span>
                    <span>
                      {tierStats.usedDataGb.toFixed(1)} {t("nbGbUsed")}
                    </span>
                    <span>
                      {tierStats.totalDiskGb.toFixed(0)} {t("nbGbTotal")}
                    </span>
                  </div>
                  <BaklavaProgressIndicator
                    value={Math.round(tierStats.diskUsagePercent)}
                    failed={tierStats.diskUsagePercent >= 95}
                  />
                  <span className="nb-ilm-tier-pct">
                    {tierStats.diskUsagePercent.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="nb-index-metrics">
        <h3 className="nb-index-metrics-title">{t("nbIndexMetricsTitle")}</h3>
        <BaklavaTable>
          <BaklavaTableHeader>
            <BaklavaTableRow>
              <BaklavaTableHeaderCell>{t("nbIndexCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbShardsCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbShardSizeGbCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbDocsPerShardCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbDataReplicasGbCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbVectorFieldsCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbHnswGraphsCol")}</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>{t("nbVectorCpuFactorCol")}</BaklavaTableHeaderCell>
            </BaklavaTableRow>
          </BaklavaTableHeader>
          <BaklavaTableBody>
            {result.indexBreakdowns.map((ib) => (
              <BaklavaTableRow key={ib.indexId}>
                <BaklavaTableCell>{ib.indexName}</BaklavaTableCell>
                <BaklavaTableCell>{ib.totalShards}</BaklavaTableCell>
                <BaklavaTableCell>{ib.shardSizeGb.toFixed(2)}</BaklavaTableCell>
                <BaklavaTableCell>
                  {ib.docsPerShard.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </BaklavaTableCell>
                <BaklavaTableCell>{ib.dataWithReplicasGb.toFixed(2)}</BaklavaTableCell>
                <BaklavaTableCell>
                  {ib.vectorFields.length > 0 ? (
                    <span
                      className="nb-vector-badge"
                      title={ib.vectorFields.map((f) => `${f.fieldPath} (dims=${f.dims}, m=${f.m})`).join("\n")}
                    >
                      {ib.vectorFields.length}
                    </span>
                  ) : (
                    <span className="nb-vector-none">—</span>
                  )}
                </BaklavaTableCell>
                <BaklavaTableCell>
                  {ib.hnswGraphCount > 0 ? ib.hnswGraphCount : "—"}
                </BaklavaTableCell>
                <BaklavaTableCell>
                  {ib.vectorCpuFactor > 0 ? (
                    <span
                      className={`nb-vector-cpu${ib.vectorCpuFactor >= 10 ? " nb-vector-cpu--high" : ib.vectorCpuFactor >= 3 ? " nb-vector-cpu--med" : ""}`}
                    >
                      {ib.vectorCpuFactor.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </BaklavaTableCell>
              </BaklavaTableRow>
            ))}
          </BaklavaTableBody>
        </BaklavaTable>
        {result.indexBreakdowns.some((ib) => ib.vectorFields.length > 0) && (
          <p className="nb-vector-footnote">{t("nbVectorFootnote")}</p>
        )}
      </div>
    </section>
  );
}

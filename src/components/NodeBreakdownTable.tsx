import { useMemo } from "react";
import type {
  CalculationResult,
  ClusterConfig,
  IndexConfig,
} from "../types";
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
  result: CalculationResult;
  cluster: ClusterConfig;
  indices: IndexConfig[];
};

const SHARD_WARN_GB = 28;

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

export function NodeBreakdownTable({ result, cluster, indices }: Props) {
  const nodeColumns = useMemo(
    () => [
      ...buildMasterNodeVisuals(result),
      ...buildDataNodeVisuals(cluster, indices, result),
    ],
    [cluster, indices, result]
  );
  const summary = useMemo(() => clusterVisualSummary(result), [result]);

  return (
    <section className="panel node-breakdown-panel">
      <h2 className="panel-title">Node breakdown</h2>

      <div className="nb-cluster-bar">
        <div className="nb-cluster-title">Cluster</div>
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

      {nodeColumns.length === 0 ? (
        <p className="nb-empty">Add at least one master or data node to see nodes.</p>
      ) : (
        <div className="nb-node-grid">
          {nodeColumns.map((node) => {
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
                  {isMaster ? "Master" : "Data"}
                </span>
                <span className="nb-node-cap-name">{node.displayLabel}</span>
              </div>
              <div
                className={`nb-node-shard-bar${isMaster ? " nb-node-shard-bar--master" : " nb-node-shard-bar--data"}`}
              >
                <div className="nb-node-shard-bar-title">Shards & replicas</div>
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
                    Node summary
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
                          Disk {Math.round((node.dataStorageGb / node.storageGb) * 100)}%
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
                    description="Dedicated master nodes manage cluster state only — they do not hold shards or serve read/write traffic."
                  />
                )}
                {node.primaryShards.length > 0 && (
                  <div className="nb-primary-shards">
                    <div className="nb-block-label nb-block-label--primary">
                      Primary shards
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
                            description={`More than ${SHARD_WARN_GB}GB per shard is not a good idea.`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {node.replicaShards.length > 0 && (
                  <div className="nb-replica-section">
                    <div className="nb-block-label nb-block-label--replica">
                      Replicas
                    </div>
                    <div className="nb-replica-row">
                      {node.replicaShards.map((r) => (
                        <div
                          key={r.id}
                          className="nb-shard-card nb-shard-card--replica"
                        >
                          <div className="nb-shard-card-title nb-shard-card-title--replica">
                            replica ({r.sourceShardLabel})
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
                  {isMaster ? "Master" : "Data"}
                </span>
                <span className="nb-node-cap-name">{node.displayLabel}</span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {result.ilmBreakdown.enabled && (
        <div className="nb-ilm-breakdown">
          <h3 className="nb-index-metrics-title">ILM tier breakdown</h3>
          <div className="nb-ilm-tiers">
            {(["hot", "warm", "cold"] as const).map((tier) => {
              const t = result.ilmBreakdown[tier];
              if (t.nodeCount === 0 && tier !== "hot") return null;
              const colors = {
                hot: { bg: "#fff7ed", border: "#fb923c", label: "#c2410c" },
                warm: { bg: "#faf5ff", border: "#a78bfa", label: "#6d28d9" },
                cold: { bg: "#eff6ff", border: "#60a5fa", label: "#1d4ed8" },
              };
              const c = colors[tier];
              return (
                <div
                  key={tier}
                  className="nb-ilm-tier-card"
                  style={{ background: c.bg, borderColor: c.border }}
                >
                  <div className="nb-ilm-tier-header" style={{ color: c.label }}>
                    {tier.toUpperCase()} TIER
                  </div>
                  <div className="nb-ilm-tier-stats">
                    <span>{t.nodeCount} nodes</span>
                    <span>{t.usedDataGb.toFixed(1)} GB used</span>
                    <span>{t.totalDiskGb.toFixed(0)} GB total</span>
                  </div>
                  <BaklavaProgressIndicator
                    value={Math.round(t.diskUsagePercent)}
                    failed={t.diskUsagePercent >= 95}
                  />
                  <span className="nb-ilm-tier-pct">{t.diskUsagePercent.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="nb-index-metrics">
        <h3 className="nb-index-metrics-title">Index metrics</h3>
        <BaklavaTable>
          <BaklavaTableHeader>
            <BaklavaTableRow>
              <BaklavaTableHeaderCell>Index</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>Shards</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>Shard size (GB)</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>Docs / shard</BaklavaTableHeaderCell>
              <BaklavaTableHeaderCell>Data + replicas (GB)</BaklavaTableHeaderCell>
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
              </BaklavaTableRow>
            ))}
          </BaklavaTableBody>
        </BaklavaTable>
      </div>
    </section>
  );
}

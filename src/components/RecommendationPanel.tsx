import type { CalculationResult, RecommendationItem } from "../types";
import { BaklavaAlert, BaklavaTag } from "../baklava/components";

type Props = {
  result: CalculationResult;
  items: RecommendationItem[];
};

function kindLabel(kind: RecommendationItem["kind"]): string {
  switch (kind) {
    case "underscale": return "Underscale";
    case "overscale": return "Overscale";
    case "shard": return "Shard";
    case "node": return "Nodes";
    default: return kind;
  }
}

function HeapBar({
  label,
  gb,
  total,
  color,
}: {
  label: string;
  gb: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(100, (gb / total) * 100) : 0;
  return (
    <div className="heap-bar-row">
      <span className="heap-bar-label">{label}</span>
      <div className="heap-bar-track">
        <div
          className="heap-bar-fill"
          style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }}
        />
      </div>
      <span className="heap-bar-value">{gb.toFixed(1)} GB</span>
    </div>
  );
}

export function RecommendationPanel({ result, items }: Props) {
  const { heapBreakdown, diskOverheadFactor } = result;

  return (
    <section className="panel">
      <h2 className="panel-title">Recommendations</h2>
      <div className="metrics-row">
        <BaklavaTag size="large">Assessment: {result.scalingAssessment}</BaklavaTag>
        <BaklavaTag size="large">Heap / node: {result.heapPerNodeGb.toFixed(2)} GB</BaklavaTag>
        <BaklavaTag size="large">Guideline shards / node: {result.maxShardsPerNode.toFixed(0)}</BaklavaTag>
        {diskOverheadFactor > 1.15 && (
          <BaklavaTag size="large">Disk overhead: {diskOverheadFactor}× (write-dominant)</BaklavaTag>
        )}
      </div>

      <div className="heap-breakdown">
        <p className="heap-breakdown-title">RAM breakdown (per node)</p>
        <HeapBar
          label="JVM Heap"
          gb={heapBreakdown.totalHeapGb}
          total={heapBreakdown.totalRamGb}
          color="#e95400"
        />
        <HeapBar
          label="OS page cache"
          gb={heapBreakdown.osPageCacheGb}
          total={heapBreakdown.totalRamGb}
          color="#0891b2"
        />
        <div className="heap-breakdown-divider" />
        <p className="heap-breakdown-title" style={{ marginTop: 8 }}>JVM Heap detail</p>
        <HeapBar label="Field data cache" gb={heapBreakdown.fieldDataCacheGb} total={heapBreakdown.totalHeapGb} />
        <HeapBar label="Query buffer" gb={heapBreakdown.queryBufferGb} total={heapBreakdown.totalHeapGb} />
        <HeapBar label="Indexing buffer" gb={heapBreakdown.indexingBufferGb} total={heapBreakdown.totalHeapGb} />
        <HeapBar label="Available" gb={heapBreakdown.availableGb} total={heapBreakdown.totalHeapGb} />
        {heapBreakdown.hotDataPerNodeGb > 0 && (
          <div className="cache-ratio-row">
            <span className="cache-ratio-label">Page cache covers hot data:</span>
            <span
              className={`cache-ratio-value${
                heapBreakdown.cacheRatio >= 1
                  ? " cache-ratio--ok"
                  : heapBreakdown.cacheRatio >= 0.5
                    ? " cache-ratio--warn"
                    : " cache-ratio--crit"
              }`}
            >
              {Math.min(100, heapBreakdown.cacheRatio * 100).toFixed(0)}%
              {heapBreakdown.cacheRatio >= 1 ? " ✓ fully cached" : ""}
            </span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <BaklavaAlert
          variant="success"
          caption="No major issues"
          description="Configuration looks balanced against current heuristics."
        />
      ) : (
        <div className="alert-stack">
          {items.map((r) => (
            <BaklavaAlert
              key={r.id}
              variant={
                r.kind === "underscale"
                  ? "danger"
                  : r.kind === "overscale"
                    ? "info"
                    : "warning"
              }
              caption={`${kindLabel(r.kind)} - ${r.title}`}
              description={r.description}
            />
          ))}
        </div>
      )}
    </section>
  );
}

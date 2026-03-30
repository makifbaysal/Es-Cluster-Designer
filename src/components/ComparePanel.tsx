import { useMemo } from "react";
import type { Snapshot } from "../types";
import { BaklavaButton, BaklavaAlert } from "../baklava/components";
import { calculateCluster } from "../utils/calculator";

type Props = {
  snapshots: Snapshot[];
  onDelete: (id: string) => void;
  onLoad: (snap: Snapshot) => void;
};

type MetricRow = {
  label: string;
  a: string;
  b: string;
  better: "a" | "b" | "equal" | "none";
};

function compareNum(
  a: number,
  b: number,
  lowerIsBetter: boolean
): "a" | "b" | "equal" {
  if (Math.abs(a - b) < 0.001) return "equal";
  if (lowerIsBetter) return a < b ? "a" : "b";
  return a > b ? "a" : "b";
}

export function ComparePanel({ snapshots, onDelete, onLoad }: Props) {
  const [snapA, snapB] = snapshots;

  const resultA = useMemo(
    () => (snapA ? calculateCluster(snapA.cluster, snapA.indices) : null),
    [snapA]
  );
  const resultB = useMemo(
    () => (snapB ? calculateCluster(snapB.cluster, snapB.indices) : null),
    [snapB]
  );

  const rows: MetricRow[] = useMemo(() => {
    if (!resultA || !resultB) return [];
    return [
      {
        label: "Scaling assessment",
        a: resultA.scalingAssessment,
        b: resultB.scalingAssessment,
        better: "none",
      },
      {
        label: "Total shards",
        a: String(resultA.totalShards),
        b: String(resultB.totalShards),
        better: compareNum(resultA.totalShards, resultB.totalShards, true),
      },
      {
        label: "Shards / node",
        a: resultA.shardsPerNode.toFixed(1),
        b: resultB.shardsPerNode.toFixed(1),
        better: compareNum(resultA.shardsPerNode, resultB.shardsPerNode, true),
      },
      {
        label: "Heap / node (GB)",
        a: resultA.heapPerNodeGb.toFixed(2),
        b: resultB.heapPerNodeGb.toFixed(2),
        better: compareNum(resultA.heapPerNodeGb, resultB.heapPerNodeGb, false),
      },
      {
        label: "Guideline shards / node",
        a: resultA.maxShardsPerNode.toFixed(0),
        b: resultB.maxShardsPerNode.toFixed(0),
        better: compareNum(resultA.maxShardsPerNode, resultB.maxShardsPerNode, false),
      },
      {
        label: "Disk usage %",
        a: `${resultA.diskUsagePercent.toFixed(1)}%`,
        b: `${resultB.diskUsagePercent.toFixed(1)}%`,
        better: compareNum(resultA.diskUsagePercent, resultB.diskUsagePercent, true),
      },
      {
        label: "Total data + replicas (GB)",
        a: resultA.totalDataWithReplicasGb.toFixed(1),
        b: resultB.totalDataWithReplicasGb.toFixed(1),
        better: compareNum(
          resultA.totalDataWithReplicasGb,
          resultB.totalDataWithReplicasGb,
          true
        ),
      },
      {
        label: "Disk overhead factor",
        a: `${resultA.diskOverheadFactor}×`,
        b: `${resultB.diskOverheadFactor}×`,
        better: compareNum(resultA.diskOverheadFactor, resultB.diskOverheadFactor, true),
      },
      {
        label: "Available heap (GB)",
        a: resultA.heapBreakdown.availableGb.toFixed(1),
        b: resultB.heapBreakdown.availableGb.toFixed(1),
        better: compareNum(
          resultA.heapBreakdown.availableGb,
          resultB.heapBreakdown.availableGb,
          false
        ),
      },
      {
        label: "Warnings",
        a: String(resultA.warnings.length),
        b: String(resultB.warnings.length),
        better: compareNum(resultA.warnings.length, resultB.warnings.length, true),
      },
    ];
  }, [resultA, resultB]);

  return (
    <section className="panel">
      <h2 className="panel-title">Compare snapshots</h2>

      {snapshots.length === 0 && (
        <BaklavaAlert
          variant="info"
          caption="No snapshots yet"
          description="Save your current configuration with the 'Save snapshot' button to start comparing."
        />
      )}

      {snapshots.length === 1 && (
        <BaklavaAlert
          variant="info"
          description="Save one more snapshot to enable side-by-side comparison."
        />
      )}

      {snapshots.length >= 2 && resultA && resultB && (
        <div className="compare-table">
          <div className="compare-header">
            <div className="compare-label-col" />
            <div className="compare-val-col compare-val-col--a">
              <span className="compare-snap-name">{snapA!.label}</span>
              <span className="compare-snap-date">
                {new Date(snapA!.savedAt).toLocaleString()}
              </span>
            </div>
            <div className="compare-val-col compare-val-col--b">
              <span className="compare-snap-name">{snapB!.label}</span>
              <span className="compare-snap-date">
                {new Date(snapB!.savedAt).toLocaleString()}
              </span>
            </div>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="compare-row">
              <div className="compare-label-col">{row.label}</div>
              <div
                className={`compare-val-col compare-val-col--a${
                  row.better === "a" ? " compare-val--winner" : row.better === "b" ? " compare-val--loser" : ""
                }`}
              >
                {row.a}
              </div>
              <div
                className={`compare-val-col compare-val-col--b${
                  row.better === "b" ? " compare-val--winner" : row.better === "a" ? " compare-val--loser" : ""
                }`}
              >
                {row.b}
              </div>
            </div>
          ))}
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="compare-snap-list">
          <p className="compare-snap-list-title">Saved snapshots (newest first, max 10)</p>
          <div className="alert-stack">
            {snapshots.map((s) => (
              <div key={s.id} className="compare-snap-item">
                <div className="compare-snap-item-info">
                  <strong>{s.label}</strong>
                  <span>{new Date(s.savedAt).toLocaleString()}</span>
                  <span>{s.cluster.dataNodeCount} data nodes · {s.indices.length} indices</span>
                </div>
                <div className="compare-snap-item-actions">
                  <BaklavaButton size="small" variant="secondary" onBlClick={() => onLoad(s)}>
                    Load
                  </BaklavaButton>
                  <BaklavaButton size="small" kind="danger" variant="secondary" onBlClick={() => onDelete(s.id)}>
                    Delete
                  </BaklavaButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

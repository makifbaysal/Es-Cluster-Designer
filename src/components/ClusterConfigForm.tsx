import type { ClusterConfig } from "../types";
import { BaklavaInput } from "../baklava/components";

type Props = {
  cluster: ClusterConfig;
  onChange: (next: ClusterConfig) => void;
  /** When true, omit outer panel shell (used inside accordion). */
  embedded?: boolean;
};

export function ClusterConfigForm({ cluster, onChange, embedded }: Props) {
  const patch = (partial: Partial<ClusterConfig>) => {
    onChange({ ...cluster, ...partial });
  };

  const warmNodeCount = cluster.warmNodeCount ?? 0;
  const coldNodeCount = cluster.coldNodeCount ?? 0;
  const ilmEnabled = warmNodeCount > 0 || coldNodeCount > 0;

  const inner = (
    <>
      <div className="field-grid cols-2">
        <BaklavaInput
          type="number"
          label="Master node count"
          value={String(cluster.masterNodeCount)}
          min={0}
          step={1}
          helpText="Dedicated master nodes"
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ masterNodeCount: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Hot / data node count"
          value={String(cluster.dataNodeCount)}
          min={0}
          step={1}
          helpText="Primary data (hot) tier nodes"
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ dataNodeCount: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Memory per node (GB)"
          value={String(cluster.memoryPerNode)}
          min={1}
          step={1}
          helpText="Heap uses up to 50% capped at 31 GB"
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ memoryPerNode: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="CPU per node (cores)"
          value={String(cluster.cpuPerNode)}
          min={1}
          step={1}
          helpText="Used for load heuristics"
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ cpuPerNode: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Total hot disk size (GB)"
          value={String(cluster.totalDiskSize)}
          min={0}
          step={100}
          helpText="Aggregate provisioned disk for hot tier"
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ totalDiskSize: Number.isFinite(v) ? v : 0 });
          }}
        />
        <div className="cluster-toggle-row">
          <label className="cluster-toggle-label">
            <input
              type="checkbox"
              checked={cluster.writeDominant ?? false}
              onChange={(e) => patch({ writeDominant: e.target.checked })}
            />
            Write-dominant workload
          </label>
          <span className="cluster-toggle-hint">
            Increases disk overhead factor from 1.15× to 1.30× for segment merge cost
          </span>
        </div>
      </div>

      <p className="cluster-section-title">ILM tiers (optional)</p>
      <div className="field-grid cols-2">
        <BaklavaInput
          type="number"
          label="Warm node count"
          value={String(warmNodeCount)}
          min={0}
          step={1}
          helpText="0 = no warm tier"
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ warmNodeCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Warm disk per node (GB)"
          value={String(cluster.warmDiskPerNodeGb ?? 0)}
          min={0}
          step={100}
          helpText="Provisioned disk per warm node"
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ warmDiskPerNodeGb: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Cold node count"
          value={String(coldNodeCount)}
          min={0}
          step={1}
          helpText="0 = no cold tier"
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ coldNodeCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Cold disk per node (GB)"
          value={String(cluster.coldDiskPerNodeGb ?? 0)}
          min={0}
          step={100}
          helpText="Provisioned disk per cold node"
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ coldDiskPerNodeGb: Number.isFinite(v) ? v : 0 });
          }}
        />
      </div>
      {!ilmEnabled && (
        <p className="cluster-ilm-hint">
          Set warm or cold node count &gt; 0 and configure index retention to enable ILM tier breakdown.
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div className="cluster-form-inner">{inner}</div>;
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Cluster</h2>
      {inner}
    </section>
  );
}

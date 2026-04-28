import type { ClusterConfig } from "../types";
import { BaklavaInputWithInfoHint } from "./BaklavaInputWithInfoHint";
import { InfoHintInline } from "./InfoHintInline";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  cluster: ClusterConfig;
  onChange: (next: ClusterConfig) => void;
  embedded?: boolean;
};

export function ClusterConfigForm({ cluster, onChange, embedded }: Props) {
  const { t } = useI18n();
  const patch = (partial: Partial<ClusterConfig>) => {
    onChange({ ...cluster, ...partial });
  };

  const warmNodeCount = cluster.warmNodeCount ?? 0;
  const coldNodeCount = cluster.coldNodeCount ?? 0;
  const hasMasterNodes = cluster.masterNodeCount > 0;

  const inner = (
    <>
      <div className="cluster-node-group cluster-node-group--master">
        <div className="cluster-node-group-title">{t("clusterSectionMasterNodes")}</div>
        <div className="field-grid cols-2">
          <BaklavaInputWithInfoHint
            type="number"
            label="Master node count"
            value={String(cluster.masterNodeCount)}
            min={0}
            step={1}
            infoHint={t("clusterHintMasterCount")}
            onBlInput={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
              patch({ masterNodeCount: Number.isFinite(v) ? v : 0 });
            }}
          />
          {hasMasterNodes && (
            <>
              <BaklavaInputWithInfoHint
                type="number"
                label="Memory per master node (GB)"
                value={String(cluster.memoryPerMasterNode ?? 0)}
                min={0}
                step={1}
                infoHint={t("clusterHintMemoryPerMasterNode")}
                onBlInput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value || "0");
                  patch({ memoryPerMasterNode: Number.isFinite(v) && v > 0 ? v : undefined });
                }}
              />
              <BaklavaInputWithInfoHint
                type="number"
                label="CPU per master node (cores)"
                value={String(cluster.cpuPerMasterNode ?? 0)}
                min={0}
                step={1}
                infoHint={t("clusterHintCpuPerMasterNode")}
                onBlInput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value || "0");
                  patch({ cpuPerMasterNode: Number.isFinite(v) && v > 0 ? v : undefined });
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className="cluster-node-group cluster-node-group--data">
        <div className="cluster-node-group-title">{t("clusterSectionDataNodes")}</div>
        <div className="field-grid cols-2">
          <BaklavaInputWithInfoHint
            type="number"
            label="Hot / data node count"
            value={String(cluster.dataNodeCount)}
            min={0}
            step={1}
            infoHint={t("clusterHintDataNodes")}
            onBlInput={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
              patch({ dataNodeCount: Number.isFinite(v) ? v : 0 });
            }}
          />
          <BaklavaInputWithInfoHint
            type="number"
            label="Memory per data node (GB)"
            value={String(cluster.memoryPerNode)}
            min={1}
            step={1}
            infoHint={t("clusterHintMemoryPerNode")}
            onBlInput={(e) => {
              const v = parseFloat((e.target as HTMLInputElement).value || "0");
              patch({ memoryPerNode: Number.isFinite(v) ? v : 0 });
            }}
          />
          <BaklavaInputWithInfoHint
            type="number"
            label="CPU per data node (cores)"
            value={String(cluster.cpuPerNode)}
            min={1}
            step={1}
            infoHint={t("clusterHintCpuPerNode")}
            onBlInput={(e) => {
              const v = parseFloat((e.target as HTMLInputElement).value || "0");
              patch({ cpuPerNode: Number.isFinite(v) ? v : 0 });
            }}
          />
          <BaklavaInputWithInfoHint
            type="number"
            label="Total hot disk size (GB)"
            value={String(cluster.totalDiskSize)}
            min={0}
            step={100}
            infoHint={t("clusterHintTotalHotDisk")}
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
              <InfoHintInline infoText={t("clusterHintWriteDominant")}>
                Write-dominant workload
              </InfoHintInline>
            </label>
          </div>
        </div>
      </div>

      <p className="cluster-section-title">
        <InfoHintInline infoText={t("clusterHintIlmSection")}>
          {t("clusterIlmSectionTitle")}
        </InfoHintInline>
      </p>
      <div className="field-grid cols-2">
        <BaklavaInputWithInfoHint
          type="number"
          label="Warm node count"
          value={String(warmNodeCount)}
          min={0}
          step={1}
          infoHint={t("clusterHintWarmNodeCount")}
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ warmNodeCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label="Warm disk per node (GB)"
          value={String(cluster.warmDiskPerNodeGb ?? 0)}
          min={0}
          step={100}
          infoHint={t("clusterHintWarmDisk")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ warmDiskPerNodeGb: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label="Cold node count"
          value={String(coldNodeCount)}
          min={0}
          step={1}
          infoHint={t("clusterHintColdNodeCount")}
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({ coldNodeCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label="Cold disk per node (GB)"
          value={String(cluster.coldDiskPerNodeGb ?? 0)}
          min={0}
          step={100}
          infoHint={t("clusterHintColdDisk")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ coldDiskPerNodeGb: Number.isFinite(v) ? v : 0 });
          }}
        />
      </div>
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

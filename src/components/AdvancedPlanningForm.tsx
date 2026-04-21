import type { CalculationResult, ClusterConfig, WorkloadProfile } from "../types";
import { BaklavaInputWithInfoHint } from "./BaklavaInputWithInfoHint";
import { InfoHintInline } from "./InfoHintInline";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  cluster: ClusterConfig;
  onChange: (next: ClusterConfig) => void;
  result: CalculationResult;
  formatMonthlyUsd?: boolean;
  hideSummary?: boolean;
};

export function AdvancedPlanningForm({
  cluster,
  onChange,
  result,
  formatMonthlyUsd,
  hideSummary,
}: Props) {
  const { t } = useI18n();
  const patch = (partial: Partial<ClusterConfig>) => {
    onChange({ ...cluster, ...partial });
  };
  const profile = cluster.workloadProfile ?? "balanced";
  const warmDisk =
    (cluster.warmNodeCount ?? 0) * (cluster.warmDiskPerNodeGb ?? 0);
  const coldDisk =
    (cluster.coldNodeCount ?? 0) * (cluster.coldDiskPerNodeGb ?? 0);
  const totalRamGb =
    (cluster.masterNodeCount + cluster.dataNodeCount) * cluster.memoryPerNode;
  const totalDiskGb = cluster.totalDiskSize + warmDisk + coldDisk;
  const ramRate = cluster.costUsdPerGbRamMonth ?? 0;
  const diskRate = cluster.costUsdPerGbDiskMonth ?? 0;
  const nodeRate = cluster.costUsdPerDataNodeMonth ?? 0;
  const monthly =
    totalRamGb * ramRate + totalDiskGb * diskRate + cluster.dataNodeCount * nodeRate;

  return (
    <div className="advanced-planning-inner">
      <div className="cluster-toggle-row">
        <InfoHintInline infoText={t("costHintWorkloadProfile")}>
          <span className="index-shard-label">{t("workloadProfile")}</span>
        </InfoHintInline>
        <select
          className="es-select"
          value={profile}
          onChange={(e) =>
            patch({ workloadProfile: e.target.value as WorkloadProfile })
          }
          aria-label={t("workloadProfile")}
        >
          <option value="balanced">{t("workloadBalanced")}</option>
          <option value="search_heavy">{t("workloadSearch")}</option>
          <option value="ingest_heavy">{t("workloadIngest")}</option>
        </select>
      </div>
      <div className="field-grid cols-2">
        <BaklavaInputWithInfoHint
          type="number"
          label={t("growthGbPerDay")}
          value={String(cluster.growthGbPerDay ?? 0)}
          min={0}
          step={1}
          infoHint={t("costHintGrowthGbPerDay")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ growthGbPerDay: Number.isFinite(v) ? Math.max(0, v) : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label={t("growthDays")}
          value={String(cluster.growthProjectionDays ?? 0)}
          min={0}
          step={1}
          infoHint={t("costHintGrowthDays")}
          onBlInput={(e) => {
            const v = parseInt((e.target as HTMLInputElement).value || "0", 10);
            patch({
              growthProjectionDays: Number.isFinite(v) ? Math.max(0, v) : 0,
            });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label={t("costRam")}
          value={String(cluster.costUsdPerGbRamMonth ?? 0)}
          min={0}
          step={0.01}
          infoHint={t("costHintUsdRam")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ costUsdPerGbRamMonth: Number.isFinite(v) ? Math.max(0, v) : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label={t("costDisk")}
          value={String(cluster.costUsdPerGbDiskMonth ?? 0)}
          min={0}
          step={0.01}
          infoHint={t("costHintUsdDisk")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({ costUsdPerGbDiskMonth: Number.isFinite(v) ? Math.max(0, v) : 0 });
          }}
        />
        <BaklavaInputWithInfoHint
          type="number"
          label={t("costNode")}
          value={String(cluster.costUsdPerDataNodeMonth ?? 0)}
          min={0}
          step={0.01}
          infoHint={t("costHintUsdNode")}
          onBlInput={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value || "0");
            patch({
              costUsdPerDataNodeMonth: Number.isFinite(v) ? Math.max(0, v) : 0,
            });
          }}
        />
      </div>
      {!hideSummary ? (
        <div className="advanced-planning-summary">
          <p>
            <strong>{t("monthlyEstimate")}:</strong>{" "}
            {monthly > 0
              ? formatMonthlyUsd
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(monthly)
                : monthly.toFixed(2)
              : "—"}
          </p>
          <p>
            <strong>{t("dataWithGrowth")}:</strong>{" "}
            {result.totalDataWithGrowthGb.toFixed(2)} GB
          </p>
          <p>
            <strong>{t("snapshotRough")}:</strong>{" "}
            {result.roughSnapshotRepoGb.toFixed(2)} GB
          </p>
          <p>
            <strong>{t("snapshotHours")}:</strong>{" "}
            {result.roughSnapshotDurationHours.toFixed(2)} h
          </p>
        </div>
      ) : null}
    </div>
  );
}

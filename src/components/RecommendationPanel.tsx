import type {
  CalculationResult,
  RecommendationItem,
  ScalingAssessment,
} from "../types";
import { BaklavaAlert, BaklavaTag } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";
import { recommendationKindLabel } from "../utils/recommendationKindLabel";

type Props = {
  result: CalculationResult;
  items: RecommendationItem[];
  variant?: "standalone" | "summary";
};

function summaryAssessmentClass(a: ScalingAssessment): string {
  if (a === "underscale") {
    return "summary-assessment summary-assessment--underscale";
  }
  if (a === "overscale") {
    return "summary-assessment summary-assessment--overscale";
  }
  return "summary-assessment summary-assessment--optimal";
}

function recommendationAlertCaption(
  r: RecommendationItem,
  scaling: ScalingAssessment,
  omitKindWhenMatchesAssessment: boolean
): string {
  if (
    omitKindWhenMatchesAssessment &&
    (r.kind === "overscale" || r.kind === "underscale") &&
    r.kind === scaling
  ) {
    return r.title;
  }
  return `${recommendationKindLabel(r.kind)} - ${r.title}`;
}

export function RecommendationPanel({ result, items, variant = "standalone" }: Props) {
  const { t } = useI18n();
  const { diskOverheadFactor } = result;
  const clusterItems = items.filter((r) => !r.indexId);
  const indexOnlyClusterEmpty =
    clusterItems.length === 0 && items.some((r) => Boolean(r.indexId));

  const metrics = (
    <div className="metrics-row metrics-row--rec-aside">
      <BaklavaTag size="medium">
        {t("recAssessment")}: {result.scalingAssessment}
      </BaklavaTag>
      <BaklavaTag size="medium">
        {t("recHeapPerNode")}: {result.heapPerNodeGb.toFixed(2)} GB
      </BaklavaTag>
      <BaklavaTag size="medium">
        {t("recGuidelineShards")}: {result.maxShardsPerNode.toFixed(0)}
      </BaklavaTag>
      {diskOverheadFactor > 1.15 && (
        <BaklavaTag size="medium">
          {t("recDiskOverhead")}: {diskOverheadFactor}× {t("recWriteDominant")}
        </BaklavaTag>
      )}
      {result.growthProjectedExtraGb > 0 && (
        <BaklavaTag size="medium">
          {t("recGrowth")} +{result.growthProjectedExtraGb.toFixed(1)} GB → {t("recTotal")}{" "}
          {result.totalDataWithGrowthGb.toFixed(1)} GB
        </BaklavaTag>
      )}
      <BaklavaTag size="medium">
        {t("recSnapshot")} ~{result.roughSnapshotRepoGb.toFixed(0)} GB / ~
        {result.roughSnapshotDurationHours.toFixed(1)} h
      </BaklavaTag>
    </div>
  );

  const summaryMetrics = (
    <div className="summary-reco-metrics">
      <div className={summaryAssessmentClass(result.scalingAssessment)}>
        <span className="summary-assessment__label">{t("recAssessment")}</span>
        <span className="summary-assessment__value">{result.scalingAssessment}</span>
      </div>
      <dl className="summary-metric-grid">
        <div className="summary-metric-row">
          <dt>{t("recHeapPerNode")}</dt>
          <dd>{result.heapPerNodeGb.toFixed(2)} GB</dd>
        </div>
        <div className="summary-metric-row">
          <dt>{t("recGuidelineShards")}</dt>
          <dd>{result.maxShardsPerNode.toFixed(0)}</dd>
        </div>
        {diskOverheadFactor > 1.15 && (
          <div className="summary-metric-row">
            <dt>{t("recDiskOverhead")}</dt>
            <dd>
              {diskOverheadFactor}× {t("recWriteDominant")}
            </dd>
          </div>
        )}
        {result.growthProjectedExtraGb > 0 && (
          <div className="summary-metric-row summary-metric-row--wrap">
            <dt>{t("recGrowth")}</dt>
            <dd>
              +{result.growthProjectedExtraGb.toFixed(1)} GB → {t("recTotal")}{" "}
              {result.totalDataWithGrowthGb.toFixed(1)} GB
            </dd>
          </div>
        )}
        <div className="summary-metric-row summary-metric-row--wrap">
          <dt>{t("recSnapshot")}</dt>
          <dd>
            ~{result.roughSnapshotRepoGb.toFixed(0)} GB / ~{result.roughSnapshotDurationHours.toFixed(1)} h
          </dd>
        </div>
      </dl>
    </div>
  );

  const alertsContent =
    clusterItems.length === 0 && !indexOnlyClusterEmpty ? (
      <BaklavaAlert
        variant="success"
        caption={t("recNoMajorCaption")}
        description={t("recNoMajorDesc")}
      />
    ) : indexOnlyClusterEmpty ? (
      <BaklavaAlert
        variant="info"
        caption={t("recIndexHintsOnlyCaption")}
        description={t("recIndexHintsOnlyDesc")}
      />
    ) : (
      <div className="alert-stack">
        {clusterItems.map((r) => (
          <BaklavaAlert
            key={r.id}
            variant={
              r.kind === "underscale"
                ? "danger"
                : r.kind === "overscale"
                  ? "info"
                  : "warning"
            }
            caption={recommendationAlertCaption(
              r,
              result.scalingAssessment,
              variant === "summary"
            )}
            description={r.description}
          />
        ))}
      </div>
    );

  if (variant === "summary") {
    return (
      <div className="designer-summary__block designer-summary__block--reco">
        <h3 className="designer-summary__block-title">{t("recPanelTitle")}</h3>
        {summaryMetrics}
        <div className="heap-breakdown heap-breakdown--aside heap-breakdown--reco-callout">
          {alertsContent}
        </div>
      </div>
    );
  }

  return (
    <section className="panel results-aside-panel">
      <h2 className="panel-title">{t("recPanelTitle")}</h2>
      {metrics}
      <div className="heap-breakdown heap-breakdown--aside">{alertsContent}</div>
    </section>
  );
}

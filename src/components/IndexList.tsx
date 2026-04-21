import type { IndexConfig, IndexInsightBuckets } from "../types";
import {
  BaklavaAccordion,
  BaklavaAccordionGroup,
  BaklavaAlert,
  BaklavaButton,
} from "../baklava/components";
import type { EsConnection } from "./EsConnectionPanel";
import { IndexForm } from "./IndexForm";
import { useI18n } from "../i18n/I18nContext";
import { recommendationKindLabel } from "../utils/recommendationKindLabel";

type Props = {
  indices: IndexConfig[];
  onChangeIndex: (id: string, next: IndexConfig) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onOpenMapping: (id: string) => void;
  embedded?: boolean;
  esConnection?: EsConnection | null;
  ilmPoliciesJson?: string;
  indexTemplatesJson?: string;
  indexInsightBuckets?: IndexInsightBuckets;
};

function IndexAccordionInsights({
  indexId,
  buckets,
}: {
  indexId: string;
  buckets: IndexInsightBuckets;
}) {
  const { t } = useI18n();
  const ws = buckets.warningsByIndexId.get(indexId) ?? [];
  const rs = buckets.recommendationsByIndexId.get(indexId) ?? [];
  if (ws.length === 0 && rs.length === 0) return null;
  return (
    <div className="index-insights">
      <p className="index-insights__title">{t("indexInsightsSectionTitle")}</p>
      <div className="alert-stack index-insights__alerts">
        {ws.map((w) => (
          <BaklavaAlert
            key={w.id}
            variant={w.level === "critical" ? "danger" : "warning"}
            caption={w.level === "critical" ? t("warnCritical") : t("warnWarning")}
            description={`${w.message}${w.context ? ` ${w.context}` : ""}`}
          />
        ))}
        {rs.map((r) => (
          <BaklavaAlert
            key={r.id}
            variant={
              r.kind === "underscale"
                ? "danger"
                : r.kind === "overscale"
                  ? "info"
                  : "warning"
            }
            caption={`${recommendationKindLabel(r.kind)} - ${r.title}`}
            description={r.description}
          />
        ))}
      </div>
    </div>
  );
}

function indexInsightCount(
  idx: IndexConfig,
  buckets: IndexInsightBuckets | undefined
): { n: number; hasCritical: boolean } {
  if (!buckets) return { n: 0, hasCritical: false };
  const ws = buckets.warningsByIndexId.get(idx.id) ?? [];
  const rs = buckets.recommendationsByIndexId.get(idx.id) ?? [];
  const n = ws.length + rs.length;
  const hasCritical = ws.some((w) => w.level === "critical");
  return { n, hasCritical };
}

export function IndexList({
  indices,
  onChangeIndex,
  onAdd,
  onRemove,
  onOpenMapping,
  embedded,
  esConnection = null,
  ilmPoliciesJson = "",
  indexTemplatesJson = "",
  indexInsightBuckets,
}: Props) {
  const { t } = useI18n();
  const inner = (
    <>
      <div className="actions-row index-section-actions">
        <BaklavaButton variant="primary" onBlClick={onAdd}>
          Add index
        </BaklavaButton>
      </div>
      <div className="index-accordion-stack">
        <BaklavaAccordionGroup>
          {indices.map((idx) => {
            const { n: insightCount, hasCritical } = indexInsightCount(idx, indexInsightBuckets);
            return (
              <BaklavaAccordion key={idx.id}>
                <div slot="caption" className="index-accordion-caption">
                  <span className="index-accordion-caption__name">
                    {idx.name || "Unnamed index"}
                  </span>
                  {indexInsightBuckets && insightCount > 0 ? (
                    <span
                      className={
                        hasCritical
                          ? "index-accordion-caption__badge index-accordion-caption__badge--critical"
                          : "index-accordion-caption__badge index-accordion-caption__badge--warn"
                      }
                      aria-label={t("indexInsightBadgeAria").replace("{n}", String(insightCount))}
                      title={t("indexInsightBadgeAria").replace("{n}", String(insightCount))}
                    >
                      <svg
                        className="index-accordion-caption__badge-icon"
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        aria-hidden
                      >
                        <path
                          fill="currentColor"
                          d="M8.5 1L14 13.5H3L8.5 1zM8 5.5h1v4H8v-4zm0 5h1v1.5H8V10.5z"
                        />
                      </svg>
                      <span className="index-accordion-caption__badge-count">{insightCount}</span>
                    </span>
                  ) : null}
                </div>
                <div className="index-accordion-body">
                  <IndexForm
                    index={idx}
                    onChange={(next) => onChangeIndex(idx.id, next)}
                    onRemove={() => onRemove(idx.id)}
                    onOpenMapping={() => onOpenMapping(idx.id)}
                    esConnection={esConnection}
                    ilmPoliciesJson={ilmPoliciesJson}
                    indexTemplatesJson={indexTemplatesJson}
                  />
                  {indexInsightBuckets ? (
                    <IndexAccordionInsights indexId={idx.id} buckets={indexInsightBuckets} />
                  ) : null}
                </div>
              </BaklavaAccordion>
            );
          })}
        </BaklavaAccordionGroup>
      </div>
    </>
  );

  if (embedded) {
    return <div className="index-list-inner">{inner}</div>;
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Indices</h2>
      {inner}
    </section>
  );
}

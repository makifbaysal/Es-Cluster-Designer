import type { CalculationResult } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { RamBreakdownCard } from "./RamBreakdownCard";
import { RecommendationPanel } from "./RecommendationPanel";
import { WarningPanel } from "./WarningPanel";

type Props = {
  result: CalculationResult;
};

export function DesignerSummaryColumn({ result }: Props) {
  const { t } = useI18n();
  return (
    <section className="panel designer-summary">
      <h2 className="panel-title designer-summary__title">{t("designerSummaryTitle")}</h2>
      <div className="designer-summary__stack">
        <RamBreakdownCard result={result} embedInSummary />
        <RecommendationPanel
          result={result}
          items={result.recommendations}
          variant="summary"
        />
        <WarningPanel items={result.warnings} variant="summary" />
      </div>
    </section>
  );
}

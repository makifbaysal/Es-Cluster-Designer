import type { WarningItem } from "../types";
import { BaklavaAlert } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  items: WarningItem[];
  variant?: "standalone" | "summary";
};

export function WarningPanel({ items, variant = "standalone" }: Props) {
  const { t } = useI18n();
  const clusterItems = items.filter((w) => !w.indexId);
  if (clusterItems.length === 0) {
    return null;
  }

  const inner = (
    <div className="heap-breakdown heap-breakdown--aside">
      <div className="alert-stack">
        {clusterItems.map((w) => (
          <BaklavaAlert
            key={w.id}
            variant={w.level === "critical" ? "danger" : "warning"}
            caption={w.level === "critical" ? t("warnCritical") : t("warnWarning")}
            description={`${w.message}${w.context ? ` ${w.context}` : ""}`}
          />
        ))}
      </div>
    </div>
  );

  if (variant === "summary") {
    return (
      <div className="designer-summary__block designer-summary__block--limits">
        <h3 className="designer-summary__block-title">{t("limitsPanelTitle")}</h3>
        {inner}
      </div>
    );
  }

  return (
    <section className="panel results-aside-panel">
      <h2 className="panel-title">{t("limitsPanelTitle")}</h2>
      {inner}
    </section>
  );
}

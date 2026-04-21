import type { CalculationResult } from "../types";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  result: CalculationResult;
  embedInSummary?: boolean;
};

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

export function RamBreakdownCard({ result, embedInSummary }: Props) {
  const { t } = useI18n();
  const { heapBreakdown } = result;

  const inner = (
    <div
      className={
        embedInSummary
          ? "heap-breakdown heap-breakdown--hero heap-breakdown--summary-embed"
          : "heap-breakdown heap-breakdown--hero"
      }
    >
      <p className="heap-breakdown-title">{t("recRamBreakdown")}</p>
      <HeapBar
        label={t("recJvmHeap")}
        gb={heapBreakdown.totalHeapGb}
        total={heapBreakdown.totalRamGb}
        color="#e95400"
      />
      <HeapBar
        label={t("recOsPageCache")}
        gb={heapBreakdown.osPageCacheGb}
        total={heapBreakdown.totalRamGb}
        color="#0891b2"
      />
      <div className="heap-breakdown-divider" />
      <p className="heap-breakdown-title heap-breakdown-title--after-divider">{t("recJvmHeapDetail")}</p>
      <HeapBar
        label={t("recFieldDataCache")}
        gb={heapBreakdown.fieldDataCacheGb}
        total={heapBreakdown.totalHeapGb}
      />
      <HeapBar
        label={t("recQueryBuffer")}
        gb={heapBreakdown.queryBufferGb}
        total={heapBreakdown.totalHeapGb}
      />
      <HeapBar
        label={t("recIndexingBuffer")}
        gb={heapBreakdown.indexingBufferGb}
        total={heapBreakdown.totalHeapGb}
      />
      <HeapBar
        label={t("recAvailable")}
        gb={heapBreakdown.availableGb}
        total={heapBreakdown.totalHeapGb}
      />
      {heapBreakdown.hotDataPerNodeGb > 0 && (
        <div className="cache-ratio-row">
          <span className="cache-ratio-label">{t("recPageCacheCovers")}</span>
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
            {heapBreakdown.cacheRatio >= 1 ? ` ✓ ${t("recFullyCached")}` : ""}
          </span>
        </div>
      )}
    </div>
  );

  if (embedInSummary) {
    return (
      <div className="designer-summary__block designer-summary__block--ram">{inner}</div>
    );
  }

  return <section className="panel ram-breakdown-hero">{inner}</section>;
}

import { useEffect, useMemo, useState } from "react";
import type { IndexConfig } from "../types";
import {
  extractMappingsJsonFromIndexTemplateResponse,
  listIlmPolicyNamesFromRaw,
  listIndexTemplateNames,
  suggestedRetentionDaysFromIlmPolicy,
} from "../utils/elasticsearchClient";
import { BaklavaButton, BaklavaInput } from "../baklava/components";
import { BaklavaInputWithInfoHint } from "./BaklavaInputWithInfoHint";
import { InfoHintInline } from "./InfoHintInline";
import type { EsConnection } from "./EsConnectionPanel";
import { useI18n } from "../i18n/I18nContext";

const TARGET_SHARD_GB = 40;

type Props = {
  index: IndexConfig;
  onChange: (next: IndexConfig) => void;
  onRemove: () => void;
  onOpenMapping: () => void;
  esConnection?: EsConnection | null;
  ilmPoliciesJson?: string;
  indexTemplatesJson?: string;
};

function readValue(e: Event): string {
  return (e.target as unknown as { value: string }).value;
}

export function IndexForm({
  index,
  onChange,
  onRemove,
  onOpenMapping,
  esConnection = null,
  ilmPoliciesJson = "",
  indexTemplatesJson = "",
}: Props) {
  const { t } = useI18n();
  const patch = (partial: Partial<IndexConfig>) => {
    onChange({ ...index, ...partial });
  };

  const [ilmPolicyPick, setIlmPolicyPick] = useState("");
  const [indexTplPick, setIndexTplPick] = useState("");
  const [clusterDataErr, setClusterDataErr] = useState<string | null>(null);

  const ilmOptions = useMemo(
    () => listIlmPolicyNamesFromRaw(ilmPoliciesJson),
    [ilmPoliciesJson]
  );

  const indexTplOptions = useMemo(
    () => listIndexTemplateNames(indexTemplatesJson),
    [indexTemplatesJson]
  );

  useEffect(() => {
    if (ilmOptions.length > 0 && (!ilmPolicyPick || !ilmOptions.includes(ilmPolicyPick))) {
      setIlmPolicyPick(ilmOptions[0]);
    }
    if (ilmOptions.length === 0) setIlmPolicyPick("");
  }, [ilmOptions, ilmPolicyPick]);

  useEffect(() => {
    if (indexTplOptions.length > 0 && (!indexTplPick || !indexTplOptions.includes(indexTplPick))) {
      setIndexTplPick(indexTplOptions[0]);
    }
    if (indexTplOptions.length === 0) setIndexTplPick("");
  }, [indexTplOptions, indexTplPick]);

  useEffect(() => {
    setClusterDataErr(null);
  }, [index.id]);

  const suggestShards = () => {
    if (index.totalSize <= 0) return;
    const suggested = Math.max(1, Math.ceil(index.totalSize / TARGET_SHARD_GB));
    patch({ primaryShardCount: suggested });
  };

  const ilmEnabled = (index.retentionDays ?? 0) > 0;

  const applyIlmPolicyToThisIndex = () => {
    setClusterDataErr(null);
    if (!ilmPoliciesJson.trim() || !ilmPolicyPick.trim()) return;
    try {
      const all = JSON.parse(ilmPoliciesJson) as Record<string, unknown>;
      const body = all[ilmPolicyPick];
      const days = suggestedRetentionDaysFromIlmPolicy(body);
      if (days === null) {
        setClusterDataErr(t("indexFormIlmNoRetention"));
        return;
      }
      patch({ retentionDays: days });
    } catch {
      setClusterDataErr(t("indexFormIlmParseError"));
    }
  };

  const importIndexTemplateToThisIndex = () => {
    setClusterDataErr(null);
    const r = extractMappingsJsonFromIndexTemplateResponse(indexTemplatesJson, indexTplPick);
    if (!r.ok) {
      setClusterDataErr(r.message);
      return;
    }
    patch({
      name: indexTplPick || index.name,
      mapping: r.mappingJson,
    });
  };

  const hasClusterData = Boolean(esConnection && (ilmPoliciesJson || indexTemplatesJson));

  return (
    <div className="index-form">
      <div className="index-form-grid">
        <BaklavaInput
          label="Index name"
          value={index.name}
          onBlInput={(e) => patch({ name: readValue(e) })}
        />
        <BaklavaInput
          type="number"
          label="Document count"
          value={String(index.documentCount)}
          min={0}
          step={1}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ documentCount: Number.isFinite(v) ? v : 0 });
          }}
        />
        <p className="index-form-section-title">Primary shard data before replicas</p>
        <BaklavaInputWithInfoHint
          type="number"
          label="Total size on primaries (GB)"
          value={String(index.totalSize)}
          min={0}
          step={0.1}
          infoHint={t("indexHintTotalSizePrimaries")}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ totalSize: Number.isFinite(v) ? v : 0 });
          }}
        />
        <div className="index-shard-row">
          <div className="index-shard-label-row">
            <InfoHintInline infoText={t("indexHintPrimaryShards").replace("{n}", String(TARGET_SHARD_GB))}>
              <span className="index-shard-label">Primary shards</span>
            </InfoHintInline>
            <BaklavaButton
              variant="secondary"
              size="small"
              onBlClick={suggestShards}
            >
              Suggest
            </BaklavaButton>
          </div>
          <BaklavaInput
            type="number"
            label=""
            aria-label="Primary shards"
            value={String(index.primaryShardCount)}
            min={1}
            step={1}
            onBlInput={(e) => {
              const v = parseInt(readValue(e) || "1", 10);
              patch({ primaryShardCount: Number.isFinite(v) && v > 0 ? v : 1 });
            }}
          />
        </div>
        <BaklavaInput
          type="number"
          label="Replica shards"
          value={String(index.replicaShardCount)}
          min={0}
          step={1}
          onBlInput={(e) => {
            const v = parseInt(readValue(e) || "0", 10);
            patch({ replicaShardCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Write (docs/sec)"
          value={String(index.writeRate)}
          min={0}
          step={100}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ writeRate: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Read (queries/sec)"
          value={String(index.readRate)}
          min={0}
          step={10}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ readRate: Number.isFinite(v) ? v : 0 });
          }}
        />
        {hasClusterData && (
          <p className="index-form-section-title">{t("indexFormClusterDataTitle")}</p>
        )}
        {esConnection && ilmPoliciesJson && (
          <>
            <div className="cluster-toggle-row">
              <span className="index-shard-label">{t("fetchIlm")}</span>
              <select
                className="es-select"
                value={ilmPolicyPick}
                onChange={(e) => setIlmPolicyPick(e.target.value)}
                aria-label={t("fetchIlm")}
              >
                {ilmOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <BaklavaButton variant="primary" size="small" onBlClick={applyIlmPolicyToThisIndex}>
              {t("indexFormApplyIlmThisIndex")}
            </BaklavaButton>
          </>
        )}
        {esConnection && indexTemplatesJson && (
          <>
            <div className="cluster-toggle-row">
              <span className="index-shard-label">{t("selectTemplate")}</span>
              <select
                className="es-select"
                value={indexTplPick}
                onChange={(e) => setIndexTplPick(e.target.value)}
                aria-label={t("selectTemplate")}
              >
                {indexTplOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <BaklavaButton variant="primary" size="small" onBlClick={importIndexTemplateToThisIndex}>
              {t("indexFormImportTplThisIndex")}
            </BaklavaButton>
          </>
        )}
        {esConnection && !ilmPoliciesJson && !indexTemplatesJson && (
          <p className="es-help-muted">{t("indexFormClusterDataEmptyHint")}</p>
        )}
        {clusterDataErr !== null && (
          <p className="es-connect-error" role="alert">
            {clusterDataErr}
          </p>
        )}
        <p className="index-form-section-title">ILM / Retention (optional)</p>
        <BaklavaInputWithInfoHint
          type="number"
          label="Retention days"
          value={String(index.retentionDays ?? 0)}
          min={0}
          step={1}
          infoHint={t("indexHintRetentionDays")}
          onBlInput={(e) => {
            const v = parseInt(readValue(e) || "0", 10);
            patch({ retentionDays: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        {ilmEnabled && (
          <>
            <BaklavaInputWithInfoHint
              type="number"
              label="Hot days"
              value={String(index.hotDays ?? 0)}
              min={0}
              step={1}
              infoHint={t("indexHintHotDays")}
              onBlInput={(e) => {
                const v = parseInt(readValue(e) || "0", 10);
                patch({ hotDays: Number.isFinite(v) && v >= 0 ? v : 0 });
              }}
            />
            <BaklavaInputWithInfoHint
              type="number"
              label="Warm days"
              value={String(index.warmDays ?? 0)}
              min={0}
              step={1}
              infoHint={t("indexHintWarmDays")}
              onBlInput={(e) => {
                const v = parseInt(readValue(e) || "0", 10);
                patch({ warmDays: Number.isFinite(v) && v >= 0 ? v : 0 });
              }}
            />
          </>
        )}
        <div className="index-form-spacer" aria-hidden="true" />
      </div>
      <div className="index-form-actions">
        <BaklavaButton variant="secondary" onBlClick={onOpenMapping}>
          Estimate size from mapping
        </BaklavaButton>
        <BaklavaButton kind="danger" variant="secondary" onBlClick={onRemove}>
          Remove index
        </BaklavaButton>
      </div>
    </div>
  );
}

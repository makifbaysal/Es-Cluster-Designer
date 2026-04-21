import { lazy, Suspense, useEffect, useState } from "react";
import type { IndexConfig } from "../types";
import { BaklavaButton, BaklavaDialog } from "../baklava/components";
import {
  estimatedIndexSizeGb,
  estimateSizeFromMappingJson,
} from "../utils/mappingParser";
import { isValidJson } from "../utils/jsonEditorHelpers";
import {
  fetchIndexMappings,
  fetchIndexDocCount,
} from "../utils/elasticsearchClient";
import type { EsConnection } from "./EsConnectionPanel";

const MappingJsonEditor = lazy(() =>
  import("./MappingJsonEditor").then((m) => ({ default: m.MappingJsonEditor }))
);

type Props = {
  open: boolean;
  index: IndexConfig | null;
  esConnection: EsConnection | null;
  onClose: () => void;
  onApply: (mappingJson: string, computedSizeGb: number, docCount?: number) => void;
};

export function MappingModal({ open, index, esConnection, onClose, onApply }: Props) {
  const [text, setText] = useState("");
  const [liveDocCount, setLiveDocCount] = useState<number | null>(null);
  const [useLiveDocCount, setUseLiveDocCount] = useState(false);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [loadingDocCount, setLoadingDocCount] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (open && index) {
      setText(index.mapping ?? "");
      setLiveDocCount(null);
      setUseLiveDocCount(false);
      setFetchError(null);
    } else if (!open) {
      document.body.style.overflow = "";
    }
  }, [open, index]);

  if (!index) {
    return null;
  }

  const trimmed = text.trim();
  const canApply = trimmed !== "" && isValidJson(text);
  const hasEsConn = esConnection !== null;

  const handleFetchMapping = async () => {
    if (!esConnection || !index) return;
    setLoadingMapping(true);
    setFetchError(null);
    try {
      const r = await fetchIndexMappings(esConnection.baseUrl, index.name, esConnection.headers);
      if (!r.ok) {
        setFetchError(`Mapping fetch failed: ${r.message}`);
        return;
      }
      setText(r.mappingJson);
    } finally {
      setLoadingMapping(false);
    }
  };

  const handleFetchDocCount = async () => {
    if (!esConnection || !index) return;
    setLoadingDocCount(true);
    setFetchError(null);
    try {
      const r = await fetchIndexDocCount(esConnection.baseUrl, index.name, esConnection.headers);
      if (!r.ok) {
        setFetchError(`Doc count fetch failed: ${r.message}`);
        return;
      }
      setLiveDocCount(r.count);
      setUseLiveDocCount(true);
    } finally {
      setLoadingDocCount(false);
    }
  };

  const effectiveDocCount = useLiveDocCount && liveDocCount !== null ? liveDocCount : index.documentCount;

  return (
    <div className="mapping-dialog-root">
      <BaklavaDialog
        open={open}
        caption={`Mapping: ${index.name}`}
        onBlDialogClose={() => onClose()}
      >
        <div className="mapping-modal-body">
          {hasEsConn && (
            <div className="mapping-es-actions">
              <BaklavaButton
                variant="secondary"
                size="small"
                disabled={loadingMapping || loadingDocCount}
                onBlClick={() => { void handleFetchMapping(); }}
              >
                {loadingMapping ? "Loading mapping…" : "Load mapping from cluster"}
              </BaklavaButton>
              <BaklavaButton
                variant="secondary"
                size="small"
                disabled={loadingMapping || loadingDocCount}
                onBlClick={() => { void handleFetchDocCount(); }}
              >
                {loadingDocCount ? "Fetching…" : "Fetch live doc count"}
              </BaklavaButton>
            </div>
          )}

          {liveDocCount !== null && (
            <div className="mapping-doccount-row">
              <label className="es-checkbox-row">
                <input
                  type="checkbox"
                  checked={useLiveDocCount}
                  onChange={(e) => setUseLiveDocCount(e.target.checked)}
                />
                <span>
                  Use live doc count:{" "}
                  <strong>{liveDocCount.toLocaleString()}</strong>
                  {" "}(stored: {index.documentCount.toLocaleString()})
                </span>
              </label>
            </div>
          )}

          {fetchError && (
            <p className="es-connect-error" role="alert">{fetchError}</p>
          )}

          <p className="mapping-modal-lead">
            Paste your Elasticsearch mapping JSON. Use Beautify to format it.
          </p>
          <Suspense
            fallback={
              <div className="mapping-json-editor-fallback">Loading editor…</div>
            }
          >
            <MappingJsonEditor value={text} onChange={setText} />
          </Suspense>
        </div>
        <BaklavaButton
          slot="primary-action"
          variant="primary"
          size="large"
          disabled={!canApply}
          onBlClick={() => {
            const r = estimateSizeFromMappingJson(text);
            const sizeGb = estimatedIndexSizeGb(
              r.estimatedBytesPerDocument,
              effectiveDocCount
            );
            const docCountToApply = useLiveDocCount && liveDocCount !== null ? liveDocCount : undefined;
            onApply(text, sizeGb, docCountToApply);
            onClose();
          }}
        >
          Apply estimate
          {useLiveDocCount && liveDocCount !== null
            ? ` (${liveDocCount.toLocaleString()} live docs)`
            : ""}
        </BaklavaButton>
        <BaklavaButton
          slot="secondary-action"
          variant="secondary"
          size="large"
          onBlClick={() => onClose()}
        >
          Cancel
        </BaklavaButton>
      </BaklavaDialog>
    </div>
  );
}

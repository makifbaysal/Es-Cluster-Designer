import { lazy, Suspense, useEffect, useState } from "react";
import type { IndexConfig } from "../types";
import { BaklavaButton, BaklavaDialog } from "../baklava/components";
import {
  estimatedIndexSizeGb,
  estimateSizeFromMappingJson,
} from "../utils/mappingParser";
import { isValidJson } from "../utils/jsonEditorHelpers";

const MappingJsonEditor = lazy(() =>
  import("./MappingJsonEditor").then((m) => ({ default: m.MappingJsonEditor }))
);

type Props = {
  open: boolean;
  index: IndexConfig | null;
  onClose: () => void;
  onApply: (mappingJson: string, computedSizeGb: number) => void;
};

export function MappingModal({ open, index, onClose, onApply }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (open && index) {
      setText(index.mapping ?? "");
    }
  }, [open, index]);

  if (!index) {
    return null;
  }

  const trimmed = text.trim();
  const canApply = trimmed !== "" && isValidJson(text);

  return (
    <div className="mapping-dialog-root">
      <BaklavaDialog
        open={open}
        caption={`Mapping: ${index.name}`}
        onBlDialogClose={() => onClose()}
      >
        <div className="mapping-modal-body">
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
              index.documentCount
            );
            onApply(text, sizeGb);
            onClose();
          }}
        >
          Apply estimate
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

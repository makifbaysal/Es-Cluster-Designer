import { useRef, useState } from "react";
import { BaklavaButton } from "../baklava/components";

type Props = {
  onExportCsv: () => void;
  onImportCsvFile: (file: File) => void;
  onReset: () => void;
  onSaveSnapshot: (label: string) => void;
  showCompare: boolean;
  onToggleCompare: () => void;
};

export function Header({
  onExportCsv,
  onImportCsvFile,
  onReset,
  onSaveSnapshot,
  showCompare,
  onToggleCompare,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [snapLabel, setSnapLabel] = useState("");

  const handleSave = () => {
    const label = snapLabel.trim() || `Snapshot ${new Date().toLocaleString()}`;
    onSaveSnapshot(label);
    setSnapLabel("");
    setSaving(false);
  };

  return (
    <header className="header-bar">
      <h1>Elastic Calculator</h1>
      <div className="actions-row header-actions">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="header-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onImportCsvFile(f);
          }}
        />
        <BaklavaButton variant="secondary" onBlClick={() => fileRef.current?.click()}>
          Import CSV
        </BaklavaButton>
        <BaklavaButton variant="primary" onBlClick={onExportCsv}>
          Download CSV
        </BaklavaButton>
        <BaklavaButton
          variant={showCompare ? "primary" : "secondary"}
          onBlClick={onToggleCompare}
        >
          {showCompare ? "← Calculator" : "Compare"}
        </BaklavaButton>
        <BaklavaButton variant="secondary" onBlClick={() => setSaving((v) => !v)}>
          Save snapshot
        </BaklavaButton>
        <BaklavaButton variant="secondary" onBlClick={onReset}>
          Reset state
        </BaklavaButton>
      </div>
      {saving && (
        <div className="snapshot-save-row">
          <input
            className="snapshot-label-input"
            placeholder="Snapshot label (optional)"
            value={snapLabel}
            onChange={(e) => setSnapLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
          />
          <BaklavaButton variant="primary" size="small" onBlClick={handleSave}>
            Save
          </BaklavaButton>
          <BaklavaButton variant="secondary" size="small" onBlClick={() => setSaving(false)}>
            Cancel
          </BaklavaButton>
        </div>
      )}
    </header>
  );
}

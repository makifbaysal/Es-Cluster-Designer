import { useRef, useState } from "react";
import { BaklavaButton } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  onExportCsv: () => void;
  onImportCsvFile: (file: File) => void;
  onReset: () => void;
  onSaveSnapshot: (label: string) => void;
  onOpenConnectCluster: () => void;
};

export function Header({
  onExportCsv,
  onImportCsvFile,
  onReset,
  onSaveSnapshot,
  onOpenConnectCluster,
}: Props) {
  const { t } = useI18n();
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
        <BaklavaButton variant="secondary" onBlClick={onOpenConnectCluster}>
          {t("headerConnectCluster")}
        </BaklavaButton>
        <BaklavaButton variant="secondary" onBlClick={() => fileRef.current?.click()}>
          {t("importCsv")}
        </BaklavaButton>
        <BaklavaButton variant="primary" onBlClick={onExportCsv}>
          {t("downloadCsv")}
        </BaklavaButton>
        <BaklavaButton variant="secondary" onBlClick={() => setSaving((v) => !v)}>
          {t("saveSnapshot")}
        </BaklavaButton>
        <BaklavaButton variant="secondary" onBlClick={onReset}>
          {t("resetState")}
        </BaklavaButton>
      </div>
      {saving && (
        <div className="snapshot-save-row">
          <input
            className="snapshot-label-input"
            placeholder={t("snapshotPlaceholder")}
            value={snapLabel}
            onChange={(e) => setSnapLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          <BaklavaButton variant="primary" size="small" onBlClick={handleSave}>
            {t("save")}
          </BaklavaButton>
          <BaklavaButton variant="secondary" size="small" onBlClick={() => setSaving(false)}>
            {t("cancel")}
          </BaklavaButton>
        </div>
      )}
    </header>
  );
}

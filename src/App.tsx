import { useMemo, useState } from "react";
import { BaklavaAlert } from "./baklava/components";
import { ClusterConfigForm } from "./components/ClusterConfigForm";
import { ComparePanel } from "./components/ComparePanel";
import { Header } from "./components/Header";
import { IndexList } from "./components/IndexList";
import { MappingModal } from "./components/MappingModal";
import { NodeBreakdownTable } from "./components/NodeBreakdownTable";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { WarningPanel } from "./components/WarningPanel";
import { useElasticCalculatorState } from "./hooks/useLocalStorage";
import type { ClusterConfig, IndexConfig, Snapshot } from "./types";
import { calculateCluster } from "./utils/calculator";
import { buildNodeCsv, downloadCsv } from "./utils/csvExporter";
import {
  appendNodeExportSection,
  buildStateCsv,
  parseStateCsv,
} from "./utils/csvState";
import {
  addSnapshot,
  createEmptyIndex,
  deleteSnapshot,
  loadSnapshots,
} from "./utils/storage";

type ConfigurationSectionProps = {
  cluster: ClusterConfig;
  setCluster: React.Dispatch<React.SetStateAction<ClusterConfig>>;
  indices: IndexConfig[];
  setIndices: React.Dispatch<React.SetStateAction<IndexConfig[]>>;
  reset: () => void;
  onExportCsv: () => void;
  onSaveSnapshot: (label: string) => void;
  showCompare: boolean;
  onToggleCompare: () => void;
};

function ConfigurationSection({
  cluster,
  setCluster,
  indices,
  setIndices,
  reset,
  onExportCsv,
  onSaveSnapshot,
  showCompare,
  onToggleCompare,
}: ConfigurationSectionProps) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingIndexId, setMappingIndexId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const mappingIndex =
    mappingIndexId === null
      ? null
      : indices.find((i) => i.id === mappingIndexId) ?? null;

  const updateIndex = (id: string, next: IndexConfig) => {
    setIndices((prev) => prev.map((x) => (x.id === id ? next : x)));
  };

  const removeIndex = (id: string) => {
    setIndices((prev) => prev.filter((x) => x.id !== id));
  };

  const addIndex = () => {
    setIndices((prev) => [...prev, createEmptyIndex()]);
  };

  const handleReset = () => {
    reset();
    setMappingOpen(false);
    setMappingIndexId(null);
    setImportError(null);
  };

  const handleImportCsvFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const r = parseStateCsv(text);
      if (!r.ok) {
        setImportError(r.message);
        return;
      }
      setCluster(r.state.cluster);
      setIndices(r.state.indices);
      setMappingOpen(false);
      setMappingIndexId(null);
    } catch {
      setImportError("Could not read the file.");
    }
  };

  return (
    <>
      <Header
        onExportCsv={onExportCsv}
        onImportCsvFile={(file) => { void handleImportCsvFile(file); }}
        onReset={handleReset}
        onSaveSnapshot={onSaveSnapshot}
        showCompare={showCompare}
        onToggleCompare={onToggleCompare}
      />
      {importError !== null && (
        <BaklavaAlert
          variant="warning"
          caption="Import failed"
          description={importError}
          closable
          onBlClose={() => setImportError(null)}
        />
      )}
      <ClusterConfigForm cluster={cluster} onChange={setCluster} />
      <IndexList
        indices={indices}
        onChangeIndex={updateIndex}
        onAdd={addIndex}
        onRemove={removeIndex}
        onOpenMapping={(id) => {
          setMappingIndexId(id);
          setMappingOpen(true);
        }}
      />
      <MappingModal
        open={mappingOpen}
        index={mappingIndex}
        onClose={() => {
          setMappingOpen(false);
          setMappingIndexId(null);
        }}
        onApply={(mappingJson, sizeGb) => {
          if (!mappingIndexId) return;
          setIndices((prev) =>
            prev.map((x) =>
              x.id === mappingIndexId
                ? { ...x, mapping: mappingJson, totalSize: sizeGb }
                : x
            )
          );
        }}
      />
    </>
  );
}

export default function App() {
  const { cluster, setCluster, indices, setIndices, reset } =
    useElasticCalculatorState();

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots());
  const [showCompare, setShowCompare] = useState(false);

  const result = useMemo(
    () => calculateCluster(cluster, indices),
    [cluster, indices]
  );

  const handleExport = () => {
    const statePart = buildStateCsv(cluster, indices);
    const full = statePart + appendNodeExportSection(buildNodeCsv(result));
    downloadCsv("elastic-calculator-export.csv", full);
  };

  const handleSaveSnapshot = (label: string) => {
    setSnapshots((prev) => addSnapshot(prev, label, cluster, indices));
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots((prev) => deleteSnapshot(prev, id));
  };

  const handleLoadSnapshot = (snap: Snapshot) => {
    setCluster(snap.cluster);
    setIndices(snap.indices);
    setShowCompare(false);
  };

  return (
    <div className="app-shell">
      <div className="app-grid">
        <div className="app-column">
          <ConfigurationSection
            cluster={cluster}
            setCluster={setCluster}
            indices={indices}
            setIndices={setIndices}
            reset={reset}
            onExportCsv={handleExport}
            onSaveSnapshot={handleSaveSnapshot}
            showCompare={showCompare}
            onToggleCompare={() => setShowCompare((v) => !v)}
          />
        </div>
        <div className="app-column">
          {showCompare ? (
            <ComparePanel
              snapshots={snapshots}
              onDelete={handleDeleteSnapshot}
              onLoad={handleLoadSnapshot}
            />
          ) : (
            <>
              <RecommendationPanel result={result} items={result.recommendations} />
              <WarningPanel items={result.warnings} />
              <NodeBreakdownTable result={result} cluster={cluster} indices={indices} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

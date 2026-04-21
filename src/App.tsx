import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  BaklavaAccordion,
  BaklavaAccordionGroup,
  BaklavaAlert,
  BaklavaButton,
} from "./baklava/components";
import { AdvancedPlanningForm } from "./components/AdvancedPlanningForm";
import { ClusterConfigForm } from "./components/ClusterConfigForm";
import { EsConnectionModal } from "./components/EsConnectionModal";
import type { EsConnection } from "./components/EsConnectionPanel";
import { AppTopNav } from "./components/AppTopNav";
import { ComparePanel } from "./components/ComparePanel";
import { CostComparePanel } from "./components/CostComparePanel";
import { Header } from "./components/Header";
import { IndexList } from "./components/IndexList";
import { MappingModal } from "./components/MappingModal";
import { NodeBreakdownTable } from "./components/NodeBreakdownTable";
import { DesignerSummaryColumn } from "./components/DesignerSummaryColumn";
import { useElasticCalculatorState } from "./hooks/useLocalStorage";
import { I18nProvider, useI18n } from "./i18n/I18nContext";
import type {
  AppMainView,
  ClusterConfig,
  IndexConfig,
  IndexInsightBuckets,
  RecommendationItem,
  Snapshot,
  WarningItem,
} from "./types";
import { calculateCluster } from "./utils/calculator";
import { buildNodeCsv, downloadCsv } from "./utils/csvExporter";
import {
  appendNodeExportSection,
  buildStateCsv,
  parseStateCsv,
} from "./utils/csvState";
import {
  mergeTopologyWithCostPlanning,
  planningFieldsFromCluster,
} from "./utils/costViewMerge";
import { COMPARE_NONE, COMPARE_WORKSPACE } from "./utils/compareSources";
import {
  addSnapshot,
  createEmptyIndex,
  deleteSnapshot,
  loadSnapshots,
} from "./utils/storage";

type Persisted = ReturnType<typeof useElasticCalculatorState>;

type ConfigurationSectionProps = {
  mainView: AppMainView;
  cluster: ClusterConfig;
  setCluster: Persisted["setCluster"];
  indices: IndexConfig[];
  setIndices: Persisted["setIndices"];
  reset: Persisted["reset"];
  onExportCsv: () => void;
  onSaveSnapshot: (label: string) => void;
  esConnection: EsConnection | null;
  onConnectionChange: (conn: EsConnection | null) => void;
  snapshots: Snapshot[];
  costCluster: ClusterConfig;
  costResult: ReturnType<typeof calculateCluster>;
  onCostPlanningChange: (next: ClusterConfig) => void;
  onLoadSnapshot: (snap: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  indexInsightBuckets: IndexInsightBuckets;
};

function ConfigurationSection({
  mainView,
  cluster,
  setCluster,
  indices,
  setIndices,
  reset,
  onExportCsv,
  onSaveSnapshot,
  esConnection,
  onConnectionChange,
  snapshots,
  costCluster,
  costResult,
  onCostPlanningChange,
  onLoadSnapshot,
  onDeleteSnapshot,
  indexInsightBuckets,
}: ConfigurationSectionProps) {
  const { t } = useI18n();
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingIndexId, setMappingIndexId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [esModalOpen, setEsModalOpen] = useState(false);
  const [ilmPoliciesJson, setIlmPoliciesJson] = useState("");
  const [indexTemplatesJson, setIndexTemplatesJson] = useState("");

  useEffect(() => {
    if (!esConnection) {
      setIlmPoliciesJson("");
      setIndexTemplatesJson("");
    }
  }, [esConnection]);

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
    setIlmPoliciesJson("");
    setIndexTemplatesJson("");
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

  const connectModal = (
    <EsConnectionModal
      open={esModalOpen}
      onClose={() => setEsModalOpen(false)}
      setCluster={setCluster}
      setIndices={setIndices}
      onConnectionChange={onConnectionChange}
      onClusterInsightsData={(d) => {
        if (d.ilmPoliciesJson !== undefined) setIlmPoliciesJson(d.ilmPoliciesJson);
        if (d.indexTemplatesJson !== undefined) setIndexTemplatesJson(d.indexTemplatesJson);
      }}
    />
  );

  const mappingModal = (
    <MappingModal
      open={mappingOpen}
      index={mappingIndex}
      esConnection={esConnection}
      onClose={() => {
        setMappingOpen(false);
        setMappingIndexId(null);
      }}
      onApply={(mappingJson, sizeGb, docCount) => {
        if (!mappingIndexId) return;
        setIndices((prev) =>
          prev.map((x) =>
            x.id === mappingIndexId
              ? {
                  ...x,
                  mapping: mappingJson,
                  totalSize: sizeGb,
                  ...(docCount !== undefined ? { documentCount: docCount } : {}),
                }
              : x
          )
        );
      }}
    />
  );

  if (mainView === "compare") {
    return (
      <section className="panel compare-sidebar-panel">
        <h2 className="panel-title">{t("compare")}</h2>
        <BaklavaAlert variant="info" description={t("compareSidebarHint")} />
        <p className="compare-snap-list-title">{t("comparePickTitle")}</p>
        <p className="compare-snap-list-sub">{t("compareSnapListSubtitle")}</p>
        {snapshots.length === 0 ? (
          <BaklavaAlert
            variant="info"
            caption={t("compareNoSnapshotsTitle")}
            description={t("compareNoSnapshotsBody")}
          />
        ) : (
          <div className="alert-stack compare-snap-pick-stack">
            {snapshots.map((s) => (
              <div key={s.id} className="compare-snap-item">
                <div className="compare-snap-item-info">
                  <strong>{s.label}</strong>
                  <span>{new Date(s.savedAt).toLocaleString()}</span>
                  <span>
                    {t("compareSnapLine")
                      .replace("{nodes}", String(s.cluster.dataNodeCount))
                      .replace("{indices}", String(s.indices.length))}
                  </span>
                </div>
                <div className="compare-snap-item-actions">
                  <BaklavaButton
                    size="small"
                    variant="secondary"
                    onBlClick={() => onLoadSnapshot(s)}
                  >
                    {t("compareLoadDesigner")}
                  </BaklavaButton>
                  <BaklavaButton
                    size="small"
                    kind="danger"
                    variant="secondary"
                    onBlClick={() => onDeleteSnapshot(s.id)}
                  >
                    {t("compareDeleteSnapshot")}
                  </BaklavaButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (mainView === "cost") {
    return (
      <section className="panel compare-sidebar-panel">
        <h2 className="panel-title">{t("navCost")}</h2>
        <BaklavaAlert variant="info" description={t("costSidebarHint")} />
        <p className="compare-snap-list-title">{t("comparePickTitle")}</p>
        <p className="compare-snap-list-sub">{t("compareSnapListSubtitle")}</p>
        {snapshots.length === 0 ? (
          <BaklavaAlert
            variant="info"
            caption={t("costNoSnapshotsTitle")}
            description={t("costNoSnapshotsBody")}
          />
        ) : (
          <div className="alert-stack compare-snap-pick-stack">
            {snapshots.map((s) => (
              <div key={s.id} className="compare-snap-item">
                <div className="compare-snap-item-info">
                  <strong>{s.label}</strong>
                  <span>{new Date(s.savedAt).toLocaleString()}</span>
                  <span>
                    {t("compareSnapLine")
                      .replace("{nodes}", String(s.cluster.dataNodeCount))
                      .replace("{indices}", String(s.indices.length))}
                  </span>
                </div>
                <div className="compare-snap-item-actions">
                  <BaklavaButton
                    size="small"
                    variant="secondary"
                    onBlClick={() => onLoadSnapshot(s)}
                  >
                    {t("compareLoadDesigner")}
                  </BaklavaButton>
                  <BaklavaButton
                    size="small"
                    kind="danger"
                    variant="secondary"
                    onBlClick={() => onDeleteSnapshot(s.id)}
                  >
                    {t("compareDeleteSnapshot")}
                  </BaklavaButton>
                </div>
              </div>
            ))}
          </div>
        )}
        <AdvancedPlanningForm
          cluster={costCluster}
          onChange={onCostPlanningChange}
          result={costResult}
          formatMonthlyUsd
          hideSummary
        />
      </section>
    );
  }

  return (
    <>
      <Header
        onExportCsv={onExportCsv}
        onImportCsvFile={(file) => { void handleImportCsvFile(file); }}
        onReset={handleReset}
        onSaveSnapshot={onSaveSnapshot}
        onOpenConnectCluster={() => setEsModalOpen(true)}
      />
      {importError !== null && (
        <BaklavaAlert
          variant="warning"
          caption={t("importFailed")}
          description={importError}
          closable
          onBlClose={() => setImportError(null)}
        />
      )}
      <div className="config-accordion-stack">
        <BaklavaAccordionGroup multiple>
          <BaklavaAccordion caption={t("cluster")} open>
            <ClusterConfigForm
              cluster={cluster}
              onChange={setCluster}
              embedded
            />
          </BaklavaAccordion>
          <BaklavaAccordion caption={t("indices")} open>
            <IndexList
              indices={indices}
              onChangeIndex={updateIndex}
              onAdd={addIndex}
              onRemove={removeIndex}
              embedded
              esConnection={esConnection}
              ilmPoliciesJson={ilmPoliciesJson}
              indexTemplatesJson={indexTemplatesJson}
              indexInsightBuckets={indexInsightBuckets}
              onOpenMapping={(id) => {
                setMappingIndexId(id);
                setMappingOpen(true);
              }}
            />
          </BaklavaAccordion>
        </BaklavaAccordionGroup>
      </div>
      {connectModal}
      {mappingModal}
    </>
  );
}

function AppMain({
  cluster,
  setCluster,
  indices,
  setIndices,
  reset,
  theme,
  setTheme,
}: Persisted) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots());
  const [mainView, setMainView] = useState<AppMainView>("designer");
  const [costColA, setCostColA] = useState(COMPARE_WORKSPACE);
  const [costColB, setCostColB] = useState("");
  const [costColC, setCostColC] = useState(COMPARE_NONE);
  const [compareColA, setCompareColA] = useState(COMPARE_WORKSPACE);
  const [compareColB, setCompareColB] = useState("");
  const [compareColC, setCompareColC] = useState(COMPARE_NONE);
  const [esConnection, setEsConnection] = useState<EsConnection | null>(null);

  const result = useMemo(
    () => calculateCluster(cluster, indices, undefined),
    [cluster, indices]
  );

  const designerIndexInsightBuckets = useMemo((): IndexInsightBuckets => {
    const wm = new Map<string, WarningItem[]>();
    const rm = new Map<string, RecommendationItem[]>();
    for (const w of result.warnings) {
      if (!w.indexId) continue;
      const a = wm.get(w.indexId) ?? [];
      a.push(w);
      wm.set(w.indexId, a);
    }
    for (const r of result.recommendations) {
      if (!r.indexId) continue;
      const a = rm.get(r.indexId) ?? [];
      a.push(r);
      rm.set(r.indexId, a);
    }
    return { warningsByIndexId: wm, recommendationsByIndexId: rm };
  }, [result.warnings, result.recommendations]);

  const [costPlanning, setCostPlanning] = useState<Partial<ClusterConfig>>({});

  useLayoutEffect(() => {
    if (mainView !== "cost") return;
    setCostPlanning(planningFieldsFromCluster(cluster));
  }, [mainView, cluster]);

  const costCluster = useMemo(
    () => mergeTopologyWithCostPlanning(cluster, costPlanning),
    [cluster, costPlanning]
  );

  const costResult = useMemo(
    () => calculateCluster(costCluster, indices, undefined),
    [costCluster, indices]
  );

  useEffect(() => {
    const valid = new Set(snapshots.map((s) => s.id));
    setCompareColA((a) => {
      if (a === COMPARE_WORKSPACE) return a;
      return valid.has(a) ? a : COMPARE_WORKSPACE;
    });
    setCompareColB((b) => {
      if (snapshots.length === 0) {
        if (b !== COMPARE_WORKSPACE && b !== "" && !valid.has(b)) return "";
        return b === COMPARE_NONE ? "" : b;
      }
      if (b === "" || b === COMPARE_NONE) return snapshots[0].id;
      if (b === COMPARE_WORKSPACE) return b;
      return valid.has(b) ? b : snapshots[0].id;
    });
    setCompareColC((c) => {
      if (c === COMPARE_NONE) return c;
      if (c === COMPARE_WORKSPACE) return c;
      if (snapshots.length === 0) return COMPARE_NONE;
      return valid.has(c) ? c : COMPARE_NONE;
    });
    setCostColA((a) => {
      if (a === COMPARE_WORKSPACE) return a;
      return valid.has(a) ? a : COMPARE_WORKSPACE;
    });
    setCostColB((b) => {
      if (snapshots.length === 0) {
        if (b !== COMPARE_WORKSPACE && b !== "" && !valid.has(b)) return "";
        return b === COMPARE_NONE ? "" : b;
      }
      if (b === "" || b === COMPARE_NONE) return snapshots[0].id;
      if (b === COMPARE_WORKSPACE) return b;
      return valid.has(b) ? b : snapshots[0].id;
    });
    setCostColC((c) => {
      if (c === COMPARE_NONE) return c;
      if (c === COMPARE_WORKSPACE) return c;
      if (snapshots.length === 0) return COMPARE_NONE;
      return valid.has(c) ? c : COMPARE_NONE;
    });
  }, [snapshots]);

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
    setCostColA((a) => (a === id ? COMPARE_WORKSPACE : a));
    setCostColB((b) => (b === id ? "" : b));
    setCostColC((c) => (c === id ? COMPARE_NONE : c));
    setCompareColA((a) => (a === id ? COMPARE_WORKSPACE : a));
    setCompareColB((b) => (b === id ? "" : b));
    setCompareColC((c) => (c === id ? COMPARE_NONE : c));
  };

  const handleLoadSnapshot = (snap: Snapshot) => {
    setCluster(snap.cluster);
    setIndices(snap.indices);
    setMainView("designer");
  };

  return (
    <>
      <AppTopNav
        theme={theme}
        setTheme={setTheme}
        mainView={mainView}
        setMainView={setMainView}
      />
      <div className="app-shell">
      <div
        className={
          mainView === "cost" || mainView === "compare"
            ? "app-grid app-grid--compare"
            : "app-grid"
        }
      >
        <div
          className={
            mainView === "cost" || mainView === "compare"
              ? "app-column app-column--compare-sidebar"
              : "app-column"
          }
        >
          <ConfigurationSection
            mainView={mainView}
            cluster={cluster}
            setCluster={setCluster}
            indices={indices}
            setIndices={setIndices}
            reset={reset}
            onExportCsv={handleExport}
            onSaveSnapshot={handleSaveSnapshot}
            esConnection={esConnection}
            onConnectionChange={(c) => {
              setEsConnection(c);
            }}
            snapshots={snapshots}
            costCluster={costCluster}
            costResult={costResult}
            onCostPlanningChange={(next) => {
              setCostPlanning(planningFieldsFromCluster(next));
            }}
            onLoadSnapshot={handleLoadSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            indexInsightBuckets={designerIndexInsightBuckets}
          />
        </div>
        {mainView === "cost" || mainView === "compare" ? (
          <div className="app-column">
            {mainView === "compare" ? (
              <ComparePanel
                workspaceCluster={cluster}
                workspaceIndices={indices}
                snapshots={snapshots}
                colA={compareColA}
                colB={compareColB}
                colC={compareColC}
                setCompareColA={setCompareColA}
                setCompareColB={setCompareColB}
                setCompareColC={setCompareColC}
              />
            ) : (
              <CostComparePanel
                workspaceCluster={cluster}
                workspaceIndices={indices}
                snapshots={snapshots}
                colA={costColA}
                colB={costColB}
                colC={costColC}
                setColA={setCostColA}
                setColB={setCostColB}
                setColC={setCostColC}
                costPlanning={costPlanning}
              />
            )}
          </div>
        ) : (
          <div className="app-column">
            <>
              <div className="designer-results-stack">
                <DesignerSummaryColumn result={result} />
                <NodeBreakdownTable
                  theme={theme}
                  result={result}
                  cluster={cluster}
                  indices={indices}
                />
              </div>
            </>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

export default function App() {
  const persisted = useElasticCalculatorState();
  useEffect(() => {
    document.documentElement.dataset.theme =
      persisted.theme === "dark" ? "dark" : "light";
  }, [persisted.theme]);

  return (
    <I18nProvider locale={persisted.locale} setLocale={persisted.setLocale}>
      <AppMain {...persisted} />
    </I18nProvider>
  );
}

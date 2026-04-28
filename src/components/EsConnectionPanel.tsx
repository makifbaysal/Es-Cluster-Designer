import { useCallback, useState } from "react";
import type { ClusterConfig, IndexConfig } from "../types";
import {
  buildEsHeaders,
  catRowsToIndexConfigs,
  fetchAllMappings,
  fetchCatIndices,
  fetchClusterHints,
  fetchIlmPoliciesJson,
  fetchIndexTemplatesJson,
  normalizeElasticsearchUrl,
  probeElasticsearchAccess,
  shouldUseElasticsearchProxy,
  verifyElasticsearchConnection,
  type EsAuth,
  type ProbeResult,
} from "../utils/elasticsearchClient";
import { BaklavaButton, BaklavaInput } from "../baklava/components";
import { BaklavaInputWithInfoHint } from "./BaklavaInputWithInfoHint";
import { useI18n } from "../i18n/I18nContext";

type AuthMode = "none" | "basic" | "apiKey";

export type EsConnection = {
  baseUrl: string;
  headers: Record<string, string>;
};

export type EsClusterInsightsCachePayload = {
  ilmPoliciesJson?: string;
  indexTemplatesJson?: string;
};

type Props = {
  setCluster: React.Dispatch<React.SetStateAction<ClusterConfig>>;
  setIndices: React.Dispatch<React.SetStateAction<IndexConfig[]>>;
  onConnectionChange?: (conn: EsConnection | null) => void;
  onClusterInsightsData?: (data: EsClusterInsightsCachePayload) => void;
};

function readValue(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function applyClusterPatch(
  prev: ClusterConfig,
  patch: Partial<ClusterConfig>
): ClusterConfig {
  const next = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  return next;
}

function probePresentation(probe: ProbeResult | null): {
  title: string;
  className: string;
  detail?: string;
} | null {
  if (!probe) return null;
  if (probe.kind === "anonymous_ok") {
    return {
      title: "Reachable without credentials (/_cluster/health)",
      className: "es-badge es-badge-ok",
    };
  }
  if (probe.kind === "auth_required") {
    return {
      title: "Server returned 401/403 — authentication is required",
      className: "es-badge es-badge-warn",
      detail:
        "This response comes from Elasticsearch (not a browser CORS block). Add username/password or API key, then Connect.",
    };
  }
  return {
    title: "Could not complete anonymous check",
    className: "es-badge es-badge-bad",
    detail: probe.message,
  };
}

export function EsConnectionPanel({
  setCluster,
  setIndices,
  onConnectionChange,
  onClusterInsightsData,
}: Props) {
  const { t } = useI18n();
  const [baseUrl, setBaseUrl] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [connected, setConnected] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hintNotes, setHintNotes] = useState<string[] | null>(null);

  const [includeSystemIndices, setIncludeSystemIndices] = useState(false);
  const [pullClusterHints, setPullClusterHints] = useState(true);
  const [indicesPull, setIndicesPull] = useState<"none" | "replace" | "merge">("none");
  const [pullIlmPolicies, setPullIlmPolicies] = useState(false);
  const [pullIndexTemplates, setPullIndexTemplates] = useState(false);

  const buildAuth = useCallback((): EsAuth => {
    if (authMode === "basic") {
      return { kind: "basic", username, password };
    }
    if (authMode === "apiKey") {
      return { kind: "apiKey", apiKey };
    }
    return { kind: "none" };
  }, [authMode, username, password, apiKey]);

  const normalizedUrl = normalizeElasticsearchUrl(baseUrl);

  const handleProbe = async () => {
    setProbe(null);
    setConnectError(null);
    if (!normalizedUrl) {
      setProbe({ kind: "error", message: "Enter a valid cluster URL (https://host:port)." });
      return;
    }
    setBusy("probe");
    try {
      const r = await probeElasticsearchAccess(normalizedUrl);
      setProbe(r);
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = async () => {
    setConnectError(null);
    setHintNotes(null);
    if (!normalizedUrl) {
      setConnectError("Enter a valid cluster URL (https://host:port).");
      return;
    }
    setBusy("connect");
    try {
      const headers = buildEsHeaders(buildAuth());
      const v = await verifyElasticsearchConnection(normalizedUrl, headers);
      if (!v.ok) {
        setConnected(false);
        setConnectError(
          v.status === 401 || v.status === 403
            ? `${v.message} (check username/password or API key)`
            : v.message
        );
        return;
      }
      setConnected(true);
      onConnectionChange?.({ baseUrl: normalizedUrl, headers });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setConnectError(null);
    setHintNotes(null);
    setPassword("");
    setApiKey("");
    setPullClusterHints(true);
    setIndicesPull("none");
    setPullIlmPolicies(false);
    setPullIndexTemplates(false);
    onConnectionChange?.(null);
  };

  const headersForRequests = () => {
    if (!normalizedUrl) return null;
    return buildEsHeaders(buildAuth());
  };

  const runClusterHints = async (): Promise<boolean> => {
    if (!normalizedUrl) return false;
    const headers = headersForRequests();
    if (!headers) return false;
    setConnectError(null);
    const r = await fetchClusterHints(normalizedUrl, headers);
    if (!r.ok) {
      setConnectError(r.message);
      return false;
    }
    setCluster((c) => applyClusterPatch(c, r.patch));
    setHintNotes(r.notes);
    return true;
  };

  const runFillIndices = async (mode: "replace" | "merge"): Promise<boolean> => {
    if (!normalizedUrl) return false;
    const headers = headersForRequests();
    if (!headers) return false;
    setConnectError(null);
    const r = await fetchCatIndices(normalizedUrl, headers);
    if (!r.ok) {
      setConnectError(r.message);
      return false;
    }
    const imported = catRowsToIndexConfigs(r.rows, includeSystemIndices);
    if (imported.length === 0) {
      setConnectError("No open indices matched (try including system indices).");
      return false;
    }
    const mappingsR = await fetchAllMappings(normalizedUrl, headers, includeSystemIndices);
    const mappingsByIndex = mappingsR.ok ? mappingsR.mappingsByIndex : {};
    const mappedCount = Object.keys(mappingsByIndex).length;
    const withMappings = imported.map((idx) =>
      mappingsByIndex[idx.name] ? { ...idx, mapping: mappingsByIndex[idx.name] } : idx
    );
    if (mode === "replace") {
      setIndices(withMappings);
    } else {
      setIndices((prev) => {
        const names = new Set(prev.map((i) => i.name));
        const toAdd = withMappings.filter((i) => !names.has(i.name));
        return [...prev, ...toAdd];
      });
    }
    const docNote = `Doc counts loaded from cluster (${withMappings.length} entries).`;
    const mapNote = mappingsR.ok
      ? `Mappings fetched for ${mappedCount} entries — vector analysis applied.`
      : `Mappings could not be fetched — vector analysis skipped.`;
    setHintNotes((prev) => [...(prev ?? []), docNote, mapNote]);
    return true;
  };

  const handleFetchSelected = async () => {
    if (!normalizedUrl || !connected) return;
    if (
      !pullClusterHints &&
      indicesPull === "none" &&
      !pullIlmPolicies &&
      !pullIndexTemplates
    ) {
      setConnectError(t("esSelectFetchTarget"));
      return;
    }
    if (indicesPull === "replace") {
      const ok = window.confirm(t("esConfirmReplace"));
      if (!ok) return;
    }
    setConnectError(null);
    const hdr = headersForRequests();
    if (!hdr) {
      setConnectError("Missing headers.");
      return;
    }
    setBusy("fetch");
    try {
      if (pullClusterHints) {
        const ok = await runClusterHints();
        if (!ok) return;
      }
      if (indicesPull === "replace") {
        const ok = await runFillIndices("replace");
        if (!ok) return;
      } else if (indicesPull === "merge") {
        const ok = await runFillIndices("merge");
        if (!ok) return;
      }
      if (pullIlmPolicies) {
        const r = await fetchIlmPoliciesJson(normalizedUrl, hdr);
        if (!r.ok) {
          setConnectError(r.message);
          return;
        }
        onClusterInsightsData?.({ ilmPoliciesJson: r.raw });
      }
      if (pullIndexTemplates) {
        const r = await fetchIndexTemplatesJson(normalizedUrl, hdr);
        if (!r.ok) {
          setConnectError(r.message);
          return;
        }
        onClusterInsightsData?.({ indexTemplatesJson: r.raw });
      }
    } finally {
      setBusy(null);
    }
  };

  const probeUi = probePresentation(probe);

  return (
    <div className="es-connection-inner">
      <div className="field-grid">
        <BaklavaInput
          label="Cluster URL"
          value={baseUrl}
          placeholder="https://localhost:9200"
          onBlInput={(e) => {
            setBaseUrl(readValue(e));
            setConnected(false);
            setProbe(null);
          }}
        />
        {shouldUseElasticsearchProxy() && (
          <p className="es-proxy-footnote">
            Traffic is proxied through this dev server (no ES CORS). For production builds, use npm
            run preview from http://127.0.0.1 or http://localhost, or configure Elasticsearch CORS.
          </p>
        )}

        <div className="cluster-toggle-row">
          <span className="index-shard-label">Authentication</span>
          <select
            className="es-select"
            value={authMode}
            onChange={(e) => {
              setAuthMode(e.target.value as AuthMode);
              setConnected(false);
            }}
            aria-label="Authentication mode"
          >
            <option value="none">None</option>
            <option value="basic">Username / password</option>
            <option value="apiKey">API key</option>
          </select>
        </div>

        {authMode === "basic" && (
          <>
            <BaklavaInput
              label="Username"
              value={username}
              onBlInput={(e) => {
                setUsername(readValue(e));
                setConnected(false);
              }}
            />
            <BaklavaInput
              type="password"
              label="Password"
              value={password}
              onBlInput={(e) => {
                setPassword(readValue(e));
                setConnected(false);
              }}
            />
          </>
        )}

        {authMode === "apiKey" && (
          <BaklavaInputWithInfoHint
            label="API key"
            value={apiKey}
            infoHint={t("esApiKeyHoverHint")}
            onBlInput={(e) => {
              setApiKey(readValue(e));
              setConnected(false);
            }}
          />
        )}
      </div>

      <div className="actions-row es-connection-actions">
        <BaklavaButton
          variant="secondary"
          size="small"
          disabled={busy !== null}
          onBlClick={() => {
            void handleProbe();
          }}
        >
          {busy === "probe" ? "Checking…" : "Test without credentials"}
        </BaklavaButton>
        {!connected ? (
          <BaklavaButton
            size="small"
            disabled={busy !== null}
            onBlClick={() => {
              void handleConnect();
            }}
          >
            {busy === "connect" ? "Connecting…" : "Connect"}
          </BaklavaButton>
        ) : (
          <BaklavaButton
            variant="secondary"
            size="small"
            disabled={busy !== null}
            onBlClick={handleDisconnect}
          >
            Disconnect
          </BaklavaButton>
        )}
      </div>

      {probeUi && (
        <div className="es-probe-block" role="status">
          <p className="es-probe-line">
            <span className={probeUi.className}>{probeUi.title}</span>
          </p>
          {probeUi.detail !== undefined && probeUi.detail !== "" && (
            <p className="es-probe-detail">{probeUi.detail}</p>
          )}
        </div>
      )}

      {connected && (
        <div className="es-connected-block">
          <p className="es-connected-line">
            <span className="es-badge es-badge-ok">{t("esConnected")}</span>
          </p>
          <label className="es-checkbox-row">
            <input
              type="checkbox"
              checked={includeSystemIndices}
              onChange={(e) => setIncludeSystemIndices(e.target.checked)}
            />
            <span>{t("esIncludeSystemIndices")}</span>
          </label>

          <div className="es-fetch-options">
            <label className="es-checkbox-row">
              <input
                type="checkbox"
                checked={pullClusterHints}
                onChange={(e) => setPullClusterHints(e.target.checked)}
              />
              <span>{t("esOptClusterHints")}</span>
            </label>
            <label className="es-checkbox-row">
              <input
                type="checkbox"
                checked={pullIlmPolicies}
                onChange={(e) => setPullIlmPolicies(e.target.checked)}
              />
              <span>{t("esOptFetchIlm")}</span>
            </label>
            <label className="es-checkbox-row">
              <input
                type="checkbox"
                checked={pullIndexTemplates}
                onChange={(e) => setPullIndexTemplates(e.target.checked)}
              />
              <span>{t("esOptFetchIndexTpl")}</span>
            </label>
            <div className="es-radio-group" role="group" aria-label={t("esOptIndicesLabel")}>
              <span className="index-shard-label es-radio-group-label">{t("esOptIndicesLabel")}</span>
              <label className="es-radio-row">
                <input
                  type="radio"
                  name="es-indices-pull"
                  checked={indicesPull === "none"}
                  onChange={() => setIndicesPull("none")}
                />
                <span>{t("esOptIdxNone")}</span>
              </label>
              <label className="es-radio-row">
                <input
                  type="radio"
                  name="es-indices-pull"
                  checked={indicesPull === "replace"}
                  onChange={() => setIndicesPull("replace")}
                />
                <span>{t("esOptIdxReplace")}</span>
              </label>
              <label className="es-radio-row">
                <input
                  type="radio"
                  name="es-indices-pull"
                  checked={indicesPull === "merge"}
                  onChange={() => setIndicesPull("merge")}
                />
                <span>{t("esOptIdxMerge")}</span>
              </label>
            </div>
            <div className="actions-row es-fetch-selected-row">
              <BaklavaButton
                variant="primary"
                size="small"
                disabled={busy !== null}
                onBlClick={() => {
                  void handleFetchSelected();
                }}
              >
                {busy === "fetch" ? t("busy") : t("esFetchSelected")}
              </BaklavaButton>
            </div>
          </div>
          <p className="es-help-muted es-hint-cluster">{t("esClusterHintsHelp")}</p>
        </div>
      )}

      {hintNotes && hintNotes.length > 0 && (
        <ul className="es-notes-list">
          {hintNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {connectError && (
        <p className="es-connect-error" role="alert">
          {connectError}
        </p>
      )}
    </div>
  );
}

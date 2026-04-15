import { useCallback, useState } from "react";
import type { ClusterConfig, IndexConfig } from "../types";
import {
  buildEsHeaders,
  catRowsToIndexConfigs,
  fetchCatIndices,
  fetchClusterHints,
  normalizeElasticsearchUrl,
  probeElasticsearchAccess,
  shouldUseElasticsearchProxy,
  verifyElasticsearchConnection,
  type EsAuth,
  type ProbeResult,
} from "../utils/elasticsearchClient";
import { BaklavaButton, BaklavaInput } from "../baklava/components";

type AuthMode = "none" | "basic" | "apiKey";

type Props = {
  setCluster: React.Dispatch<React.SetStateAction<ClusterConfig>>;
  setIndices: React.Dispatch<React.SetStateAction<IndexConfig[]>>;
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

export function EsConnectionPanel({ setCluster, setIndices }: Props) {
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
  };

  const headersForRequests = () => {
    if (!normalizedUrl) return null;
    return buildEsHeaders(buildAuth());
  };

  const handleFillIndices = async (mode: "replace" | "merge") => {
    if (!normalizedUrl || !connected) return;
    const headers = headersForRequests();
    if (!headers) return;

    if (mode === "replace") {
      const ok = window.confirm(
        "Replace all calculator indices with open indices from the cluster? (Respects the system-indices checkbox below.)"
      );
      if (!ok) return;
    }

    setBusy("indices");
    setConnectError(null);
    try {
      const r = await fetchCatIndices(normalizedUrl, headers);
      if (!r.ok) {
        setConnectError(r.message);
        return;
      }
      const imported = catRowsToIndexConfigs(r.rows, includeSystemIndices);
      if (imported.length === 0) {
        setConnectError("No open indices matched (try including system indices).");
        return;
      }
      if (mode === "replace") {
        setIndices(imported);
      } else {
        setIndices((prev) => {
          const names = new Set(prev.map((i) => i.name));
          const toAdd = imported.filter((i) => !names.has(i.name));
          return [...prev, ...toAdd];
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleClusterHints = async () => {
    if (!normalizedUrl || !connected) return;
    const headers = headersForRequests();
    if (!headers) return;

    setBusy("cluster");
    setConnectError(null);
    setHintNotes(null);
    try {
      const r = await fetchClusterHints(normalizedUrl, headers);
      if (!r.ok) {
        setConnectError(r.message);
        return;
      }
      setCluster((c) => applyClusterPatch(c, r.patch));
      setHintNotes(r.notes);
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
        <p className="es-proxy-footnote">
          {shouldUseElasticsearchProxy()
            ? "Local dev: use npm run dev or npm run preview so traffic is proxied (no ES CORS). Plain static hosts (serve dist/, nginx, file://) will not load the proxy and cluster calls will fail."
            : "This origin talks to Elasticsearch directly — the cluster must allow CORS, or open the UI from http://127.0.0.1 with npm run dev / preview."}
        </p>

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
          <BaklavaInput
            label="API key"
            value={apiKey}
            helpText="Paste the Base64 key from Kibana, or id:api_key (colon form is Base64-encoded for the ApiKey header)"
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
            <span className="es-badge es-badge-ok">Connected</span>
          </p>
          <label className="es-checkbox-row">
            <input
              type="checkbox"
              checked={includeSystemIndices}
              onChange={(e) => setIncludeSystemIndices(e.target.checked)}
            />
            <span>Include system indices (names starting with &ldquo;.&rdquo;)</span>
          </label>
          <div className="actions-row">
            <BaklavaButton
              variant="secondary"
              size="small"
              disabled={busy !== null}
              onBlClick={() => {
                void handleFillIndices("replace");
              }}
            >
              {busy === "indices" ? "Loading…" : "Replace indices from cluster"}
            </BaklavaButton>
            <BaklavaButton
              variant="secondary"
              size="small"
              disabled={busy !== null}
              onBlClick={() => {
                void handleFillIndices("merge");
              }}
            >
              {busy === "indices" ? "Loading…" : "Add missing indices from cluster"}
            </BaklavaButton>
            <BaklavaButton
              variant="secondary"
              size="small"
              disabled={busy !== null}
              onBlClick={() => {
                void handleClusterHints();
              }}
            >
              {busy === "cluster" ? "Loading…" : "Apply cluster hints from nodes"}
            </BaklavaButton>
          </div>
          <p className="es-help-muted es-hint-cluster">
            &ldquo;Cluster hints&rdquo; updates node counts, average RAM per data node, and total
            disk from <code>_cluster/stats</code> and <code>_cat/nodes</code>; review values if
            nodes share roles.
          </p>
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

import { getElasticDevProxyUrl } from "../elasticDevProxy";
import type { ClusterConfig, IndexConfig } from "../types";
import { generateIndexId } from "./storage";

export type EsAuth =
  | { kind: "none" }
  | { kind: "basic"; username: string; password: string }
  | { kind: "apiKey"; apiKey: string };

export function normalizeElasticsearchUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let u = t;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  u = u.replace(/\/$/, "");
  try {
    const parsed = new URL(u);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${utf8ToBase64(`${user}:${pass}`)}`;
}

export function buildEsHeaders(auth: EsAuth): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.kind === "basic" && auth.username.trim()) {
    headers.Authorization = basicAuthHeader(auth.username.trim(), auth.password);
  } else if (auth.kind === "apiKey" && auth.apiKey.trim()) {
    const raw = auth.apiKey.trim();
    if (/^ApiKey\s+/i.test(raw)) {
      headers.Authorization = raw.replace(/^apikey\s+/i, "ApiKey ");
    } else if (raw.includes(":")) {
      headers.Authorization = `ApiKey ${utf8ToBase64(raw)}`;
    } else {
      headers.Authorization = `ApiKey ${raw}`;
    }
  }
  return headers;
}

type EsFetchFail = { ok: false; status: number; message: string };
type EsFetchOk<T> = { ok: true; data: T };

/**
 * When true, requests go through the Vite dev/preview proxy (/__elastic-proxy).
 * In production (static deploy), requests go directly from the browser to ES —
 * ES must have CORS configured, or the user must be on a VPN that allows direct access.
 */
export function shouldUseElasticsearchProxy(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return false;
  if (import.meta.env.DEV) return true;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function isCrossOriginElasticsearchRequest(baseUrl: string): boolean {
  try {
    const app = new URL(window.location.href);
    const target = new URL(baseUrl);
    return app.origin !== target.origin;
  } catch {
    return true;
  }
}

function messageForBrowserFetchFailure(baseUrl: string): string {
  const cross = isCrossOriginElasticsearchRequest(baseUrl);
  const proxied = shouldUseElasticsearchProxy();
  if (cross && !proxied) {
    return (
      "The browser blocked this request (CORS). " +
      "Make sure you are connected to the VPN so your browser can reach Elasticsearch directly, " +
      "or add http.cors.enabled / http.cors.allow-origin to your elasticsearch.yml for this origin."
    );
  }
  return (
    "Could not reach Elasticsearch (wrong URL/port, VPN not connected, or TLS/certificate rejected). " +
    "If you use HTTPS against a self-signed cert, the browser may block the connection."
  );
}

const PROXY_MISSING_MESSAGE =
  "The Vite dev proxy returned 404 — Elasticsearch calls cannot be forwarded. Use npm run dev or npm run preview (not npx serve, nginx, or opening dist/ as static files).";

function interpretElasticsearchResponse(res: Response, text: string): EsFetchFail | EsFetchOk<string> {
  let message = res.statusText || "Request failed";
  if (text) {
    try {
      const j = JSON.parse(text) as { error?: { reason?: string }; message?: string };
      message = j.error?.reason ?? j.message ?? message;
    } catch {
      if (text.length < 400) message = text;
    }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: text };
}

async function esFetchText(
  baseUrl: string,
  path: string,
  headers: Record<string, string>
): Promise<EsFetchFail | EsFetchOk<string>> {
  try {
    if (shouldUseElasticsearchProxy()) {
      const res = await fetch(getElasticDevProxyUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          baseUrl,
          path,
          method: "GET",
          headers,
        }),
      });
      const text = await res.text();
      if (res.status === 404) {
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!ct.includes("application/json")) {
          return { ok: false, status: 0, message: PROXY_MISSING_MESSAGE };
        }
      }
      return interpretElasticsearchResponse(res, text);
    }

    const res = await fetch(`${baseUrl}${path}`, { method: "GET", headers });
    const text = await res.text();
    return interpretElasticsearchResponse(res, text);
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message === "Failed to fetch"
        ? messageForBrowserFetchFailure(baseUrl)
        : e instanceof Error
          ? e.message
          : "Network error";
    return { ok: false, status: 0, message: msg };
  }
}

export type ProbeResult =
  | { kind: "anonymous_ok" }
  | { kind: "auth_required" }
  | { kind: "error"; message: string };

export async function probeElasticsearchAccess(baseUrl: string): Promise<ProbeResult> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const r = await esFetchText(baseUrl, "/_cluster/health", headers);
  if (r.ok) return { kind: "anonymous_ok" };
  if (r.status === 401 || r.status === 403) return { kind: "auth_required" };
  return { kind: "error", message: r.message };
}

export async function verifyElasticsearchConnection(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const r = await esFetchText(baseUrl, "/_cluster/health", headers);
  if (r.ok) return { ok: true };
  return { ok: false, message: r.message, status: r.status };
}

type CatIndexRow = Record<string, string>;

function parseCatJsonArray(text: string): CatIndexRow[] {
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) return [];
  return data as CatIndexRow[];
}

function bytesToGb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.round((bytes / 1024 ** 3) * 100) / 100;
}

export function catRowsToIndexConfigs(
  rows: CatIndexRow[],
  includeSystem: boolean
): IndexConfig[] {
  const out: IndexConfig[] = [];
  for (const row of rows) {
    const name = row.index ?? "";
    if (!name) continue;
    const status = (row.status ?? row.s ?? "open").toLowerCase();
    if (status === "close" || status === "closed") continue;
    if (!includeSystem && name.startsWith(".")) continue;

    const docs = parseInt(row["docs.count"] ?? "0", 10) || 0;
    const storeBytes = parseInt(row["store.size"] ?? "0", 10) || 0;
    const pri = parseInt(row.pri ?? "1", 10) || 1;
    const rep = parseInt(row.rep ?? "0", 10) || 0;

    out.push({
      id: generateIndexId(),
      name,
      documentCount: docs,
      totalSize: bytesToGb(storeBytes),
      primaryShardCount: Math.max(1, pri),
      replicaShardCount: Math.max(0, rep),
      writeRate: 0,
      readRate: 0,
    });
  }
  return out;
}

export async function fetchCatIndices(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; rows: CatIndexRow[] } | { ok: false; message: string; status: number }> {
  const path =
    "/_cat/indices?format=json&bytes=b&h=index,docs.count,store.size,pri,rep,status";
  const r = await esFetchText(baseUrl, path, headers);
  if (!r.ok) return { ok: false, message: r.message, status: r.status };
  try {
    return { ok: true, rows: parseCatJsonArray(r.data) };
  } catch {
    return { ok: false, message: "Could not parse index list.", status: 0 };
  }
}

function isDataNode(rolesRaw: string): boolean {
  if (!rolesRaw.trim()) return true;
  const abbreviations = new Set(["d", "data", "data_hot", "data_warm", "data_cold", "data_content", "data_frozen"]);
  const parts = rolesRaw.split(/[,\s]+/).map((x) => x.trim().toLowerCase());
  return parts.some((p) => abbreviations.has(p));
}

function isMasterEligibleNode(rolesRaw: string): boolean {
  if (!rolesRaw.trim()) return true;
  const parts = rolesRaw.split(/[,\s]+/).map((x) => x.trim().toLowerCase());
  return parts.some((p) => p === "m" || p === "master");
}

export async function fetchClusterHints(
  baseUrl: string,
  headers: Record<string, string>
): Promise<
  { ok: true; patch: Partial<ClusterConfig>; notes: string[] } | { ok: false; message: string }
> {
  const nodesR = await esFetchText(
    baseUrl,
    "/_cat/nodes?format=json&bytes=b&h=name,node.roles,ram.max,disk.total,heap.max",
    headers
  );

  const notes: string[] = [];
  const patch: Partial<ClusterConfig> = {};

  if (!nodesR.ok) {
    const statsR = await esFetchText(baseUrl, "/_cluster/stats", headers);
    if (!statsR.ok) return { ok: false, message: nodesR.message };
    try {
      const stats = JSON.parse(statsR.data) as { nodes?: { count?: Record<string, number> } };
      const count = stats.nodes?.count ?? {};
      if (count.data && count.data > 0) patch.dataNodeCount = count.data;
      if (count.master && count.master > 0) patch.masterNodeCount = count.master;
      notes.push("Used _cluster/stats for node counts; could not read _cat/nodes for RAM/disk.");
    } catch {
      return { ok: false, message: nodesR.message };
    }
    return { ok: true, patch, notes };
  }

  try {
    const rows = parseCatJsonArray(nodesR.data) as {
      name?: string;
      "node.roles"?: string;
      "ram.max"?: string;
      "disk.total"?: string;
      "heap.max"?: string;
    }[];

    let ramSum = 0;
    let ramN = 0;
    let diskSum = 0;
    let dataCount = 0;
    let masterCount = 0;

    for (const row of rows) {
      const rolesRaw = row["node.roles"] ?? "";
      const nodeIsData = isDataNode(rolesRaw);
      const nodeIsMaster = isMasterEligibleNode(rolesRaw);

      if (nodeIsData) dataCount += 1;
      if (nodeIsMaster) masterCount += 1;

      if (nodeIsData) {
        const ramB = parseInt(row["ram.max"] ?? "0", 10);
        const diskB = parseInt(row["disk.total"] ?? "0", 10);
        if (Number.isFinite(ramB) && ramB > 0) {
          ramSum += ramB;
          ramN += 1;
        }
        if (Number.isFinite(diskB) && diskB > 0) {
          diskSum += diskB;
        }
      }
    }

    if (dataCount > 0) patch.dataNodeCount = dataCount;
    if (masterCount > 0) patch.masterNodeCount = masterCount;

    if (ramN > 0) {
      patch.memoryPerNode = Math.max(1, Math.round(ramSum / ramN / 1024 ** 3));
    }
    if (diskSum > 0) {
      patch.totalDiskSize = Math.max(0, Math.round(diskSum / 1024 ** 3));
    }

    if (masterCount > 0) {
      notes.push(
        `Found ${masterCount} master-eligible node(s) and ${dataCount} data node(s). Adjust if you use dedicated masters only.`
      );
    }
    if (ramN === 0) {
      notes.push("Could not read RAM for data nodes; memory field left unchanged.");
    }
    if (diskSum === 0) {
      notes.push("Could not read disk total for data nodes; disk field left unchanged.");
    }
  } catch {
    notes.push("Could not parse node metrics.");
  }

  return { ok: true, patch, notes };
}

export async function fetchIndexMappings(
  baseUrl: string,
  indexName: string,
  headers: Record<string, string>
): Promise<{ ok: true; mappingJson: string } | { ok: false; message: string }> {
  const r = await esFetchText(baseUrl, `/${encodeURIComponent(indexName)}/_mapping`, headers);
  if (!r.ok) return { ok: false, message: r.message };
  try {
    const raw = JSON.parse(r.data) as Record<string, { mappings?: unknown }>;
    const indexData = raw[indexName] ?? Object.values(raw)[0];
    const mappings = indexData?.mappings ?? {};
    return { ok: true, mappingJson: JSON.stringify(mappings, null, 2) };
  } catch {
    return { ok: false, message: "Could not parse mapping response." };
  }
}

export async function fetchIndexDocCount(
  baseUrl: string,
  indexName: string,
  headers: Record<string, string>
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const r = await esFetchText(
    baseUrl,
    `/_cat/indices/${encodeURIComponent(indexName)}?format=json&h=docs.count`,
    headers
  );
  if (!r.ok) return { ok: false, message: r.message };
  try {
    const rows = parseCatJsonArray(r.data) as { "docs.count"?: string }[];
    const count = parseInt(rows[0]?.["docs.count"] ?? "0", 10) || 0;
    return { ok: true, count };
  } catch {
    return { ok: false, message: "Could not parse doc count." };
  }
}

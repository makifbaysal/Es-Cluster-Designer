import { getElasticDevProxyUrl } from "../elasticDevProxy";
import type { ClusterConfig, ClusterLimitsHint, IndexConfig } from "../types";
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
    const storeBytes = parseInt(row["pri.store.size"] ?? row["store.size"] ?? "0", 10) || 0;
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

export async function fetchAllMappings(
  baseUrl: string,
  headers: Record<string, string>,
  includeSystem: boolean
): Promise<{ ok: true; mappingsByIndex: Record<string, string> } | { ok: false; message: string }> {
  const path = includeSystem ? "/_mapping" : "/*/_mapping?expand_wildcards=open";
  const r = await esFetchText(baseUrl, path, headers);
  if (!r.ok) return { ok: false, message: r.message };
  try {
    const raw = JSON.parse(r.data) as Record<string, { mappings?: unknown }>;
    const result: Record<string, string> = {};
    for (const [indexName, indexData] of Object.entries(raw)) {
      if (!includeSystem && indexName.startsWith(".")) continue;
      const mappings = indexData.mappings ?? {};
      result[indexName] = JSON.stringify(mappings, null, 2);
    }
    return { ok: true, mappingsByIndex: result };
  } catch {
    return { ok: false, message: "Could not parse mappings response." };
  }
}

export async function fetchCatIndices(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; rows: CatIndexRow[] } | { ok: false; message: string; status: number }> {
  const path =
    "/_cat/indices?format=json&bytes=b&h=index,docs.count,pri.store.size,pri,rep,status";
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

    let dataRamSum = 0;
    let dataRamN = 0;
    let diskSum = 0;
    let dataCount = 0;
    let masterCount = 0;
    let dedicatedMasterRamSum = 0;
    let dedicatedMasterRamN = 0;

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
          dataRamSum += ramB;
          dataRamN += 1;
        }
        if (Number.isFinite(diskB) && diskB > 0) {
          diskSum += diskB;
        }
      } else if (nodeIsMaster) {
        const ramB = parseInt(row["ram.max"] ?? "0", 10);
        if (Number.isFinite(ramB) && ramB > 0) {
          dedicatedMasterRamSum += ramB;
          dedicatedMasterRamN += 1;
        }
      }
    }

    if (dataCount > 0) patch.dataNodeCount = dataCount;
    if (masterCount > 0) patch.masterNodeCount = masterCount;

    if (dataRamN > 0) {
      patch.memoryPerNode = Math.max(1, Math.round(dataRamSum / dataRamN / 1024 ** 3));
    }
    if (diskSum > 0) {
      patch.totalDiskSize = Math.max(0, Math.round(diskSum / 1024 ** 3));
    }
    if (dedicatedMasterRamN > 0) {
      patch.memoryPerMasterNode = Math.max(1, Math.round(dedicatedMasterRamSum / dedicatedMasterRamN / 1024 ** 3));
    }

    if (masterCount > 0) {
      notes.push(
        `Found ${masterCount} master-eligible node(s) and ${dataCount} data node(s). Adjust if you use dedicated masters only.`
      );
    }
    if (dataRamN === 0) {
      notes.push("Could not read RAM for data nodes; memory field left unchanged.");
    }
    if (diskSum === 0) {
      notes.push("Could not read disk total for data nodes; disk field left unchanged.");
    }
  } catch {
    notes.push("Could not parse node metrics.");
  }

  const cpuInfoR = await esFetchText(
    baseUrl,
    "/_nodes?filter_path=nodes.*.name,nodes.*.roles,nodes.*.os.available_processors",
    headers
  );
  if (cpuInfoR.ok) {
    try {
      const cpuInfo = JSON.parse(cpuInfoR.data) as {
        nodes?: Record<string, {
          roles?: string[];
          os?: { available_processors?: number };
        }>;
      };
      let dataCpuSum = 0;
      let dataCpuN = 0;
      let masterCpuSum = 0;
      let masterCpuN = 0;
      for (const node of Object.values(cpuInfo.nodes ?? {})) {
        const roles = node.roles ?? [];
        const rolesStr = roles.join(",");
        const nodeIsData = isDataNode(rolesStr);
        const nodeIsMaster = isMasterEligibleNode(rolesStr);
        const cpus = node.os?.available_processors;
        if (typeof cpus === "number" && cpus > 0) {
          if (nodeIsData) { dataCpuSum += cpus; dataCpuN += 1; }
          else if (nodeIsMaster) { masterCpuSum += cpus; masterCpuN += 1; }
        }
      }
      if (dataCpuN > 0) patch.cpuPerNode = Math.max(1, Math.round(dataCpuSum / dataCpuN));
      if (masterCpuN > 0) patch.cpuPerMasterNode = Math.max(1, Math.round(masterCpuSum / masterCpuN));
    } catch {
      notes.push("Could not parse CPU info from /_nodes; CPU fields left unchanged.");
    }
  } else {
    notes.push("Could not read CPU info from /_nodes; CPU fields left unchanged.");
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

export async function fetchClusterSettingsFlat(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; raw: string } | { ok: false; message: string }> {
  const r = await esFetchText(
    baseUrl,
    "/_cluster/settings?flat_settings=true&include_defaults=false",
    headers
  );
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, raw: r.data };
}

export function parseClusterLimitsFromSettingsJson(text: string): ClusterLimitsHint {
  try {
    const o = JSON.parse(text) as {
      persistent?: Record<string, unknown>;
      transient?: Record<string, unknown>;
    };
    const flat: Record<string, unknown> = {
      ...(o.transient ?? {}),
      ...(o.persistent ?? {}),
    };
    let maxShardsPerNode: number | undefined;
    const ms = flat["cluster.max_shards_per_node"];
    if (ms !== undefined) {
      const n = parseInt(String(ms), 10);
      if (Number.isFinite(n) && n > 0) maxShardsPerNode = n;
    }
    let floodStageDiskPercent: number | undefined;
    const fk =
      flat["cluster.routing.allocation.disk.watermark.flood_stage"] ??
      flat["cluster.routing.allocation.disk.watermark.flood-stage"];
    if (fk !== undefined) {
      const m = String(fk).match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) floodStageDiskPercent = parseFloat(m[1]);
    }
    return { maxShardsPerNode, floodStageDiskPercent };
  } catch {
    return {};
  }
}

export type CatAllocationRow = Record<string, string>;

export async function fetchCatAllocation(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; rows: CatAllocationRow[] } | { ok: false; message: string }> {
  const r = await esFetchText(
    baseUrl,
    "/_cat/allocation?format=json&bytes=b&h=node,shards,disk.indices,disk.used,disk.avail,disk.total",
    headers
  );
  if (!r.ok) return { ok: false, message: r.message };
  try {
    return { ok: true, rows: parseCatJsonArray(r.data) as CatAllocationRow[] };
  } catch {
    return { ok: false, message: "Could not parse allocation." };
  }
}

export type CatShardRow = Record<string, string>;

export async function fetchCatShards(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; rows: CatShardRow[] } | { ok: false; message: string }> {
  const r = await esFetchText(
    baseUrl,
    "/_cat/shards?format=json&bytes=b&h=index,shard,prirep,state,docs,store,node",
    headers
  );
  if (!r.ok) return { ok: false, message: r.message };
  try {
    return { ok: true, rows: parseCatJsonArray(r.data) as CatShardRow[] };
  } catch {
    return { ok: false, message: "Could not parse shards." };
  }
}

export function aggregateShardStoreByNode(rows: CatShardRow[]): { node: string; storeBytes: number; shardCount: number }[] {
  const map = new Map<string, { storeBytes: number; shardCount: number }>();
  for (const row of rows) {
    const node = (row.node ?? "").trim();
    if (!node || node === "UNASSIGNED") continue;
    const st = parseInt(row.store ?? "0", 10) || 0;
    const cur = map.get(node) ?? { storeBytes: 0, shardCount: 0 };
    cur.storeBytes += st;
    cur.shardCount += 1;
    map.set(node, cur);
  }
  return [...map.entries()]
    .map(([node, v]) => ({ node, ...v }))
    .sort((a, b) => a.node.localeCompare(b.node));
}

export async function fetchIlmPoliciesJson(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; raw: string } | { ok: false; message: string }> {
  const r = await esFetchText(baseUrl, "/_ilm/policy", headers);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, raw: r.data };
}

function parseElasticDurationToDays(s: string): number {
  const t = s.trim();
  const m = t.match(/^(\d+(?:\.\d+)?)(d|h|ms|s|m|micros)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? "d").toLowerCase();
  if (u === "d") return n;
  if (u === "h") return n / 24;
  if (u === "m" && t.endsWith("m") && !t.endsWith("ms")) return n / (24 * 60);
  if (u === "s") return n / 86400;
  if (u === "ms") return n / 86400000;
  if (u === "micros") return n / 86400000000000;
  return n;
}

export function listIlmPolicyNamesFromRaw(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(o);
  } catch {
    return [];
  }
}

export function suggestedRetentionDaysFromIlmPolicy(policyBody: unknown): number | null {
  if (!policyBody || typeof policyBody !== "object") return null;
  const phases = (policyBody as { policy?: { phases?: Record<string, unknown> } }).policy?.phases;
  if (!phases || typeof phases !== "object") return null;
  let sum = 0;
  for (const ph of Object.values(phases)) {
    if (!ph || typeof ph !== "object") continue;
    const minAge = (ph as { min_age?: string }).min_age;
    if (typeof minAge === "string") sum += parseElasticDurationToDays(minAge);
  }
  return sum > 0 ? Math.ceil(sum) : null;
}

export async function fetchIndexTemplatesJson(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; raw: string } | { ok: false; message: string }> {
  const r = await esFetchText(baseUrl, "/_index_template", headers);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, raw: r.data };
}

export async function fetchComponentTemplatesJson(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; raw: string } | { ok: false; message: string }> {
  const r = await esFetchText(baseUrl, "/_component_template", headers);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, raw: r.data };
}

export function extractMappingsJsonFromIndexTemplateResponse(
  raw: string,
  templateName: string
): { ok: true; mappingJson: string } | { ok: false; message: string } {
  try {
    const data = JSON.parse(raw) as {
      index_templates?: { name: string; index_template?: { template?: { mappings?: unknown } } }[];
    };
    const list = data.index_templates ?? [];
    const hit = list.find((x) => x.name === templateName);
    const mappings = hit?.index_template?.template?.mappings;
    if (!mappings) return { ok: false, message: "Template or mappings not found." };
    return { ok: true, mappingJson: JSON.stringify(mappings, null, 2) };
  } catch {
    return { ok: false, message: "Could not parse index templates." };
  }
}

export function listIndexTemplateNames(raw: string): string[] {
  try {
    const data = JSON.parse(raw) as { index_templates?: { name: string }[] };
    return (data.index_templates ?? []).map((x) => x.name).filter(Boolean);
  } catch {
    return [];
  }
}

export function extractMappingsFromComponentTemplateResponse(
  raw: string,
  name: string
): { ok: true; mappingJson: string } | { ok: false; message: string } {
  try {
    const data = JSON.parse(raw) as {
      component_templates?: { name: string; component_template?: { template?: { mappings?: unknown } } }[];
    };
    const list = data.component_templates ?? [];
    const hit = list.find((x) => x.name === name);
    const mappings = hit?.component_template?.template?.mappings;
    if (!mappings) return { ok: false, message: "Component or mappings not found." };
    return { ok: true, mappingJson: JSON.stringify(mappings, null, 2) };
  } catch {
    return { ok: false, message: "Could not parse component templates." };
  }
}

export function listComponentTemplateNames(raw: string): string[] {
  try {
    const data = JSON.parse(raw) as { component_templates?: { name: string }[] };
    return (data.component_templates ?? []).map((x) => x.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchSnapshotRepositoriesJson(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ ok: true; raw: string } | { ok: false; message: string }> {
  const r = await esFetchText(baseUrl, "/_snapshot", headers);
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, raw: r.data };
}

export function listSnapshotRepositoryNames(raw: string): string[] {
  try {
    const o = JSON.parse(raw) as { repositories?: Record<string, unknown> };
    if (o.repositories && typeof o.repositories === "object") {
      return Object.keys(o.repositories);
    }
    return Object.keys(o as Record<string, unknown>).filter((k) => k !== "repositories");
  } catch {
    return [];
  }
}

export async function fetchCatSnapshotsForRepo(
  baseUrl: string,
  repo: string,
  headers: Record<string, string>
): Promise<{ ok: true; rows: CatIndexRow[] } | { ok: false; message: string }> {
  const r = await esFetchText(
    baseUrl,
    `/_cat/snapshots/${encodeURIComponent(repo)}?format=json&h=id,status,start_epoch,end_epoch,total,failed`,
    headers
  );
  if (!r.ok) return { ok: false, message: r.message };
  try {
    return { ok: true, rows: parseCatJsonArray(r.data) as CatIndexRow[] };
  } catch {
    return { ok: false, message: "Could not parse snapshots." };
  }
}

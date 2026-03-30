import type { ClusterConfig, IndexConfig, PersistedState } from "../types";
import { csvRowLine } from "./csvExporter";
import { generateIndexId } from "./storage";

export const STATE_CSV_MAGIC = "elastic-calculator-state-v1";

const CLUSTER_HEADER = [
  "masterNodeCount",
  "dataNodeCount",
  "memoryPerNode",
  "cpuPerNode",
  "totalDiskSize",
] as const;

const INDEX_HEADER = [
  "name",
  "documentCount",
  "totalSize",
  "primaryShardCount",
  "replicaShardCount",
  "writeRate",
  "readRate",
] as const;

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function normalizeHeader(cells: string[]): string[] {
  return cells.map((c) => c.trim().toLowerCase());
}

function headersMatch(
  actual: string[],
  expected: readonly string[]
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const a = normalizeHeader(actual);
  const e = expected.map((x) => x.toLowerCase());
  return a.every((v, i) => v === e[i]);
}

function parseNum(s: string, fallback: number): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function parseIntSafe(s: string, fallback: number, min?: number): number {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  if (min !== undefined && n < min) {
    return min;
  }
  return n;
}

export function buildStateCsv(cluster: ClusterConfig, indices: IndexConfig[]): string {
  const lines: string[] = [];
  lines.push(STATE_CSV_MAGIC);
  lines.push(csvRowLine([...CLUSTER_HEADER]));
  lines.push(
    csvRowLine([
      cluster.masterNodeCount,
      cluster.dataNodeCount,
      cluster.memoryPerNode,
      cluster.cpuPerNode,
      cluster.totalDiskSize,
    ])
  );
  lines.push("");
  lines.push(csvRowLine([...INDEX_HEADER]));
  for (const idx of indices) {
    lines.push(
      csvRowLine([
        idx.name,
        idx.documentCount,
        idx.totalSize,
        idx.primaryShardCount,
        idx.replicaShardCount,
        idx.writeRate,
        idx.readRate,
      ])
    );
  }
  return lines.join("\n");
}

export type ParseStateCsvResult =
  | { ok: true; state: PersistedState }
  | { ok: false; message: string };

export function parseStateCsv(text: string): ParseStateCsvResult {
  const raw = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const line of raw) {
    const t = line.trim();
    if (t.length === 0) {
      continue;
    }
    if (t.startsWith("---")) {
      break;
    }
    lines.push(line.trimEnd());
  }

  if (lines.length < 3) {
    return {
      ok: false,
      message:
        "CSV is too short. Expected header elastic-calculator-state-v1 and cluster and index rows.",
    };
  }

  if (lines[0] !== STATE_CSV_MAGIC) {
    return {
      ok: false,
      message: `First line must be "${STATE_CSV_MAGIC}" (export state from this app).`,
    };
  }

  const clusterHeader = parseCsvLine(lines[1]);
  if (!headersMatch(clusterHeader, CLUSTER_HEADER)) {
    return {
      ok: false,
      message: `Invalid cluster header. Expected: ${CLUSTER_HEADER.join(",")}`,
    };
  }

  const clusterCells = parseCsvLine(lines[2]);
  if (clusterCells.length < CLUSTER_HEADER.length) {
    return { ok: false, message: "Cluster row has too few columns." };
  }

  const cluster: ClusterConfig = {
    masterNodeCount: Math.max(0, parseIntSafe(clusterCells[0], 0, 0)),
    dataNodeCount: Math.max(0, parseIntSafe(clusterCells[1], 0, 0)),
    memoryPerNode: Math.max(0, parseNum(clusterCells[2], 0)),
    cpuPerNode: Math.max(0, parseNum(clusterCells[3], 0)),
    totalDiskSize: Math.max(0, parseNum(clusterCells[4], 0)),
  };

  if (lines.length < 4) {
    return {
      ok: true,
      state: { cluster, indices: [] },
    };
  }

  const indexHeader = parseCsvLine(lines[3]);
  if (!headersMatch(indexHeader, INDEX_HEADER)) {
    return {
      ok: false,
      message: `Invalid index header. Expected: ${INDEX_HEADER.join(",")}`,
    };
  }

  const indices: IndexConfig[] = [];
  for (let r = 4; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    if (cells.length === 0 || cells.every((c) => c === "")) {
      continue;
    }
    if (cells.length < INDEX_HEADER.length) {
      return {
        ok: false,
        message: `Index row ${r - 3} has too few columns.`,
      };
    }
    indices.push({
      id: generateIndexId(),
      name: cells[0] || "index",
      documentCount: Math.max(0, parseNum(cells[1], 0)),
      totalSize: Math.max(0, parseNum(cells[2], 0)),
      primaryShardCount: Math.max(1, parseIntSafe(cells[3], 1, 1)),
      replicaShardCount: Math.max(0, parseIntSafe(cells[4], 0, 0)),
      writeRate: Math.max(0, parseNum(cells[5], 0)),
      readRate: Math.max(0, parseNum(cells[6], 0)),
    });
  }

  return { ok: true, state: { cluster, indices } };
}

export function appendNodeExportSection(nodeCsvBody: string): string {
  return `\n\n---node-export---\n${nodeCsvBody}`;
}

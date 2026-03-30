import type { ClusterConfig, IndexConfig, PersistedState, Snapshot } from "../types";
import { SNAPSHOTS_KEY, STORAGE_KEY } from "../types";

const defaultCluster: ClusterConfig = {
  masterNodeCount: 3,
  dataNodeCount: 3,
  memoryPerNode: 32,
  cpuPerNode: 8,
  totalDiskSize: 3000,
};

export function generateIndexId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newId(): string {
  return generateIndexId();
}

function defaultIndices(): IndexConfig[] {
  return [
    {
      id: newId(),
      name: "logs-0001",
      documentCount: 50_000_000,
      totalSize: 120,
      primaryShardCount: 5,
      replicaShardCount: 1,
      writeRate: 5000,
      readRate: 200,
    },
  ];
}

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { cluster: defaultCluster, indices: defaultIndices() };
    }
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.cluster || !Array.isArray(parsed.indices)) {
      return { cluster: defaultCluster, indices: defaultIndices() };
    }
    return parsed;
  } catch {
    return { cluster: defaultCluster, indices: defaultIndices() };
  }
}

export function savePersistedState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function createEmptyIndex(): IndexConfig {
  return {
    id: newId(),
    name: "new-index",
    documentCount: 0,
    totalSize: 0,
    primaryShardCount: 1,
    replicaShardCount: 0,
    writeRate: 0,
    readRate: 0,
  };
}

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshots(snapshots: Snapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch {
    return;
  }
}

export function addSnapshot(
  snapshots: Snapshot[],
  label: string,
  cluster: ClusterConfig,
  indices: IndexConfig[]
): Snapshot[] {
  const snap: Snapshot = {
    id: generateIndexId(),
    label,
    savedAt: Date.now(),
    cluster: { ...cluster },
    indices: indices.map((i) => ({ ...i })),
  };
  const updated = [snap, ...snapshots].slice(0, 10);
  saveSnapshots(updated);
  return updated;
}

export function deleteSnapshot(snapshots: Snapshot[], id: string): Snapshot[] {
  const updated = snapshots.filter((s) => s.id !== id);
  saveSnapshots(updated);
  return updated;
}

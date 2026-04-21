import type { ClusterConfig, IndexConfig, Snapshot } from "../types";

export const COMPARE_WORKSPACE = "__workspace__";
export const COMPARE_NONE = "__none__";

export type ResolvedCompareSource = {
  id: string;
  title: string;
  subtitle: string;
  cluster: ClusterConfig;
  indices: IndexConfig[];
};

export function resolveCompareSource(
  key: string,
  workspaceCluster: ClusterConfig,
  workspaceIndices: IndexConfig[],
  snapshots: Snapshot[]
): ResolvedCompareSource | null {
  if (!key || key === COMPARE_NONE) return null;
  if (key === COMPARE_WORKSPACE) {
    return {
      id: COMPARE_WORKSPACE,
      title: "",
      subtitle: "",
      cluster: workspaceCluster,
      indices: workspaceIndices,
    };
  }
  const s = snapshots.find((x) => x.id === key);
  if (!s) return null;
  return {
    id: s.id,
    title: s.label,
    subtitle: new Date(s.savedAt).toLocaleString(),
    cluster: s.cluster,
    indices: s.indices,
  };
}

export function resolveCompareColumns(
  colA: string,
  colB: string,
  colC: string,
  workspaceCluster: ClusterConfig,
  workspaceIndices: IndexConfig[],
  snapshots: Snapshot[]
): ResolvedCompareSource[] {
  return [
    resolveCompareSource(colA, workspaceCluster, workspaceIndices, snapshots),
    resolveCompareSource(colB, workspaceCluster, workspaceIndices, snapshots),
    resolveCompareSource(colC, workspaceCluster, workspaceIndices, snapshots),
  ].filter((x): x is ResolvedCompareSource => x !== null);
}

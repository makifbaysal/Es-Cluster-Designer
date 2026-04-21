import type { ClusterConfig, IndexConfig, Snapshot } from "../types";

export function planningFieldsFromCluster(c: ClusterConfig): Partial<ClusterConfig> {
  return {
    workloadProfile: c.workloadProfile,
    growthGbPerDay: c.growthGbPerDay,
    growthProjectionDays: c.growthProjectionDays,
    costUsdPerGbRamMonth: c.costUsdPerGbRamMonth,
    costUsdPerGbDiskMonth: c.costUsdPerGbDiskMonth,
    costUsdPerDataNodeMonth: c.costUsdPerDataNodeMonth,
  };
}

export function mergeTopologyWithCostPlanning(
  topologyCluster: ClusterConfig,
  planning: Partial<ClusterConfig>
): ClusterConfig {
  return {
    ...topologyCluster,
    workloadProfile: planning.workloadProfile ?? topologyCluster.workloadProfile,
    growthGbPerDay: planning.growthGbPerDay ?? topologyCluster.growthGbPerDay ?? 0,
    growthProjectionDays:
      planning.growthProjectionDays ?? topologyCluster.growthProjectionDays ?? 0,
    costUsdPerGbRamMonth:
      planning.costUsdPerGbRamMonth ?? topologyCluster.costUsdPerGbRamMonth ?? 0,
    costUsdPerGbDiskMonth:
      planning.costUsdPerGbDiskMonth ?? topologyCluster.costUsdPerGbDiskMonth ?? 0,
    costUsdPerDataNodeMonth:
      planning.costUsdPerDataNodeMonth ?? topologyCluster.costUsdPerDataNodeMonth ?? 0,
  };
}

export function indicesForCostCalculation(
  workspaceIndices: IndexConfig[],
  snapshot: Snapshot | null
): IndexConfig[] {
  return snapshot ? snapshot.indices : workspaceIndices;
}

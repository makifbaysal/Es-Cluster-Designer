import type { ClusterConfig } from "../types";

export function monthlyCostUsdComponents(cluster: ClusterConfig): {
  ramUsd: number;
  diskUsd: number;
  nodeUsd: number;
  totalUsd: number;
} {
  const warmDisk = (cluster.warmNodeCount ?? 0) * (cluster.warmDiskPerNodeGb ?? 0);
  const coldDisk = (cluster.coldNodeCount ?? 0) * (cluster.coldDiskPerNodeGb ?? 0);
  const totalRamGb =
    (cluster.masterNodeCount + cluster.dataNodeCount) * cluster.memoryPerNode;
  const totalDiskGb = cluster.totalDiskSize + warmDisk + coldDisk;
  const ramRate = cluster.costUsdPerGbRamMonth ?? 0;
  const diskRate = cluster.costUsdPerGbDiskMonth ?? 0;
  const nodeRate = cluster.costUsdPerDataNodeMonth ?? 0;
  const ramUsd = totalRamGb * ramRate;
  const diskUsd = totalDiskGb * diskRate;
  const nodeUsd = cluster.dataNodeCount * nodeRate;
  return {
    ramUsd,
    diskUsd,
    nodeUsd,
    totalUsd: ramUsd + diskUsd + nodeUsd,
  };
}

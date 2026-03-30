import type {
  CalculationResult,
  ClusterConfig,
  IndexConfig,
  RecommendationItem,
  ScalingAssessment,
  WarningItem,
} from "../types";
import { heapPerNodeGb, maxShardsForHeap } from "./heap";

const TARGET_SHARD_MIN = 20;
const TARGET_SHARD_MAX = 40;
const DISK_LOW = 30;
const OVERHEAD = 1.15;

let recSeq = 0;
function nextRecId(): string {
  recSeq += 1;
  return `rec-${recSeq}`;
}

export function buildRecommendations(
  cluster: ClusterConfig,
  _indices: IndexConfig[],
  result: Omit<
    CalculationResult,
    "warnings" | "recommendations" | "scalingAssessment"
  >,
  warnings: WarningItem[]
): { recommendations: RecommendationItem[]; scalingAssessment: ScalingAssessment } {
  const recommendations: RecommendationItem[] = [];
  const heapGb = heapPerNodeGb(cluster.memoryPerNode);
  const maxShardsNode = maxShardsForHeap(heapGb);

  const hasCritical = warnings.some((w) => w.level === "critical");
  const highDisk =
    result.diskUsagePercent >= 85 || result.estimatedDiskUsagePercent >= 85;
  const heavyShards = result.shardsPerNode > maxShardsNode * 0.9;

  if (hasCritical || highDisk || heavyShards) {
    recommendations.push({
      id: nextRecId(),
      kind: "underscale",
      title: "Capacity risk",
      description:
        "Increase data nodes, disk, or reduce shard count / data volume before production load.",
    });
  }

  const underUtilized =
    result.diskUsagePercent < DISK_LOW &&
    result.estimatedDiskUsagePercent < DISK_LOW &&
    cluster.dataNodeCount > 2 &&
    result.shardsPerNode < maxShardsNode * 0.2;

  if (underUtilized && !hasCritical) {
    recommendations.push({
      id: nextRecId(),
      kind: "overscale",
      title: "Possible over-provisioning",
      description:
        "Disk and shard pressure are low relative to node count. Consider fewer or smaller data nodes for cost savings.",
    });
  }

  for (const ib of result.indexBreakdowns) {
    if (ib.primaryShards <= 0 || ib.dataWithReplicasGb <= 0) continue;
    const idealPrimary = Math.max(
      1,
      Math.ceil(ib.dataWithReplicasGb / TARGET_SHARD_MAX)
    );
    const alt = Math.ceil(ib.dataWithReplicasGb / TARGET_SHARD_MIN);
    if (ib.shardSizeGb < TARGET_SHARD_MIN || ib.shardSizeGb > TARGET_SHARD_MAX) {
      recommendations.push({
        id: nextRecId(),
        kind: "shard",
        title: `Shard count hint for "${ib.indexName}"`,
        description: `For ~${TARGET_SHARD_MIN}-${TARGET_SHARD_MAX} GB shards, try primary shards around ${idealPrimary}-${alt} (current ${ib.primaryShards}).`,
      });
    }
  }

  const dataWithOverhead = result.totalDataWithReplicasGb * OVERHEAD;
  const perNodeDisk =
    cluster.dataNodeCount > 0
      ? cluster.totalDiskSize / cluster.dataNodeCount
      : 0;
  if (perNodeDisk > 0 && dataWithOverhead > 0) {
    const neededNodesStorage = Math.ceil(
      dataWithOverhead / (perNodeDisk * 0.75)
    );
    if (neededNodesStorage > cluster.dataNodeCount) {
      recommendations.push({
        id: nextRecId(),
        kind: "node",
        title: "Minimum data nodes (storage)",
        description: `Roughly ${neededNodesStorage} data nodes may be needed to keep disk under ~75% of provisioned capacity.`,
      });
    }
  }

  const shardLimitedNodes = Math.ceil(
    result.totalShards / Math.max(1, maxShardsNode * 0.8)
  );
  if (shardLimitedNodes > cluster.dataNodeCount && cluster.dataNodeCount > 0) {
    recommendations.push({
      id: nextRecId(),
      kind: "node",
      title: "Minimum data nodes (shards)",
      description: `At least ${shardLimitedNodes} data nodes suggested to keep shards per node within heap guidance.`,
    });
  }

  const { cacheRatio, osPageCacheGb, hotDataPerNodeGb } = result.heapBreakdown;
  if (
    Number.isFinite(cacheRatio) &&
    hotDataPerNodeGb > 0 &&
    cacheRatio < 0.5 &&
    cluster.dataNodeCount > 0
  ) {
    const ramNeededPerNode = hotDataPerNodeGb;
    const minMemory = Math.ceil((ramNeededPerNode + result.heapPerNodeGb) * 1.1);
    recommendations.push({
      id: nextRecId(),
      kind: "node",
      title: "Insufficient RAM for OS page cache",
      description: `Page cache covers ${(cacheRatio * 100).toFixed(0)}% of hot data (${osPageCacheGb.toFixed(1)} GB cache vs ${hotDataPerNodeGb.toFixed(1)} GB data/node). Consider ~${minMemory} GB RAM per node or add more data nodes.`,
    });
  }

  let scalingAssessment: ScalingAssessment = "optimal";
  if (recommendations.some((r) => r.kind === "underscale")) {
    scalingAssessment = "underscale";
  } else if (recommendations.some((r) => r.kind === "overscale")) {
    scalingAssessment = "overscale";
  }

  return { recommendations, scalingAssessment };
}

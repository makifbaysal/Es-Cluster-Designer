import type {
  CalculationResult,
  ClusterConfig,
  HeapBreakdown,
  IlmBreakdown,
  IndexBreakdown,
  IndexConfig,
  NodeBreakdown,
  TierBreakdown,
} from "../types";
import { buildRecommendations } from "./recommender";
import { collectWarnings } from "./limitChecker";
import { heapPerNodeGb, maxShardsForHeap } from "./heap";

export { heapPerNodeGb, maxShardsForHeap } from "./heap";

const BASE_OVERHEAD_FACTOR = 1.15;
const WRITE_DOMINANT_OVERHEAD_FACTOR = 1.30;

const FIELD_DATA_CACHE_RATIO = 0.15;
const QUERY_BUFFER_RATIO = 0.10;
const INDEXING_BUFFER_RATIO = 0.10;

function indexTotalShards(idx: IndexConfig): number {
  return idx.primaryShardCount * (1 + idx.replicaShardCount);
}

function indexDataWithReplicasGb(idx: IndexConfig): number {
  return idx.totalSize * (1 + idx.replicaShardCount);
}

export function buildIndexBreakdown(idx: IndexConfig): IndexBreakdown {
  const primary = idx.primaryShardCount;
  const totalShards = indexTotalShards(idx);
  const shardSizeGb = primary > 0 ? idx.totalSize / primary : 0;
  const docsPerShard = primary > 0 ? idx.documentCount / primary : 0;
  return {
    indexId: idx.id,
    indexName: idx.name,
    primaryShards: primary,
    totalShards,
    shardSizeGb,
    docsPerShard,
    dataWithReplicasGb: indexDataWithReplicasGb(idx),
  };
}

function buildHeapBreakdown(
  memoryPerNodeGb: number,
  heapGb: number,
  hotDataPerNodeGb: number
): HeapBreakdown {
  const fieldDataCacheGb = heapGb * FIELD_DATA_CACHE_RATIO;
  const queryBufferGb = heapGb * QUERY_BUFFER_RATIO;
  const indexingBufferGb = heapGb * INDEXING_BUFFER_RATIO;
  const availableGb = Math.max(
    0,
    heapGb - fieldDataCacheGb - queryBufferGb - indexingBufferGb
  );
  const osPageCacheGb = Math.max(0, memoryPerNodeGb - heapGb);
  const cacheRatio =
    hotDataPerNodeGb > 0 ? osPageCacheGb / hotDataPerNodeGb : Infinity;
  return {
    totalRamGb: memoryPerNodeGb,
    totalHeapGb: heapGb,
    fieldDataCacheGb,
    queryBufferGb,
    indexingBufferGb,
    availableGb,
    osPageCacheGb,
    hotDataPerNodeGb,
    cacheRatio,
  };
}

function indexHotDataGb(idx: IndexConfig): number {
  const total = indexDataWithReplicasGb(idx);
  const retention = idx.retentionDays ?? 0;
  const hot = idx.hotDays ?? 0;
  if (retention <= 0 || hot <= 0) return total;
  return total * Math.min(1, hot / retention);
}

function indexWarmDataGb(idx: IndexConfig): number {
  const total = indexDataWithReplicasGb(idx);
  const retention = idx.retentionDays ?? 0;
  const warm = idx.warmDays ?? 0;
  if (retention <= 0 || warm <= 0) return 0;
  return total * Math.min(1, warm / retention);
}

function indexColdDataGb(idx: IndexConfig): number {
  const total = indexDataWithReplicasGb(idx);
  const retention = idx.retentionDays ?? 0;
  const hot = idx.hotDays ?? 0;
  const warm = idx.warmDays ?? 0;
  if (retention <= 0) return 0;
  const coldDays = Math.max(0, retention - hot - warm);
  if (coldDays <= 0) return 0;
  return total * (coldDays / retention);
}

function buildIlmBreakdown(
  cluster: ClusterConfig,
  indices: IndexConfig[],
  overheadFactor: number
): IlmBreakdown {
  const warmNodeCount = cluster.warmNodeCount ?? 0;
  const coldNodeCount = cluster.coldNodeCount ?? 0;
  const hotNodeCount = Math.max(0, cluster.dataNodeCount);
  const ilmEnabled =
    indices.some((i) => (i.retentionDays ?? 0) > 0) &&
    (warmNodeCount > 0 || coldNodeCount > 0);

  let hotDataGb = 0;
  let warmDataGb = 0;
  let coldDataGb = 0;

  for (const idx of indices) {
    if (ilmEnabled) {
      hotDataGb += indexHotDataGb(idx);
      warmDataGb += indexWarmDataGb(idx);
      coldDataGb += indexColdDataGb(idx);
    } else {
      hotDataGb += indexDataWithReplicasGb(idx);
    }
  }

  hotDataGb *= overheadFactor;
  warmDataGb *= overheadFactor;
  coldDataGb *= overheadFactor;

  const hotTotalDisk = cluster.totalDiskSize;
  const warmTotalDisk =
    warmNodeCount > 0
      ? warmNodeCount * (cluster.warmDiskPerNodeGb ?? 0)
      : 0;
  const coldTotalDisk =
    coldNodeCount > 0
      ? coldNodeCount * (cluster.coldDiskPerNodeGb ?? 0)
      : 0;

  const makeTier = (
    nodeCount: number,
    totalDiskGb: number,
    usedDataGb: number
  ): TierBreakdown => ({
    nodeCount,
    totalDiskGb,
    usedDataGb,
    diskUsagePercent:
      totalDiskGb > 0 ? Math.min(100, (usedDataGb / totalDiskGb) * 100) : 0,
  });

  return {
    enabled: ilmEnabled,
    hot: makeTier(hotNodeCount, hotTotalDisk, hotDataGb),
    warm: makeTier(warmNodeCount, warmTotalDisk, warmDataGb),
    cold: makeTier(coldNodeCount, coldTotalDisk, coldDataGb),
  };
}

export function calculateCluster(
  cluster: ClusterConfig,
  indices: IndexConfig[]
): CalculationResult {
  const dataNodeCount = Math.max(0, cluster.dataNodeCount);
  const masterNodeCount = Math.max(0, cluster.masterNodeCount);
  const heapGb = heapPerNodeGb(cluster.memoryPerNode);
  const maxShardsPerNode = maxShardsForHeap(heapGb);
  const diskOverheadFactor = cluster.writeDominant
    ? WRITE_DOMINANT_OVERHEAD_FACTOR
    : BASE_OVERHEAD_FACTOR;

  const indexBreakdowns = indices.map(buildIndexBreakdown);

  let totalHotDataGb = 0;
  for (const idx of indices) {
    totalHotDataGb += indexHotDataGb(idx);
  }
  totalHotDataGb *= diskOverheadFactor;
  const hotDataPerNodeGb =
    dataNodeCount > 0 ? totalHotDataGb / dataNodeCount : 0;

  const heapBreakdown = buildHeapBreakdown(
    cluster.memoryPerNode,
    heapGb,
    hotDataPerNodeGb
  );

  let totalPrimaryShards = 0;
  let totalShards = 0;
  let totalDataWithReplicasGb = 0;
  let totalWriteRate = 0;
  let totalReadRate = 0;

  for (const idx of indices) {
    totalPrimaryShards += idx.primaryShardCount;
    totalShards += indexTotalShards(idx);
    totalDataWithReplicasGb += indexDataWithReplicasGb(idx);
    totalWriteRate += idx.writeRate;
    totalReadRate += idx.readRate;
  }

  const diskTotal = cluster.totalDiskSize > 0 ? cluster.totalDiskSize : 1;
  const dataWithOverheadGb = totalDataWithReplicasGb * diskOverheadFactor;
  const estimatedDiskUsagePercent = Math.min(
    100,
    (dataWithOverheadGb / diskTotal) * 100
  );

  const storagePerDataNode =
    dataNodeCount > 0 ? cluster.totalDiskSize / dataNodeCount : 0;
  const dataPerDataNode =
    dataNodeCount > 0 ? dataWithOverheadGb / dataNodeCount : 0;
  const diskUsagePercent =
    storagePerDataNode > 0
      ? Math.min(100, (dataPerDataNode / storagePerDataNode) * 100)
      : estimatedDiskUsagePercent;

  const shardsPerNode =
    dataNodeCount > 0 ? totalShards / dataNodeCount : totalShards;

  const writePerDataNode =
    dataNodeCount > 0 ? totalWriteRate / dataNodeCount : 0;
  const readPerDataNode =
    dataNodeCount > 0 ? totalReadRate / dataNodeCount : 0;

  const shardSharePerNode =
    dataNodeCount > 0 ? totalShards / dataNodeCount : 0;

  const masterNodes: NodeBreakdown[] = [];
  for (let i = 0; i < masterNodeCount; i++) {
    masterNodes.push({
      nodeId: `master-${i + 1}`,
      kind: "master",
      writeRate: 0,
      readRate: 0,
      storageGb: 0.05,
      dataStorageGb: 0,
      shardCount: 0,
    });
  }

  const dataNodes: NodeBreakdown[] = [];
  for (let i = 0; i < dataNodeCount; i++) {
    dataNodes.push({
      nodeId: `data-${i + 1}`,
      kind: "data",
      writeRate: writePerDataNode,
      readRate: readPerDataNode,
      storageGb: storagePerDataNode,
      dataStorageGb: dataPerDataNode,
      shardCount: shardSharePerNode,
    });
  }

  const ilmBreakdown = buildIlmBreakdown(cluster, indices, diskOverheadFactor);

  const base: Omit<
    CalculationResult,
    "warnings" | "recommendations" | "scalingAssessment"
  > = {
    heapPerNodeGb: heapGb,
    maxShardsPerNode,
    totalPrimaryShards,
    totalShards,
    totalDataWithReplicasGb,
    totalWriteRate,
    totalReadRate,
    diskUsagePercent,
    shardsPerNode,
    estimatedDiskUsagePercent,
    diskOverheadFactor,
    heapBreakdown,
    ilmBreakdown,
    indexBreakdowns,
    masterNodes,
    dataNodes,
  };

  const warnings = collectWarnings(cluster, indices, base);
  const { recommendations, scalingAssessment } = buildRecommendations(
    cluster,
    indices,
    base,
    warnings
  );

  return {
    ...base,
    warnings,
    recommendations,
    scalingAssessment,
  };
}

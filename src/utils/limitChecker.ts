import type { CalculationResult, ClusterConfig, IndexConfig, WarningItem } from "../types";
import { heapPerNodeGb, maxShardsForHeap } from "./heap";

const SHARD_SIZE_WARN_LOW = 10;
const SHARD_SIZE_WARN_HIGH = 50;
const DOCS_PER_SHARD_CRITICAL = 200_000_000;
const SHARDS_PER_NODE_CRITICAL = 1000;
const DISK_WARN = 85;
const DISK_CRITICAL = 95;
const HEAP_SHARD_RATIO_WARN = 20;
const CPU_LOAD_WARN_RATIO = 0.7;

let warnSeq = 0;
function nextId(prefix: string): string {
  warnSeq += 1;
  return `${prefix}-${warnSeq}`;
}

export function collectWarnings(
  cluster: ClusterConfig,
  indices: IndexConfig[],
  result: Omit<
    CalculationResult,
    "warnings" | "recommendations" | "scalingAssessment"
  >
): WarningItem[] {
  const items: WarningItem[] = [];
  const heapGb = heapPerNodeGb(cluster.memoryPerNode);
  const maxShards = maxShardsForHeap(heapGb);

  if (cluster.dataNodeCount <= 0) {
    items.push({
      id: nextId("w"),
      level: "critical",
      message: "Data node count must be at least 1 for capacity estimates.",
    });
  }

  if (cluster.totalDiskSize <= 0) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: "Total disk size is zero or missing.",
    });
  }

  const shardsPerHeapRatio =
    heapGb > 0 ? result.shardsPerNode / (heapGb * HEAP_SHARD_RATIO_WARN) : 0;
  if (shardsPerHeapRatio > 1 && cluster.dataNodeCount > 0) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: `Shard density exceeds typical limit (~${HEAP_SHARD_RATIO_WARN} shards per GB heap).`,
      context: `Approximate ratio vs guideline: ${shardsPerHeapRatio.toFixed(2)}`,
    });
  }

  if (result.shardsPerNode > maxShards && cluster.dataNodeCount > 0) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: `Shards per data node (${result.shardsPerNode.toFixed(1)}) exceed heap-based estimate (${maxShards.toFixed(0)}).`,
    });
  }

  if (result.shardsPerNode > SHARDS_PER_NODE_CRITICAL) {
    items.push({
      id: nextId("w"),
      level: "critical",
      message: `Shards per data node (${result.shardsPerNode.toFixed(0)}) exceed ${SHARDS_PER_NODE_CRITICAL}.`,
    });
  }

  if (result.diskUsagePercent >= DISK_CRITICAL) {
    items.push({
      id: nextId("w"),
      level: "critical",
      message: `Estimated disk usage ${result.diskUsagePercent.toFixed(1)}% exceeds ${DISK_CRITICAL}%.`,
    });
  } else if (result.diskUsagePercent >= DISK_WARN) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: `Estimated disk usage ${result.diskUsagePercent.toFixed(1)}% exceeds ${DISK_WARN}%.`,
    });
  }

  if (result.estimatedDiskUsagePercent >= DISK_CRITICAL) {
    items.push({
      id: nextId("w"),
      level: "critical",
      message: `Cluster-wide data vs raw disk ratio ${result.estimatedDiskUsagePercent.toFixed(1)}% is very high.`,
    });
  }

  const cpuCapacity =
    cluster.dataNodeCount * cluster.cpuPerNode * 1000;
  const loadUnits = result.totalWriteRate + result.totalReadRate * 0.25;
  if (
    cluster.dataNodeCount > 0 &&
    cpuCapacity > 0 &&
    loadUnits > cpuCapacity * CPU_LOAD_WARN_RATIO
  ) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: "Combined indexing and search load may exceed comfortable CPU headroom.",
      context: `Heuristic load units ${loadUnits.toFixed(0)} vs capacity ${cpuCapacity.toFixed(0)}`,
    });
  }

  for (const ib of result.indexBreakdowns) {
    if (ib.primaryShards <= 0) continue;
    if (ib.shardSizeGb < SHARD_SIZE_WARN_LOW) {
      items.push({
        id: nextId("w"),
        level: "warning",
        message: `Index "${ib.indexName}" average shard size ${ib.shardSizeGb.toFixed(2)} GB is below ${SHARD_SIZE_WARN_LOW} GB.`,
      });
    }
    if (ib.shardSizeGb > SHARD_SIZE_WARN_HIGH) {
      items.push({
        id: nextId("w"),
        level: "warning",
        message: `Index "${ib.indexName}" average shard size ${ib.shardSizeGb.toFixed(2)} GB is above ${SHARD_SIZE_WARN_HIGH} GB.`,
      });
    }
    if (ib.docsPerShard > DOCS_PER_SHARD_CRITICAL) {
      items.push({
        id: nextId("w"),
        level: "critical",
        message: `Index "${ib.indexName}" documents per shard exceed ${DOCS_PER_SHARD_CRITICAL}.`,
      });
    }
  }

  const { heapBreakdown, ilmBreakdown } = result;

  if (Number.isFinite(heapBreakdown.cacheRatio) && heapBreakdown.hotDataPerNodeGb > 0) {
    if (heapBreakdown.cacheRatio < 0.2) {
      items.push({
        id: nextId("w"),
        level: "critical",
        message: `OS page cache (${heapBreakdown.osPageCacheGb.toFixed(1)} GB/node) covers only ${(heapBreakdown.cacheRatio * 100).toFixed(0)}% of hot data per node — expect high disk I/O and slow searches.`,
      });
    } else if (heapBreakdown.cacheRatio < 0.5) {
      items.push({
        id: nextId("w"),
        level: "warning",
        message: `OS page cache (${heapBreakdown.osPageCacheGb.toFixed(1)} GB/node) covers ${(heapBreakdown.cacheRatio * 100).toFixed(0)}% of hot data per node — search latency may suffer.`,
      });
    }
  }
  if (heapBreakdown.fieldDataCacheGb > heapBreakdown.totalHeapGb * 0.25) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: `Field data cache allocation (${heapBreakdown.fieldDataCacheGb.toFixed(1)} GB) exceeds 25% of heap — risk of GC pressure under heavy aggregations.`,
    });
  }

  if (heapBreakdown.availableGb < 2 && heapBreakdown.totalHeapGb > 0) {
    items.push({
      id: nextId("w"),
      level: "critical",
      message: `Available heap after internal buffers is only ${heapBreakdown.availableGb.toFixed(1)} GB. Consider increasing node memory.`,
    });
  }

  if (
    ilmBreakdown.enabled &&
    ilmBreakdown.warm.nodeCount > 0 &&
    ilmBreakdown.warm.diskUsagePercent >= DISK_WARN
  ) {
    items.push({
      id: nextId("w"),
      level: ilmBreakdown.warm.diskUsagePercent >= DISK_CRITICAL ? "critical" : "warning",
      message: `Warm tier disk usage ${ilmBreakdown.warm.diskUsagePercent.toFixed(1)}% is high.`,
    });
  }

  if (
    ilmBreakdown.enabled &&
    ilmBreakdown.cold.nodeCount > 0 &&
    ilmBreakdown.cold.diskUsagePercent >= DISK_WARN
  ) {
    items.push({
      id: nextId("w"),
      level: ilmBreakdown.cold.diskUsagePercent >= DISK_CRITICAL ? "critical" : "warning",
      message: `Cold tier disk usage ${ilmBreakdown.cold.diskUsagePercent.toFixed(1)}% is high.`,
    });
  }

  if (indices.length === 0) {
    items.push({
      id: nextId("w"),
      level: "warning",
      message: "No indices configured.",
    });
  }

  return items;
}

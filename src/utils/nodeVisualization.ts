import type {
  ClusterConfig,
  IndexConfig,
  CalculationResult,
  DataNodeVisual,
  NodeVisualWarning,
  PrimaryShardVisual,
  ReplicaShardVisual,
} from "../types";

const DISK_WARN = 85;
const DISK_CRITICAL = 95;
const SHARD_WARN_RATIO = 0.8;

function computeNodeWarnings(
  primaryCount: number,
  replicaCount: number,
  dataStorageGb: number,
  storageGb: number,
  maxShardsPerNode: number
): NodeVisualWarning[] {
  const warnings: NodeVisualWarning[] = [];
  const totalShards = primaryCount + replicaCount;

  if (storageGb > 0) {
    const diskPct = (dataStorageGb / storageGb) * 100;
    if (diskPct >= DISK_CRITICAL) {
      warnings.push({
        level: "critical",
        message: `Disk usage ~${diskPct.toFixed(0)}% is critically high on this node.`,
      });
    } else if (diskPct >= DISK_WARN) {
      warnings.push({
        level: "warning",
        message: `Disk usage ~${diskPct.toFixed(0)}% is approaching capacity on this node.`,
      });
    }
  }

  if (maxShardsPerNode > 0) {
    if (totalShards > maxShardsPerNode) {
      warnings.push({
        level: "critical",
        message: `${totalShards} shards exceed heap-based limit (${maxShardsPerNode}) on this node.`,
      });
    } else if (totalShards > maxShardsPerNode * SHARD_WARN_RATIO) {
      warnings.push({
        level: "warning",
        message: `${totalShards} shards are near heap-based limit (${maxShardsPerNode}) on this node.`,
      });
    }
  }

  return warnings;
}

type FlatPrimary = {
  indexId: string;
  indexName: string;
  shardIndex: number;
  globalOrdinal: number;
  shardSizeGb: number;
  docsPerShard: number;
  writePerShard: number;
  readPerShard: number;
  replicaCount: number;
};

function pickBalancedReplicaNode(
  occupiedNodes: Set<number>,
  shardLoad: number[],
  n: number,
  primaryNode: number
): number {
  let bestNode = -1;
  let bestLoad = Infinity;
  for (let i = 0; i < n; i++) {
    if (!occupiedNodes.has(i) && shardLoad[i] < bestLoad) {
      bestLoad = shardLoad[i];
      bestNode = i;
    }
  }
  if (bestNode !== -1) return bestNode;

  for (let i = 0; i < n; i++) {
    if (i !== primaryNode && shardLoad[i] < bestLoad) {
      bestLoad = shardLoad[i];
      bestNode = i;
    }
  }
  return bestNode !== -1 ? bestNode : (primaryNode + 1) % n;
}

function buildFlatPrimaries(indices: IndexConfig[]): FlatPrimary[] {
  const flat: FlatPrimary[] = [];
  let globalOrdinal = 0;
  for (const idx of indices) {
    const p = Math.max(0, idx.primaryShardCount);
    if (p === 0) {
      continue;
    }
    const w = idx.writeRate / p;
    const r = idx.readRate / p;
    const sz = p > 0 ? idx.totalSize / p : 0;
    const doc = p > 0 ? idx.documentCount / p : 0;
    const R = Math.max(0, idx.replicaShardCount);
    for (let s = 0; s < p; s++) {
      globalOrdinal += 1;
      flat.push({
        indexId: idx.id,
        indexName: idx.name || "index",
        shardIndex: s,
        globalOrdinal,
        shardSizeGb: sz,
        docsPerShard: doc,
        writePerShard: w,
        readPerShard: r,
        replicaCount: R,
      });
    }
  }
  return flat;
}

export function buildDataNodeVisuals(
  cluster: ClusterConfig,
  indices: IndexConfig[],
  result: CalculationResult
): DataNodeVisual[] {
  const n = Math.max(0, cluster.dataNodeCount);
  const flat = buildFlatPrimaries(indices);
  const nodes: DataNodeVisual[] = result.dataNodes.map((dn, displayIdx) => ({
    nodeRole: "data" as const,
    nodeId: dn.nodeId,
    displayLabel: `node ${displayIdx + 1}`,
    writeRate: dn.writeRate,
    readRate: dn.readRate,
    storageGb: dn.storageGb,
    dataStorageGb: dn.dataStorageGb,
    approxDocs: 0,
    primaryCount: 0,
    replicaCount: 0,
    primaryShards: [] as PrimaryShardVisual[],
    replicaShards: [] as ReplicaShardVisual[],
    warnings: [] as NodeVisualWarning[],
  }));

  if (n === 0 || nodes.length === 0) {
    return nodes;
  }

  const shardLoad = new Array(n).fill(0);

  flat.forEach((shard, ordinal) => {
    const nodeIdx = ordinal % n;
    const primary: PrimaryShardVisual = {
      id: `p-${shard.indexId}-${shard.shardIndex}`,
      indexName: shard.indexName,
      shardLabel: `shard ${shard.globalOrdinal}`,
      shardSizeGb: shard.shardSizeGb,
      docsPerShard: shard.docsPerShard,
      readPerSec: shard.readPerShard,
      writePerSec: shard.writePerShard,
    };
    nodes[nodeIdx]!.primaryShards.push(primary);
    nodes[nodeIdx]!.primaryCount += 1;
    shardLoad[nodeIdx] += 1;

    const occupiedNodes = new Set<number>([nodeIdx]);
    for (let r = 0; r < shard.replicaCount; r++) {
      const rNode = pickBalancedReplicaNode(occupiedNodes, shardLoad, n, nodeIdx);
      occupiedNodes.add(rNode);
      const replica: ReplicaShardVisual = {
        id: `r-${shard.indexId}-${shard.shardIndex}-${r}`,
        indexName: shard.indexName,
        sourceShardLabel: `shard ${shard.globalOrdinal}`,
        docsPerShard: shard.docsPerShard,
        dataGb: shard.shardSizeGb,
        readPerSec: shard.readPerShard,
      };
      nodes[rNode]!.replicaShards.push(replica);
      nodes[rNode]!.replicaCount += 1;
      shardLoad[rNode] += 1;
    }
  });

  for (const node of nodes) {
    let d = 0;
    for (const p of node.primaryShards) {
      d += p.docsPerShard;
    }
    for (const r of node.replicaShards) {
      d += r.docsPerShard;
    }
    node.approxDocs = d;
    node.warnings = computeNodeWarnings(
      node.primaryCount,
      node.replicaCount,
      node.dataStorageGb,
      node.storageGb,
      result.maxShardsPerNode
    );
  }

  return nodes;
}

export function buildMasterNodeVisuals(
  result: CalculationResult
): DataNodeVisual[] {
  return result.masterNodes.map((m, idx) => ({
    nodeRole: "master" as const,
    nodeId: m.nodeId,
    displayLabel: `master ${idx + 1}`,
    writeRate: m.writeRate,
    readRate: m.readRate,
    storageGb: m.storageGb,
    dataStorageGb: m.dataStorageGb,
    approxDocs: 0,
    primaryCount: 0,
    replicaCount: 0,
    primaryShards: [] as PrimaryShardVisual[],
    replicaShards: [] as ReplicaShardVisual[],
    warnings: [] as NodeVisualWarning[],
  }));
}

export function clusterVisualSummary(result: CalculationResult): {
  totalPrimaryShards: number;
  totalReplicaCopies: number;
  totalDataGb: number;
} {
  const totalPrimaryShards = result.totalPrimaryShards;
  const totalReplicaCopies = Math.max(
    0,
    result.totalShards - totalPrimaryShards
  );
  return {
    totalPrimaryShards,
    totalReplicaCopies,
    totalDataGb: result.totalDataWithGrowthGb,
  };
}

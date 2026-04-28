export type WorkloadProfile = "balanced" | "search_heavy" | "ingest_heavy";

export interface ClusterConfig {
  masterNodeCount: number;
  dataNodeCount: number;
  memoryPerNode: number;
  memoryPerMasterNode?: number;
  cpuPerNode: number;
  cpuPerMasterNode?: number;
  totalDiskSize: number;
  writeDominant?: boolean;
  warmNodeCount?: number;
  coldNodeCount?: number;
  warmDiskPerNodeGb?: number;
  coldDiskPerNodeGb?: number;
  workloadProfile?: WorkloadProfile;
  growthGbPerDay?: number;
  growthProjectionDays?: number;
  costUsdPerGbRamMonth?: number;
  costUsdPerGbDiskMonth?: number;
  costUsdPerDataNodeMonth?: number;
}

export type ClusterLimitsHint = {
  maxShardsPerNode?: number;
  floodStageDiskPercent?: number;
};

export type UiLocale = "en" | "tr";

export type UiTheme = "light" | "dark";

export type AppMainView = "designer" | "compare" | "cost";

export interface IndexConfig {
  id: string;
  name: string;
  documentCount: number;
  totalSize: number;
  mapping?: string;
  primaryShardCount: number;
  replicaShardCount: number;
  writeRate: number;
  readRate: number;
  retentionDays?: number;
  hotDays?: number;
  warmDays?: number;
}

export type WarningLevel = "warning" | "critical";

export interface WarningItem {
  id: string;
  level: WarningLevel;
  message: string;
  context?: string;
  indexId?: string;
}

export type RecommendationKind = "underscale" | "overscale" | "shard" | "node";

export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  title: string;
  description: string;
  indexId?: string;
}

export type IndexInsightBuckets = {
  warningsByIndexId: ReadonlyMap<string, WarningItem[]>;
  recommendationsByIndexId: ReadonlyMap<string, RecommendationItem[]>;
};

export interface VectorFieldInfo {
  fieldPath: string;
  dims: number;
  m: number;
}

export interface IndexBreakdown {
  indexId: string;
  indexName: string;
  primaryShards: number;
  totalShards: number;
  shardSizeGb: number;
  docsPerShard: number;
  dataWithReplicasGb: number;
  vectorFields: VectorFieldInfo[];
  hnswGraphCount: number;
  vectorCpuFactor: number;
}

export interface NodeBreakdown {
  nodeId: string;
  kind: "master" | "data";
  writeRate: number;
  readRate: number;
  storageGb: number;
  dataStorageGb: number;
  shardCount: number;
}

export interface PrimaryShardVisual {
  id: string;
  indexName: string;
  shardLabel: string;
  shardSizeGb: number;
  docsPerShard: number;
  readPerSec: number;
  writePerSec: number;
}

export interface ReplicaShardVisual {
  id: string;
  indexName: string;
  sourceShardLabel: string;
  docsPerShard: number;
  dataGb: number;
  readPerSec: number;
}

export interface NodeVisualWarning {
  level: "warning" | "critical";
  message: string;
}

export interface DataNodeVisual {
  nodeRole: "master" | "data";
  nodeId: string;
  displayLabel: string;
  writeRate: number;
  readRate: number;
  storageGb: number;
  dataStorageGb: number;
  approxDocs: number;
  primaryCount: number;
  replicaCount: number;
  primaryShards: PrimaryShardVisual[];
  replicaShards: ReplicaShardVisual[];
  warnings: NodeVisualWarning[];
}

export interface HeapBreakdown {
  totalRamGb: number;
  totalHeapGb: number;
  fieldDataCacheGb: number;
  queryBufferGb: number;
  indexingBufferGb: number;
  availableGb: number;
  osPageCacheGb: number;
  hotDataPerNodeGb: number;
  cacheRatio: number;
}

export interface TierBreakdown {
  nodeCount: number;
  totalDiskGb: number;
  usedDataGb: number;
  diskUsagePercent: number;
}

export interface IlmBreakdown {
  enabled: boolean;
  hot: TierBreakdown;
  warm: TierBreakdown;
  cold: TierBreakdown;
}

export interface Snapshot {
  id: string;
  label: string;
  savedAt: number;
  cluster: ClusterConfig;
  indices: IndexConfig[];
}

export type ScalingAssessment = "underscale" | "overscale" | "optimal";

export interface CalculationResult {
  heapPerNodeGb: number;
  maxShardsPerNode: number;
  totalPrimaryShards: number;
  totalShards: number;
  totalDataWithReplicasGb: number;
  growthProjectedExtraGb: number;
  totalDataWithGrowthGb: number;
  totalWriteRate: number;
  totalReadRate: number;
  diskUsagePercent: number;
  shardsPerNode: number;
  estimatedDiskUsagePercent: number;
  diskOverheadFactor: number;
  roughSnapshotRepoGb: number;
  roughSnapshotDurationHours: number;
  heapBreakdown: HeapBreakdown;
  ilmBreakdown: IlmBreakdown;
  indexBreakdowns: IndexBreakdown[];
  masterNodes: NodeBreakdown[];
  dataNodes: NodeBreakdown[];
  warnings: WarningItem[];
  recommendations: RecommendationItem[];
  scalingAssessment: ScalingAssessment;
}

export const STORAGE_KEY = "elastic-calculator-state-v1";
export const SNAPSHOTS_KEY = "elastic-calculator-snapshots-v1";

export interface PersistedState {
  cluster: ClusterConfig;
  indices: IndexConfig[];
  locale?: UiLocale;
  theme?: UiTheme;
}

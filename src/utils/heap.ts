const HEAP_CAP_GB = 31;
const HEAP_RATIO = 0.5;
const SHARDS_PER_HEAP_GB = 20;

export function heapPerNodeGb(memoryPerNodeGb: number): number {
  return Math.min(memoryPerNodeGb * HEAP_RATIO, HEAP_CAP_GB);
}

export function maxShardsForHeap(heapGb: number): number {
  return heapGb * SHARDS_PER_HEAP_GB;
}

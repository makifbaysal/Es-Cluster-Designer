import type { CalculationResult, NodeBreakdown } from "../types";

export function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function csvRowLine(values: (string | number)[]): string {
  return values.map((v) => escapeCell(String(v))).join(",");
}

function row(values: (string | number)[]): string {
  return csvRowLine(values);
}

export function buildNodeCsv(result: CalculationResult): string {
  const lines: string[] = [];
  lines.push(
    row([
      "nodeId",
      "kind",
      "writeRate",
      "readRate",
      "storageGb",
      "dataStorageGb",
      "shardCount",
    ])
  );
  const all: NodeBreakdown[] = [...result.masterNodes, ...result.dataNodes];
  for (const n of all) {
    lines.push(
      row([
        n.nodeId,
        n.kind,
        n.writeRate,
        n.readRate,
        n.storageGb,
        n.dataStorageGb,
        n.shardCount,
      ])
    );
  }
  lines.push("");
  lines.push(row(["metric", "value"]));
  lines.push(row(["heapPerNodeGb", result.heapPerNodeGb]));
  lines.push(row(["maxShardsPerNodeGuideline", result.maxShardsPerNode]));
  lines.push(row(["totalShards", result.totalShards]));
  lines.push(row(["totalDataWithReplicasGb", result.totalDataWithReplicasGb]));
  lines.push(row(["growthProjectedExtraGb", result.growthProjectedExtraGb]));
  lines.push(row(["totalDataWithGrowthGb", result.totalDataWithGrowthGb]));
  lines.push(row(["roughSnapshotRepoGb", result.roughSnapshotRepoGb]));
  lines.push(row(["roughSnapshotDurationHours", result.roughSnapshotDurationHours]));
  lines.push(row(["diskUsagePercent", result.diskUsagePercent]));
  lines.push(row(["scalingAssessment", result.scalingAssessment]));
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

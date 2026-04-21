import type { RecommendationItem } from "../types";

export function recommendationKindLabel(kind: RecommendationItem["kind"]): string {
  switch (kind) {
    case "underscale":
      return "Underscale";
    case "overscale":
      return "Overscale";
    case "shard":
      return "Shard";
    case "node":
      return "Nodes";
    default:
      return kind;
  }
}

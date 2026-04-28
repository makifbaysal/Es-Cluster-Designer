import type { VectorFieldInfo } from "../types";

type MappingNode = Record<string, unknown>;

function extractVectorFieldsFromProps(
  properties: MappingNode,
  prefix: string
): VectorFieldInfo[] {
  const result: VectorFieldInfo[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") continue;
    const field = value as MappingNode;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (field.type === "dense_vector") {
      const dims = typeof field.dims === "number" && field.dims > 0 ? field.dims : 0;
      const indexed = field.index !== false;
      if (dims > 0 && indexed) {
        const indexOptions = field.index_options as MappingNode | undefined;
        const m = typeof indexOptions?.m === "number" && indexOptions.m > 0 ? indexOptions.m : 16;
        result.push({ fieldPath, dims, m });
      }
    }

    if (field.properties && typeof field.properties === "object") {
      result.push(
        ...extractVectorFieldsFromProps(field.properties as MappingNode, fieldPath)
      );
    }
    if (field.fields && typeof field.fields === "object") {
      result.push(
        ...extractVectorFieldsFromProps(field.fields as MappingNode, fieldPath)
      );
    }
  }
  return result;
}

export function parseVectorFieldsFromMapping(mappingJson: string): VectorFieldInfo[] {
  if (!mappingJson.trim()) return [];
  try {
    const mapping = JSON.parse(mappingJson) as MappingNode;
    const props =
      (mapping.properties as MappingNode | undefined) ??
      ((mapping.mappings as { properties?: MappingNode } | undefined)?.properties);
    if (!props || typeof props !== "object") return [];
    return extractVectorFieldsFromProps(props, "");
  } catch {
    return [];
  }
}

export function vectorCpuFactor(fields: VectorFieldInfo[]): number {
  return fields.reduce((sum, f) => sum + (f.dims * f.m) / 1000, 0);
}

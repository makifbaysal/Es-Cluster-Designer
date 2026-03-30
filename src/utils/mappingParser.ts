export interface MappingParseResult {
  estimatedBytesPerDocument: number;
  error?: string;
}

const DEFAULT_TEXT = 200;
const DEFAULT_KEYWORD = 50;

function estimateFieldBytes(
  fieldName: string,
  value: unknown,
  depth: number
): number {
  if (depth > 12) return 0;
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") {
    const t = value.toLowerCase();
    if (t === "text") return DEFAULT_TEXT;
    if (t === "keyword") return DEFAULT_KEYWORD;
    if (t === "long" || t === "integer" || t === "short" || t === "byte")
      return 8;
    if (t === "float" || t === "double" || t === "half_float" || t === "scaled_float")
      return 8;
    if (t === "boolean") return 1;
    if (t === "date" || t === "date_nanos") return 8;
    if (t === "ip") return 16;
    if (t === "geo_point" || t === "geo_shape") return 32;
    if (t === "nested" || t === "object") return 24;
    return 32;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ("properties" in obj && typeof obj.properties === "object") {
      return estimateMappingObject(
        obj.properties as Record<string, unknown>,
        depth + 1
      );
    }
    if ("type" in obj) {
      return estimateFieldBytes(fieldName, obj.type, depth + 1);
    }
    let sum = 8;
    for (const [k, v] of Object.entries(obj)) {
      if (k === "fields" && typeof v === "object") {
        sum += estimateMappingObject(v as Record<string, unknown>, depth + 1);
      } else if (k === "properties" && typeof v === "object") {
        sum += estimateMappingObject(v as Record<string, unknown>, depth + 1);
      }
    }
    return sum;
  }
  return 16;
}

function estimateMappingObject(
  properties: Record<string, unknown>,
  depth: number
): number {
  let total = 0;
  for (const [name, val] of Object.entries(properties)) {
    if (typeof val === "object" && val !== null) {
      const o = val as Record<string, unknown>;
      if (o.properties && typeof o.properties === "object") {
        total += 16 + estimateMappingObject(
          o.properties as Record<string, unknown>,
          depth + 1
        );
      } else if (o.type) {
        total += 8 + estimateFieldBytes(name, o.type, depth);
      } else {
        total += estimateMappingObject(o, depth + 1);
      }
    }
  }
  return total;
}

export function estimateSizeFromMappingJson(json: string): MappingParseResult {
  const trimmed = json.trim();
  if (!trimmed) {
    return { estimatedBytesPerDocument: 0, error: "Empty mapping" };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    let properties: Record<string, unknown> | undefined;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "properties" in parsed &&
      typeof (parsed as { properties?: unknown }).properties === "object"
    ) {
      properties = (parsed as { properties: Record<string, unknown> })
        .properties;
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      "mappings" in parsed
    ) {
      const m = (parsed as { mappings?: { properties?: unknown } }).mappings;
      if (m && typeof m.properties === "object" && m.properties !== null) {
        properties = m.properties as Record<string, unknown>;
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      properties = parsed as Record<string, unknown>;
    }
    if (!properties) {
      return {
        estimatedBytesPerDocument: 256,
        error: "Could not find properties; using default 256 bytes.",
      };
    }
    const bytes = Math.max(32, estimateMappingObject(properties, 0));
    return { estimatedBytesPerDocument: bytes };
  } catch {
    return { estimatedBytesPerDocument: 0, error: "Invalid JSON" };
  }
}

export function estimatedIndexSizeGb(
  bytesPerDoc: number,
  documentCount: number
): number {
  return (bytesPerDoc * documentCount) / (1024 * 1024 * 1024);
}

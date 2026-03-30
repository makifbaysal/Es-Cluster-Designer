import type { IndexConfig } from "../types";
import { BaklavaButton, BaklavaInput } from "../baklava/components";

const TARGET_SHARD_GB = 40;

type Props = {
  index: IndexConfig;
  onChange: (next: IndexConfig) => void;
  onRemove: () => void;
  onOpenMapping: () => void;
};

function readValue(e: Event): string {
  return (e.target as unknown as { value: string }).value;
}

export function IndexForm({
  index,
  onChange,
  onRemove,
  onOpenMapping,
}: Props) {
  const patch = (partial: Partial<IndexConfig>) => {
    onChange({ ...index, ...partial });
  };

  const suggestShards = () => {
    if (index.totalSize <= 0) return;
    const suggested = Math.max(1, Math.ceil(index.totalSize / TARGET_SHARD_GB));
    patch({ primaryShardCount: suggested });
  };

  const ilmEnabled = (index.retentionDays ?? 0) > 0;

  return (
    <div className="index-form">
      <div className="index-form-grid">
        <BaklavaInput
          label="Index name"
          value={index.name}
          onBlInput={(e) => patch({ name: readValue(e) })}
        />
        <BaklavaInput
          type="number"
          label="Document count"
          value={String(index.documentCount)}
          min={0}
          step={1}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ documentCount: Number.isFinite(v) ? v : 0 });
          }}
        />
        <p className="index-form-section-title">Primary shard data before replicas</p>
        <BaklavaInput
          type="number"
          label="Total size on primaries (GB)"
          value={String(index.totalSize)}
          min={0}
          step={0.1}
          helpText="Stored size on primary shards only"
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ totalSize: Number.isFinite(v) ? v : 0 });
          }}
        />
        <div className="index-shard-row">
          <div className="index-shard-label-row">
            <span className="index-shard-label">Primary shards</span>
            <BaklavaButton
              variant="secondary"
              size="small"
              onBlClick={suggestShards}
            >
              Suggest
            </BaklavaButton>
          </div>
          <BaklavaInput
            type="number"
            value={String(index.primaryShardCount)}
            min={1}
            step={1}
            helpText={`~${TARGET_SHARD_GB} GB/shard is optimal`}
            onBlInput={(e) => {
              const v = parseInt(readValue(e) || "1", 10);
              patch({ primaryShardCount: Number.isFinite(v) && v > 0 ? v : 1 });
            }}
          />
        </div>
        <BaklavaInput
          type="number"
          label="Replica shards"
          value={String(index.replicaShardCount)}
          min={0}
          step={1}
          onBlInput={(e) => {
            const v = parseInt(readValue(e) || "0", 10);
            patch({ replicaShardCount: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Write (docs/sec)"
          value={String(index.writeRate)}
          min={0}
          step={100}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ writeRate: Number.isFinite(v) ? v : 0 });
          }}
        />
        <BaklavaInput
          type="number"
          label="Read (queries/sec)"
          value={String(index.readRate)}
          min={0}
          step={10}
          onBlInput={(e) => {
            const v = parseFloat(readValue(e) || "0");
            patch({ readRate: Number.isFinite(v) ? v : 0 });
          }}
        />
        <p className="index-form-section-title">ILM / Retention (optional)</p>
        <BaklavaInput
          type="number"
          label="Retention days"
          value={String(index.retentionDays ?? 0)}
          min={0}
          step={1}
          helpText="0 = no ILM, all data stays on hot tier"
          onBlInput={(e) => {
            const v = parseInt(readValue(e) || "0", 10);
            patch({ retentionDays: Number.isFinite(v) && v >= 0 ? v : 0 });
          }}
        />
        {ilmEnabled && (
          <>
            <BaklavaInput
              type="number"
              label="Hot days"
              value={String(index.hotDays ?? 0)}
              min={0}
              step={1}
              helpText="Days data stays on hot nodes"
              onBlInput={(e) => {
                const v = parseInt(readValue(e) || "0", 10);
                patch({ hotDays: Number.isFinite(v) && v >= 0 ? v : 0 });
              }}
            />
            <BaklavaInput
              type="number"
              label="Warm days"
              value={String(index.warmDays ?? 0)}
              min={0}
              step={1}
              helpText="Days data stays on warm nodes"
              onBlInput={(e) => {
                const v = parseInt(readValue(e) || "0", 10);
                patch({ warmDays: Number.isFinite(v) && v >= 0 ? v : 0 });
              }}
            />
          </>
        )}
        <div className="index-form-spacer" aria-hidden="true" />
      </div>
      <div className="index-form-actions">
        <BaklavaButton variant="secondary" onBlClick={onOpenMapping}>
          Estimate size from mapping
        </BaklavaButton>
        <BaklavaButton kind="danger" variant="secondary" onBlClick={onRemove}>
          Remove index
        </BaklavaButton>
      </div>
    </div>
  );
}

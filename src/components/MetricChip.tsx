import type { ReactNode } from "react";

export type MetricChipTone =
  | "read"
  | "write"
  | "docs"
  | "size"
  | "meta"
  | "cluster";

type Props = {
  tone: MetricChipTone;
  label: string;
  value: ReactNode;
};

export function MetricChip({ tone, label, value }: Props) {
  return (
    <span className={`nb-chip nb-chip--${tone}`}>
      <span className="nb-chip__label">{label}</span>
      <span className="nb-chip__value">{value}</span>
    </span>
  );
}

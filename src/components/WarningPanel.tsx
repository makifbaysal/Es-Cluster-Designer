import type { WarningItem } from "../types";
import { BaklavaAlert } from "../baklava/components";

type Props = {
  items: WarningItem[];
};

export function WarningPanel({ items }: Props) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="panel">
      <h2 className="panel-title">Limits and checks</h2>
      <div className="alert-stack">
        {items.map((w) => (
          <BaklavaAlert
            key={w.id}
            variant={w.level === "critical" ? "danger" : "warning"}
            caption={w.level === "critical" ? "Critical" : "Warning"}
            description={`${w.message}${w.context ? ` ${w.context}` : ""}`}
          />
        ))}
      </div>
    </section>
  );
}

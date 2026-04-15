import type { IndexConfig } from "../types";
import {
  BaklavaAccordion,
  BaklavaAccordionGroup,
  BaklavaButton,
} from "../baklava/components";
import { IndexForm } from "./IndexForm";

type Props = {
  indices: IndexConfig[];
  onChangeIndex: (id: string, next: IndexConfig) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onOpenMapping: (id: string) => void;
  /** When true, omit outer panel shell (used inside accordion). */
  embedded?: boolean;
};

export function IndexList({
  indices,
  onChangeIndex,
  onAdd,
  onRemove,
  onOpenMapping,
  embedded,
}: Props) {
  const inner = (
    <>
      <div className="actions-row index-section-actions">
        <BaklavaButton variant="primary" onBlClick={onAdd}>
          Add index
        </BaklavaButton>
      </div>
      <div className="index-accordion-stack">
        <BaklavaAccordionGroup>
          {indices.map((idx) => (
            <BaklavaAccordion key={idx.id} caption={idx.name || "Unnamed index"}>
              <IndexForm
                index={idx}
                onChange={(next) => onChangeIndex(idx.id, next)}
                onRemove={() => onRemove(idx.id)}
                onOpenMapping={() => onOpenMapping(idx.id)}
              />
            </BaklavaAccordion>
          ))}
        </BaklavaAccordionGroup>
      </div>
    </>
  );

  if (embedded) {
    return <div className="index-list-inner">{inner}</div>;
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Indices</h2>
      {inner}
    </section>
  );
}

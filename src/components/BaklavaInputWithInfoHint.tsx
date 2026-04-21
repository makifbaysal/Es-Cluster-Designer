import { useCallback, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { BaklavaInput } from "../baklava/components";
import { useCloseOnOutsidePointer } from "../hooks/useCloseOnOutsidePointer";

export type BaklavaInputWithInfoHintProps = Omit<ComponentProps<typeof BaklavaInput>, "helpText"> & {
  infoHint: string;
};

export function BaklavaInputWithInfoHint({
  infoHint,
  label,
  type,
  value,
  ...rest
}: BaklavaInputWithInfoHintProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const hintRootRef = useRef<HTMLDivElement>(null);
  const closeHint = useCallback(() => setOpen(false), []);
  const openHint = useCallback(() => setOpen(true), []);
  useCloseOnOutsidePointer(open, hintRootRef, closeHint);

  useEffect(() => {
    const root = hintRootRef.current;
    const host = root?.querySelector("bl-input") as HTMLElement | null;
    if (!root || !host) return;
    const onPointerDown = () => {
      openHint();
    };
    const onFocusOut = () => {
      queueMicrotask(() => {
        if (host.matches(":focus-within")) return;
        closeHint();
      });
    };
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("focusout", onFocusOut);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("focusout", onFocusOut);
    };
  }, [closeHint, openHint]);

  return (
    <div ref={hintRootRef} className="field-with-info field-with-info--outlined">
      <BaklavaInput label={label} type={type} value={value} {...rest} />
      {open ? (
        <div id={panelId} role="region" className="field-info-popover field-info-popover--anchored">
          {infoHint}
        </div>
      ) : null}
    </div>
  );
}

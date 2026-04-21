import { useEffect, type RefObject } from "react";

function eventPathContainsRoot(event: Event, root: HTMLElement): boolean {
  const t = event.target;
  if (t instanceof Node && root.contains(t)) return true;
  return event.composedPath().some((n) => n === root);
}

export function useCloseOnOutsidePointer(
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!active) return;
    const handlePointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || eventPathContainsRoot(e, root)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [active, onClose, rootRef]);
}

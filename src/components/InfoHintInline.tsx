import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { InfoIconButton } from "./InfoIconButton";
import { useCloseOnOutsidePointer } from "../hooks/useCloseOnOutsidePointer";
import { useI18n } from "../i18n/I18nContext";

type Props = {
  infoText: string;
  children: ReactNode;
  className?: string;
};

export function InfoHintInline({ infoText, children, className }: Props) {
  const { t } = useI18n();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const hintRootRef = useRef<HTMLSpanElement>(null);
  const closeHint = useCallback(() => setOpen(false), []);
  useCloseOnOutsidePointer(open, hintRootRef, closeHint);
  return (
    <span ref={hintRootRef} className={`info-hint-inline${className ? ` ${className}` : ""}`}>
      <span className="info-hint-inline__row">
        {children}
        <InfoIconButton
          expanded={open}
          panelId={panelId}
          ariaLabel={t("fieldInfoButtonAria")}
          onToggle={() => setOpen((v) => !v)}
          className="field-info-btn--compact"
        />
      </span>
      {open ? (
        <span id={panelId} role="region" className="field-info-popover field-info-popover--inline">
          {infoText}
        </span>
      ) : null}
    </span>
  );
}

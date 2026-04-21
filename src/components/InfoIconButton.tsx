type Props = {
  expanded: boolean;
  panelId: string;
  ariaLabel: string;
  onToggle: () => void;
  className?: string;
};

export function InfoIconButton({
  expanded,
  panelId,
  ariaLabel,
  onToggle,
  className,
}: Props) {
  return (
    <button
      type="button"
      className={`field-info-btn${className ? ` ${className}` : ""}`}
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg
        className="field-info-btn__svg"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden
        focusable="false"
      >
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          fill="currentColor"
          d="M8 4.35c.36 0 .65.29.65.65 0 .38-.29.7-.65.7a.68.68 0 0 1-.65-.7c0-.36.29-.65.65-.65zm-.45 2.15h.9v5.2h-.9v-5.2z"
        />
      </svg>
    </button>
  );
}

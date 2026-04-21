import { useI18n } from "../i18n/I18nContext";
import type { AppMainView } from "../types";

type Props = {
  active: AppMainView;
  onChange: (v: AppMainView) => void;
  className?: string;
};

export function AppViewNav({ active, onChange, className }: Props) {
  const { t } = useI18n();
  const rootClass = ["app-view-nav", className].filter(Boolean).join(" ");
  return (
    <div className={rootClass} role="navigation" aria-label={t("ariaAppPages")}>
      <button
        type="button"
        className={
          active === "designer"
            ? "app-view-nav-link app-view-nav-link--active"
            : "app-view-nav-link"
        }
        aria-current={active === "designer" ? "page" : undefined}
        onClick={() => onChange("designer")}
      >
        {t("navDesigner")}
      </button>
      <button
        type="button"
        className={
          active === "compare"
            ? "app-view-nav-link app-view-nav-link--active"
            : "app-view-nav-link"
        }
        aria-current={active === "compare" ? "page" : undefined}
        onClick={() => onChange("compare")}
      >
        {t("compare")}
      </button>
      <button
        type="button"
        className={
          active === "cost"
            ? "app-view-nav-link app-view-nav-link--active"
            : "app-view-nav-link"
        }
        aria-current={active === "cost" ? "page" : undefined}
        onClick={() => onChange("cost")}
      >
        {t("navCost")}
      </button>
    </div>
  );
}

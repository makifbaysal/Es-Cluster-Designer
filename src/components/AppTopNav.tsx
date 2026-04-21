import { AppViewNav } from "./AppViewNav";
import { useI18n } from "../i18n/I18nContext";
import type { AppMainView, UiLocale, UiTheme } from "../types";

type Props = {
  theme: UiTheme;
  setTheme: (t: UiTheme) => void;
  mainView: AppMainView;
  setMainView: (v: AppMainView) => void;
};

export function AppTopNav({ theme, setTheme, mainView, setMainView }: Props) {
  const { t, locale, setLocale } = useI18n();

  return (
    <nav className="app-top-nav" aria-label="Main">
      <div className="app-top-nav-inner">
        <div className="app-top-nav-start">
          <span className="app-top-nav-brand">Elastic Cluster Designer</span>
          <AppViewNav
            active={mainView}
            onChange={setMainView}
            className="app-top-nav-pages"
          />
        </div>
        <div className="app-top-nav-actions">
          <select
            className="es-select app-top-nav-select"
            aria-label={t("ariaTheme")}
            value={theme}
            onChange={(e) => setTheme(e.target.value as UiTheme)}
          >
            <option value="light">{t("themeLight")}</option>
            <option value="dark">{t("themeDark")}</option>
          </select>
          <select
            className="es-select app-top-nav-select"
            aria-label={t("ariaLanguage")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as UiLocale)}
          >
            <option value="en">{t("langEn")}</option>
            <option value="tr">{t("langTr")}</option>
          </select>
        </div>
      </div>
    </nav>
  );
}

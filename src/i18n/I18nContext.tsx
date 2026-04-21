/* eslint-disable react-refresh/only-export-components -- hook exported alongside provider */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { UiLocale } from "../types";
import { translate } from "./translations";

type Ctx = {
  locale: UiLocale;
  setLocale: (v: UiLocale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: UiLocale;
  setLocale: (v: UiLocale) => void;
  children: ReactNode;
}) {
  const t = useCallback((key: string) => translate(locale, key), [locale]);
  const v = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={v}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n requires I18nProvider");
  return c;
}

import { useCallback, useEffect, useState } from "react";
import type { ClusterConfig, IndexConfig, PersistedState, UiLocale, UiTheme } from "../types";
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
} from "../utils/storage";

export function useElasticCalculatorState(): {
  cluster: ClusterConfig;
  setCluster: React.Dispatch<React.SetStateAction<ClusterConfig>>;
  indices: IndexConfig[];
  setIndices: React.Dispatch<React.SetStateAction<IndexConfig[]>>;
  locale: UiLocale;
  setLocale: React.Dispatch<React.SetStateAction<UiLocale>>;
  theme: UiTheme;
  setTheme: React.Dispatch<React.SetStateAction<UiTheme>>;
  reset: () => void;
} {
  const initial = loadPersistedState();
  const [cluster, setCluster] = useState<ClusterConfig>(() => initial.cluster);
  const [indices, setIndices] = useState<IndexConfig[]>(() => initial.indices);
  const [locale, setLocale] = useState<UiLocale>(() => initial.locale ?? "en");
  const [theme, setTheme] = useState<UiTheme>(() => initial.theme ?? "light");

  useEffect(() => {
    const s: PersistedState = { cluster, indices, locale, theme };
    savePersistedState(s);
  }, [cluster, indices, locale, theme]);

  const reset = useCallback(() => {
    clearPersistedState();
    const fresh = loadPersistedState();
    setCluster(fresh.cluster);
    setIndices(fresh.indices);
    setLocale(fresh.locale ?? "en");
    setTheme(fresh.theme ?? "light");
  }, []);

  return {
    cluster,
    setCluster,
    indices,
    setIndices,
    locale,
    setLocale,
    theme,
    setTheme,
    reset,
  };
}

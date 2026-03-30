import { useCallback, useEffect, useState } from "react";
import type { ClusterConfig, IndexConfig, PersistedState } from "../types";
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
  reset: () => void;
} {
  const [cluster, setCluster] = useState<ClusterConfig>(
    () => loadPersistedState().cluster
  );
  const [indices, setIndices] = useState<IndexConfig[]>(
    () => loadPersistedState().indices
  );

  useEffect(() => {
    const s: PersistedState = { cluster, indices };
    savePersistedState(s);
  }, [cluster, indices]);

  const reset = useCallback(() => {
    clearPersistedState();
    const fresh = loadPersistedState();
    setCluster(fresh.cluster);
    setIndices(fresh.indices);
  }, []);

  return { cluster, setCluster, indices, setIndices, reset };
}

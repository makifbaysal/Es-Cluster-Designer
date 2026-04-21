import { BaklavaButton, BaklavaDialog } from "../baklava/components";
import { useI18n } from "../i18n/I18nContext";
import type { ClusterConfig, IndexConfig } from "../types";
import {
  EsConnectionPanel,
  type EsClusterInsightsCachePayload,
  type EsConnection,
} from "./EsConnectionPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  setCluster: React.Dispatch<React.SetStateAction<ClusterConfig>>;
  setIndices: React.Dispatch<React.SetStateAction<IndexConfig[]>>;
  onConnectionChange?: (conn: EsConnection | null) => void;
  onClusterInsightsData?: (data: EsClusterInsightsCachePayload) => void;
};

export function EsConnectionModal({
  open,
  onClose,
  setCluster,
  setIndices,
  onConnectionChange,
  onClusterInsightsData,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="es-connection-dialog-root">
      <BaklavaDialog
        open={open}
        caption={t("esModalConnectTitle")}
        onBlDialogClose={() => onClose()}
      >
        <div className="es-connection-modal-body">
          <EsConnectionPanel
            setCluster={setCluster}
            setIndices={setIndices}
            onConnectionChange={onConnectionChange}
            onClusterInsightsData={onClusterInsightsData}
          />
        </div>
        <BaklavaButton
          slot="secondary-action"
          variant="secondary"
          size="large"
          onBlClick={() => onClose()}
        >
          {t("esModalClose")}
        </BaklavaButton>
      </BaklavaDialog>
    </div>
  );
}

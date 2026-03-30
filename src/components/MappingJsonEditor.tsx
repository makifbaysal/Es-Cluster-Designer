import { useMemo } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { BaklavaButton } from "../baklava/components";
import {
  formatJsonPretty,
  jsonValidationMessage,
} from "../utils/jsonEditorHelpers";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function MappingJsonEditor({ value, onChange }: Props) {
  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "on",
      folding: true,
      renderLineHighlight: "line",
      guides: {
        indentation: true,
        bracketPairs: true,
      },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    }),
    []
  );

  const parseError = jsonValidationMessage(value);
  const lineCount = value === "" ? 1 : value.split("\n").length;

  const handleFormat = () => {
    const r = formatJsonPretty(value);
    if (r.ok) {
      onChange(r.text);
    }
  };

  return (
    <div className="mapping-json-editor">
      <div className="mapping-json-editor-toolbar">
        <div className="mapping-json-editor-toolbar-actions">
          <BaklavaButton
            variant="secondary"
            size="small"
            icon="delete"
            onBlClick={() => onChange("")}
          >
            Clear
          </BaklavaButton>
          <BaklavaButton
            variant="primary"
            size="small"
            icon="magic_wand"
            onBlClick={handleFormat}
          >
            Beautify
          </BaklavaButton>
        </div>
        <span className="mapping-json-editor-meta">
          {lineCount} lines
          {parseError === null && value.trim() !== "" && (
            <span className="mapping-json-editor-ok"> · Valid JSON</span>
          )}
          {value.trim() === "" && (
            <span className="mapping-json-editor-muted"> · Empty</span>
          )}
          {parseError !== null && (
            <span className="mapping-json-editor-err"> · {parseError}</span>
          )}
        </span>
      </div>
      <div className="mapping-json-editor-surface">
        <Editor
          height="420px"
          theme="vs"
          defaultLanguage="json"
          value={value}
          path="mapping.json"
          options={options}
          onChange={(v) => onChange(v ?? "")}
        />
      </div>
    </div>
  );
}

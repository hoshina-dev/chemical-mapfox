"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => <div style={{ padding: 12 }}>Loading editor…</div>,
  },
);

interface MonacoFormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
}

export function MonacoFormulaEditor({
  value,
  onChange,
  height = "60vh",
}: MonacoFormulaEditorProps) {
  return (
    <Editor
      height={height}
      defaultLanguage="python"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}

"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

function EditorLoading() {
  const t = useTranslations("common");
  return <div style={{ padding: 12 }}>{t("loading")}</div>;
}

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => <EditorLoading />,
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

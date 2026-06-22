"use client";

import { Anchor } from "@mantine/core";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import Editor from "react-simple-code-editor";

const MAX_LINES = 8;
const LINE_HEIGHT = 20;
const PADDING = 8;

interface CompactFormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExpand: () => void;
  placeholder?: string;
}

export function CompactFormulaEditor({
  value,
  onChange,
  onExpand,
  placeholder,
}: CompactFormulaEditorProps) {
  const lineCount = value ? value.split("\n").length : 1;
  const hasMore = lineCount > MAX_LINES;

  return (
    <div style={{ width: "100%" }}>
      <div
        className="formula-code"
        style={{
          position: "relative",
          maxHeight: MAX_LINES * LINE_HEIGHT + PADDING * 2,
          overflowY: "auto",
          border: "1px solid var(--mantine-color-gray-4)",
          borderRadius: "var(--mantine-radius-sm)",
          background: "var(--mantine-color-body)",
        }}
      >
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={(code) =>
            Prism.languages.python
              ? Prism.highlight(code, Prism.languages.python, "python")
              : code
          }
          padding={PADDING}
          placeholder={placeholder}
          style={{
            fontFamily: "var(--mantine-font-family-monospace)",
            fontSize: 13,
            lineHeight: `${LINE_HEIGHT}px`,
            minHeight: LINE_HEIGHT + PADDING * 2,
          }}
        />
        {hasMore && (
          <div
            aria-hidden
            style={{
              position: "sticky",
              bottom: 0,
              height: 18,
              marginTop: -18,
              pointerEvents: "none",
              background:
                "linear-gradient(to bottom, transparent, var(--mantine-color-body))",
            }}
          />
        )}
      </div>
      {hasMore && (
        <Anchor
          component="button"
          type="button"
          size="xs"
          c="dimmed"
          onClick={onExpand}
          mt={2}
        >
          {`\u2026 ${lineCount} lines \u2014 open editor`}
        </Anchor>
      )}
    </div>
  );
}

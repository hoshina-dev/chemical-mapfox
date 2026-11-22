"use client";

import { useId } from "react";
import { Anchor, VisuallyHidden } from "@mantine/core";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import Editor from "react-simple-code-editor";

const MAX_LINES = 8;
const LINE_HEIGHT = 20;
const PADDING = 8;

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  onExpand?: () => void;
  placeholder?: string;
}

export function FormulaEditor({
  value,
  onChange,
  label,
  onExpand,
  placeholder,
}: FormulaEditorProps) {
  const inputId = useId();
  const lineCount = value ? value.split("\n").length : 1;
  const hasMore = onExpand && lineCount > MAX_LINES;

  return (
    <div style={{ width: "100%" }}>
      <VisuallyHidden>
        <label htmlFor={inputId}>{label}</label>
      </VisuallyHidden>
      <div
        className="formula-code"
        style={{
          position: "relative",
          maxHeight: onExpand ? MAX_LINES * LINE_HEIGHT + PADDING * 2 : "60vh",
          overflowY: "auto",
          border: "1px solid var(--mantine-color-gray-4)",
          borderRadius: "var(--mantine-radius-sm)",
          background: "var(--mantine-color-body)",
        }}
      >
        <Editor
          textareaId={inputId}
          value={value}
          onValueChange={onChange}
          highlight={(code) =>
            Prism.highlight(code, Prism.languages.python ?? {}, "python")
          }
          padding={PADDING}
          placeholder={placeholder}
          tabSize={onExpand ? 2 : 4}
          style={{
            fontFamily: "var(--mantine-font-family-monospace)",
            fontSize: 13,
            lineHeight: `${LINE_HEIGHT}px`,
            minHeight: onExpand ? LINE_HEIGHT + PADDING * 2 : "60vh",
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

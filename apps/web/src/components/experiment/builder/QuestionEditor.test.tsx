import type { Question } from "@repo/forms";
import { useForm } from "@mantine/form";
import { describe, expect, it } from "vitest";

import { emptyDraft, type FormDraft } from "@/lib/builder";

import { fireEvent, render, screen } from "../../../../test/render";
import { QuestionEditor } from "./QuestionEditor";

let current: FormDraft | undefined;
const capture = (draft: FormDraft) => {
  current = draft;
};

function Harness({
  question,
  onValues = capture,
}: {
  question: Question;
  onValues?: (d: FormDraft) => void;
}) {
  const form = useForm<FormDraft>({
    initialValues: {
      ...emptyDraft(),
      clientForm: { name: "C", questions: [question] },
    },
  });
  onValues(form.getValues());
  const q = form.getValues().clientForm.questions[0]!;
  const noop = () => {};
  return (
    <QuestionEditor
      form={form}
      path="clientForm.questions.0"
      question={q}
      index={0}
      total={1}
      onMoveUp={noop}
      onMoveDown={noop}
      onRemove={noop}
    />
  );
}

const storedDefault = () =>
  (current?.clientForm.questions[0] as Extract<Question, { type: "date" }>)
    .config?.default;

describe("date question default to today", () => {
  it("stores the today sentinel and disables the date input", () => {
    render(
      <Harness
        question={{
          id: "d",
          type: "date",
          label: "D",
          config: { default: "2025-01-02" },
        }}
      />,
    );
    const today = screen.getByLabelText("Default to today");
    expect(today).not.toBeChecked();
    expect(screen.getByLabelText("Default")).toHaveDisplayValue("2025-01-02");

    fireEvent.click(today);
    expect(storedDefault()).toBe("today");
    expect(screen.getByLabelText("Default to today")).toBeChecked();
    expect(screen.getByLabelText("Default")).toBeDisabled();
    expect(screen.getByLabelText("Default")).toHaveDisplayValue("");

    fireEvent.click(screen.getByLabelText("Default to today"));
    expect(storedDefault()).toBeUndefined();
    expect(screen.getByLabelText("Default")).toBeEnabled();
  });

  it("works on a question imported without a config object", () => {
    render(<Harness question={{ id: "d", type: "date", label: "D" }} />);
    fireEvent.click(screen.getByLabelText("Default to today"));
    expect(storedDefault()).toBe("today");
  });
});

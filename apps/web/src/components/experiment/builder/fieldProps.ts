import type { UseFormReturnType } from "@mantine/form";

import type { FormDraft } from "@/lib/builder";

/**
 * Mantine's `getInputProps` returns the raw form value, which is `undefined`
 * for optional fields (most `config.*` keys, `description`, `required`, …).
 * Passing `undefined` to a native input makes it uncontrolled, so the first
 * edit flips it to controlled and React warns. These helpers coerce the value
 * so each input stays controlled for its whole lifetime — without writing a
 * value back into the form until the user actually edits it.
 */

export function textProps(form: UseFormReturnType<FormDraft>, path: string) {
  const props = form.getInputProps(path);
  return { ...props, value: (props.value as string | undefined) ?? "" };
}

export function numberProps(form: UseFormReturnType<FormDraft>, path: string) {
  const props = form.getInputProps(path);
  const value = props.value as number | string | null | undefined;
  return { ...props, value: value ?? "" };
}

export function checkboxProps(form: UseFormReturnType<FormDraft>, path: string) {
  const props = form.getInputProps(path, { type: "checkbox" });
  return { ...props, checked: Boolean(props.checked) };
}

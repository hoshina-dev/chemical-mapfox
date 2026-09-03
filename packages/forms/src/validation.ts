import type {
  ColorQuestion,
  FormAnswers,
  NestedQuestion,
  Question,
  QuestionType,
} from "./schema";

/** A required question (or repeatable-group repetition) with no answer. */
export interface MissingRequired {
  /** `questionId` for a top-level question, `groupId.childId[index]` for a repeatable-group entry. */
  path: string;
  label: string;
}

/**
 * Every way an answer can fail its question. Stable identifiers — the UI/BFF
 * translate them (see `describeAnswerIssue` for the English fallback).
 */
export const ANSWER_ISSUE_CODES = [
  /** Required question left blank. */
  "required",
  /** Wrong JavaScript type for the question type (e.g. a string for `number`). */
  "type",
  /** Shorter than `config.minLength`. */
  "minLength",
  /** Longer than `config.maxLength` (or the built-in cap). */
  "maxLength",
  /** Below `config.min`. */
  "min",
  /** Above `config.max`. */
  "max",
  /** `NaN` / `Infinity`. */
  "notFinite",
  /** Magnitude beyond the largest integer JSON round-trips exactly. */
  "tooLarge",
  /** Not one of the question's `config.options`. */
  "option",
  /** More entries than `maxValues` / `maxTags` (or the built-in cap) allows. */
  "maxItems",
  /** Malformed date / time / datetime / color string. */
  "format",
  /** A repeatable-group column longer than the group's `count`. */
  "extraRepetitions",
  /** A `values` key that matches no question in the form. */
  "unknownField",
] as const;

export type AnswerIssueCode = (typeof ANSWER_ISSUE_CODES)[number];

export interface AnswerIssue {
  /** `questionId`, or `groupId.childId[index]` for a repeatable-group entry. */
  path: string;
  /** The question this issue belongs to (the *child* id inside a group). */
  questionId: string;
  /** Human label, including the repetition for a repeatable-group entry. */
  label: string;
  code: AnswerIssueCode;
  /** The constraint that was violated, when the message needs it. */
  limit?: number | string;
}

/**
 * `submit` enforces every constraint. `live` enforces only the "hard" ones
 * (see `HARD_CODES`) so a half-typed answer — too short, still below `min`,
 * not filled in yet — is not rejected while the user is still typing. The
 * collaborative editor autosaves keystroke-by-keystroke and validates in
 * `live` mode; every path that *commits* a form validates in `submit` mode.
 */
export type ValidationMode = "submit" | "live";

/**
 * Constraints that a partially-typed answer can never legitimately violate, so
 * they stay enforced even mid-edit. Everything else (`required`, `minLength`,
 * `min`) is only checked when the form is submitted.
 */
const HARD_CODES = new Set<AnswerIssueCode>([
  "type",
  "maxLength",
  "max",
  "notFinite",
  "tooLarge",
  "option",
  "maxItems",
  "format",
  "extraRepetitions",
  "unknownField",
]);

/** Whether this issue is enforced even against partially-entered input. */
export function isHardIssue(issue: AnswerIssue): boolean {
  return HARD_CODES.has(issue.code);
}

/**
 * Largest magnitude a numeric answer may have. Beyond `Number.MAX_SAFE_INTEGER`
 * a JSON number no longer round-trips exactly, so anything larger is rejected
 * rather than silently stored as a different value.
 */
export const MAX_SAFE_ANSWER_NUMBER = Number.MAX_SAFE_INTEGER;

/** Length caps applied when a text question configures no `maxLength`. */
export const DEFAULT_MAX_STRING_LENGTH = 5_000;
export const DEFAULT_MAX_TEXTAREA_LENGTH = 20_000;
export const DEFAULT_MAX_PASSWORD_LENGTH = 256;
/** Caps applied when a `tags` question configures no `maxTags`. */
export const DEFAULT_MAX_TAGS = 100;
export const DEFAULT_MAX_TAG_LENGTH = 200;

/** The built-in `maxLength` for a text question that doesn't configure one. */
export function defaultMaxLength(type: QuestionType): number | undefined {
  switch (type) {
    case "string":
      return DEFAULT_MAX_STRING_LENGTH;
    case "textarea":
      return DEFAULT_MAX_TEXTAREA_LENGTH;
    case "password":
      return DEFAULT_MAX_PASSWORD_LENGTH;
    default:
      return undefined;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// Tolerant of the spacing and decimal forms Mantine's ColorInput emits.
const N = String.raw`\d{1,3}(?:\.\d+)?`;
const A = String.raw`[01](?:\.\d+)?`;
const COLOR_RE: Record<NonNullable<ColorQuestion["config"]>["format"] & string, RegExp> =
  {
    hex: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
    hexa: /^#([0-9a-f]{4}|[0-9a-f]{8})$/i,
    rgb: new RegExp(String.raw`^rgb\(\s*${N}\s*,\s*${N}\s*,\s*${N}\s*\)$`, "i"),
    rgba: new RegExp(
      String.raw`^rgba\(\s*${N}\s*,\s*${N}\s*,\s*${N}\s*,\s*${A}\s*\)$`,
      "i",
    ),
    hsl: new RegExp(String.raw`^hsl\(\s*${N}\s*,\s*${N}%\s*,\s*${N}%\s*\)$`, "i"),
    hsla: new RegExp(
      String.raw`^hsla\(\s*${N}\s*,\s*${N}%\s*,\s*${N}%\s*,\s*${A}\s*\)$`,
      "i",
    ),
  };

/** `YYYY-MM-DD` that is also a real calendar day (rejects e.g. `2025-02-31`). */
function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isAnswerEmpty(type: QuestionType, value: unknown): boolean {
  switch (type) {
    case "boolean":
      // A switch always has a value (true/false) — nothing to require.
      return false;
    case "multi-select":
    case "checkbox-group":
    case "tags":
      return !Array.isArray(value) || value.length === 0;
    case "number":
    case "select-number":
    case "slider":
    case "rating":
      return value === undefined || value === null;
    default:
      return value === undefined || value === null || value === "";
  }
}

/** Collects issues for one question's answer, without the required check. */
class IssueSink {
  readonly issues: AnswerIssue[] = [];

  constructor(
    private readonly path: string,
    private readonly questionId: string,
    private readonly label: string,
  ) {}

  add(code: AnswerIssueCode, limit?: number | string): void {
    this.issues.push({
      path: this.path,
      questionId: this.questionId,
      label: this.label,
      code,
      limit,
    });
  }
}

function checkText(sink: IssueSink, question: Question, value: unknown): void {
  if (typeof value !== "string") {
    sink.add("type");
    return;
  }
  const config = question.config as
    | { minLength?: number; maxLength?: number }
    | undefined;
  const max = config?.maxLength ?? defaultMaxLength(question.type);
  if (max !== undefined && value.length > max) sink.add("maxLength", max);
  if (config?.minLength !== undefined && value.length < config.minLength) {
    sink.add("minLength", config.minLength);
  }
}

function checkNumber(
  sink: IssueSink,
  value: unknown,
  bounds: { min?: number; max?: number },
): void {
  if (typeof value !== "number") {
    sink.add("type");
    return;
  }
  if (!Number.isFinite(value)) {
    sink.add("notFinite");
    return;
  }
  if (Math.abs(value) > MAX_SAFE_ANSWER_NUMBER) {
    sink.add("tooLarge", MAX_SAFE_ANSWER_NUMBER);
    return;
  }
  if (bounds.max !== undefined && value > bounds.max) sink.add("max", bounds.max);
  if (bounds.min !== undefined && value < bounds.min) sink.add("min", bounds.min);
}

function checkStringList(
  sink: IssueSink,
  value: unknown,
  allowed: Set<string> | null,
  maxItems: number | undefined,
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    sink.add("type");
    return;
  }
  if (maxItems !== undefined && value.length > maxItems) {
    sink.add("maxItems", maxItems);
  }
  if (allowed && value.some((item) => !allowed.has(item as string))) {
    sink.add("option");
  }
}

function checkPattern(
  sink: IssueSink,
  value: unknown,
  ok: (text: string) => boolean,
): void {
  if (typeof value !== "string") {
    sink.add("type");
    return;
  }
  if (!ok(value)) sink.add("format");
}

/**
 * Every constraint the question's `config` declares, checked against one
 * answer. Assumes the answer is non-empty — emptiness is the `required` check,
 * handled by the caller.
 */
function checkAnswer(sink: IssueSink, question: Question, value: unknown): void {
  switch (question.type) {
    case "string":
    case "textarea":
    case "password":
      return checkText(sink, question, value);

    case "number":
      return checkNumber(sink, value, {
        min: question.config?.min,
        max: question.config?.max,
      });

    case "slider":
      return checkNumber(sink, value, {
        min: question.config.min,
        max: question.config.max,
      });

    case "rating":
      return checkNumber(sink, value, {
        min: 0,
        max: question.config?.count ?? 5,
      });

    case "select-string":
    case "radio":
    case "segmented": {
      if (typeof value !== "string") return sink.add("type");
      const allowed = question.config.options.map((option) => option.value);
      if (!allowed.includes(value)) sink.add("option");
      return;
    }

    case "select-number": {
      if (typeof value !== "number") return sink.add("type");
      const allowed = question.config.options.map((option) => option.value);
      if (!allowed.includes(value)) sink.add("option");
      return;
    }

    case "multi-select":
      return checkStringList(
        sink,
        value,
        new Set(question.config.options.map((option) => option.value)),
        question.config.maxValues,
      );

    case "checkbox-group":
      return checkStringList(
        sink,
        value,
        new Set(question.config.options.map((option) => option.value)),
        undefined,
      );

    case "tags": {
      checkStringList(
        sink,
        value,
        null,
        question.config?.maxTags ?? DEFAULT_MAX_TAGS,
      );
      if (
        Array.isArray(value) &&
        value.some(
          (tag) => typeof tag === "string" && tag.length > DEFAULT_MAX_TAG_LENGTH,
        )
      ) {
        sink.add("maxLength", DEFAULT_MAX_TAG_LENGTH);
      }
      return;
    }

    case "boolean":
      if (typeof value !== "boolean") sink.add("type");
      return;

    case "color":
      return checkPattern(sink, value, (text) =>
        COLOR_RE[question.config?.format ?? "hex"].test(text),
      );

    case "date": {
      checkPattern(sink, value, isCalendarDate);
      if (typeof value !== "string" || !isCalendarDate(value)) return;
      // ISO dates are lexicographically ordered, so string compare is enough.
      const { min, max } = question.config ?? {};
      if (max !== undefined && value > max) sink.add("max", max);
      if (min !== undefined && value < min) sink.add("min", min);
      return;
    }

    case "time":
      return checkPattern(sink, value, (text) => TIME_RE.test(text));

    case "datetime":
      return checkPattern(sink, value, (text) => DATETIME_RE.test(text));

    case "repeatable-group":
      // Validated per child column by the caller — a group has no answer of
      // its own (children are stored columnar under their own ids).
      return;
  }
}

function validateOne(
  question: Question,
  value: unknown,
  path: string,
  label: string,
  mode: ValidationMode,
): AnswerIssue[] {
  const sink = new IssueSink(path, question.id, label);
  if (isAnswerEmpty(question.type, value)) {
    if (question.required) sink.add("required");
  } else {
    checkAnswer(sink, question, value);
  }
  return mode === "live" ? sink.issues.filter(isHardIssue) : sink.issues;
}

function validateGroup(
  group: Extract<Question, { type: "repeatable-group" }>,
  values: FormAnswers,
  mode: ValidationMode,
): AnswerIssue[] {
  const issues: AnswerIssue[] = [];
  for (const child of group.config.questions) {
    issues.push(...validateColumn(group, child, values[child.id], mode));
  }
  return issues;
}

/**
 * One repeatable-group child's answers: the column array stored under the
 * child's id, one entry per repetition.
 */
function validateColumn(
  group: Extract<Question, { type: "repeatable-group" }>,
  child: NestedQuestion,
  column: unknown,
  mode: ValidationMode,
): AnswerIssue[] {
  const { count } = group.config;
  const issues: AnswerIssue[] = [];
  const label = (index: number) =>
    `${group.label} #${index + 1} — ${child.label}`;

  if (column !== undefined && column !== null && !Array.isArray(column)) {
    issues.push({
      path: `${group.id}.${child.id}[0]`,
      questionId: child.id,
      label: label(0),
      code: "type",
    });
    return issues;
  }

  const entries = Array.isArray(column) ? column : [];
  if (entries.length > count) {
    issues.push({
      path: `${group.id}.${child.id}`,
      questionId: child.id,
      label: `${group.label} — ${child.label}`,
      code: "extraRepetitions",
      limit: count,
    });
  }

  for (let index = 0; index < count; index++) {
    issues.push(
      ...validateOne(
        child,
        entries[index],
        `${group.id}.${child.id}[${index}]`,
        label(index),
        mode,
      ),
    );
  }
  return issues;
}

export interface ValidateAnswersOptions {
  /** Defaults to `"submit"` — every constraint. */
  mode?: ValidationMode;
  /**
   * Report `values` keys that match no question as `unknownField`. Only use it
   * when `questions` covers the whole answer set (a client intake submission);
   * the shared experiment `values` bag holds both forms' answers.
   */
  rejectUnknownFields?: boolean;
}

/**
 * Every way `values` fails the constraints its `questions` declare — required
 * blanks, wrong types, out-of-range numbers, over-long text, values outside a
 * question's options, malformed dates/colors. An empty array means the answers
 * are acceptable.
 *
 * This is the single enforcement point shared by the renderer (before submit),
 * the server actions (before writing to experiment-manager) and the collab
 * event route (before buffering a keystroke) — so an answer the UI blocks
 * cannot be smuggled in by posting straight to the BFF.
 */
export function validateAnswers(
  questions: Question[],
  values: FormAnswers,
  options: ValidateAnswersOptions = {},
): AnswerIssue[] {
  const mode = options.mode ?? "submit";
  const issues: AnswerIssue[] = [];

  for (const question of questions) {
    if (question.type === "repeatable-group") {
      issues.push(...validateGroup(question, values, mode));
    } else {
      issues.push(
        ...validateOne(question, values[question.id], question.id, question.label, mode),
      );
    }
  }

  if (options.rejectUnknownFields) {
    const known = answerFieldIds(questions);
    for (const key of Object.keys(values)) {
      if (values[key] === undefined || known.has(key)) continue;
      issues.push({
        path: key,
        questionId: key,
        label: key,
        code: "unknownField",
      });
    }
  }

  return issues;
}

/**
 * Every key an answer may legitimately use: top-level question ids plus
 * repeatable-group *child* ids (a group id itself never holds a value).
 */
export function answerFieldIds(questions: Question[]): Set<string> {
  const ids = new Set<string>();
  for (const question of questions) {
    if (question.type === "repeatable-group") {
      for (const child of question.config.questions) ids.add(child.id);
    } else {
      ids.add(question.id);
    }
  }
  return ids;
}

/**
 * Validate a single field's value in isolation — what the collaborative editor
 * sends per keystroke. `field` is a top-level question id or a repeatable-group
 * child id (whose value is the whole column array). Defaults to `live` mode:
 * a field being typed into is not yet a submission.
 *
 * Returns `null` for a field that belongs to no question (the caller decides
 * whether that's a rejection or a foreign key it doesn't own).
 */
export function validateField(
  questions: Question[],
  field: string,
  value: unknown,
  mode: ValidationMode = "live",
): AnswerIssue[] | null {
  for (const question of questions) {
    if (question.type === "repeatable-group") {
      const child = question.config.questions.find((c) => c.id === field);
      if (child) return validateColumn(question, child, value, mode);
      continue;
    }
    if (question.id === field) {
      return validateOne(question, value, question.id, question.label, mode);
    }
  }
  return null;
}

/**
 * Every required question (recursing into repeatable-group children, checked
 * across all `config.count` repetitions) that has no answer in `values`.
 * Empty array means every required field is filled.
 */
export function findMissingRequired(
  questions: Question[],
  values: FormAnswers,
): MissingRequired[] {
  return validateAnswers(questions, values)
    .filter((issue) => issue.code === "required")
    .map(({ path, label }) => ({ path, label }));
}

/**
 * English fallback message for an issue. Localized apps format issues
 * themselves from `code` + `limit`; this keeps `@repo/forms` usable on its own
 * (the docs gallery, tests) without a translation layer.
 */
export function describeAnswerIssue(issue: AnswerIssue): string {
  const { label, limit } = issue;
  switch (issue.code) {
    case "required":
      return `${label} is required.`;
    case "type":
      return `${label} has an unexpected value.`;
    case "minLength":
      return `${label} must be at least ${limit} characters.`;
    case "maxLength":
      return `${label} must be at most ${limit} characters.`;
    case "min":
      return `${label} must be at least ${limit}.`;
    case "max":
      return `${label} must be at most ${limit}.`;
    case "notFinite":
      return `${label} must be a finite number.`;
    case "tooLarge":
      return `${label} is too large — the maximum is ${limit}.`;
    case "option":
      return `${label} must be one of the offered options.`;
    case "maxItems":
      return `${label} allows at most ${limit} entries.`;
    case "format":
      return `${label} is not in the expected format.`;
    case "extraRepetitions":
      return `${label} has more entries than the ${limit} repetitions allowed.`;
    case "unknownField":
      return `${label} is not a question in this form.`;
  }
}

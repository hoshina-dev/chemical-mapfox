import type { AnswerValue, ExperimentTemplate, FormAnswers, Question } from "@repo/forms";

/**
 * What experiment-manager actually evaluates. Source:
 * experiment-manager `app/form_schema.py` (`CALC_BUILTINS`, `collect_values`)
 * and `app/services/calculation_service.py` (`_eval_formula`, `_referenced_names`,
 * `_referenced_value_keys`, `_resolve_order`).
 *
 * A formula is Python with an empty `__builtins__`. Answers are read only as
 * `values['question_id']` (numeric strings are coerced to numbers first).
 * Other calculations are bare names, resolved by dependency rather than
 * declaration order. A repeatable-group child is a list of length
 * `config.count`. The last statement is the result when it is an expression;
 * otherwise the formula must assign `result`.
 */
export const FORMULA_BUILTINS = [
  "round",
  "abs",
  "min",
  "max",
  "sum",
  "len",
  "zip",
  "mean",
  "median",
  "stdev",
] as const;

const RESERVED = new Set<string>([
  ...FORMULA_BUILTINS,
  "values",
  "math",
  "result",
  // Keywords, so `values['a'] if values['a'] else 0` is not an unknown name.
  "if",
  "else",
  "elif",
  "and",
  "or",
  "not",
  "in",
  "is",
  "lambda",
  "for",
  "while",
  "True",
  "False",
  "None",
  "pass",
  "return",
]);

export const FORMULA_GUIDE = `Formulas are Python, run by experiment-manager with no builtins beyond
round, abs, min, max, sum, len, zip, mean, median, stdev, plus the math module
(math.sqrt). int(), float(), and imports are not available; numeric strings are
already coerced. Read an answer as values['question_id'], never the bare id.
Another calculation is a bare name — order does not matter, cycles are rejected.
A repeatable-group child is a list (sum(values['reading']) / len(values['reading'])).
One expression, or several lines whose last line is the expression; otherwise
assign result. No dunder access.`;

export interface FormulaIssue {
  calculation: string;
  message: string;
}

interface IdSets {
  /** Ids that hold an answer, including repeatable-group children. */
  valueIds: Set<string>;
  /** Those plus the group ids themselves. */
  allIds: string[];
}

function collectIds(questions: Question[], into: IdSets): void {
  for (const question of questions) {
    into.allIds.push(question.id);
    if (question.type === "repeatable-group") {
      for (const child of question.config.questions) {
        into.allIds.push(child.id);
        into.valueIds.add(child.id);
      }
    } else {
      into.valueIds.add(question.id);
    }
  }
}

export function templateIds(template: ExperimentTemplate): IdSets {
  const into: IdSets = { valueIds: new Set(), allIds: [] };
  collectIds(template.clientForm.questions, into);
  collectIds(template.labForm.questions, into);
  return into;
}

function stripLiterals(expr: string): string {
  return expr
    .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, " ")
    .replace(/#.*$/gm, " ");
}

function assignedNames(code: string): Set<string> {
  const names = new Set<string>();
  for (const line of code.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

function referencedNames(code: string): Set<string> {
  const names = new Set<string>();
  for (const match of code.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
    names.add(match[0]);
  }
  return names;
}

function valueKeys(expr: string): string[] {
  return [...expr.matchAll(/values\s*\[\s*(['"])((?:\\.|[^\\])*?)\1\s*\]/g)].map(
    (match) => match[2] as string,
  );
}

/** Names that can never be evaluated, matching the engine's dependency walk. */
function circularNames(formulas: Map<string, string>): string[] {
  const deps = new Map<string, Set<string>>();
  for (const [name, expr] of formulas) {
    const code = stripLiterals(expr);
    const referenced = referencedNames(code);
    deps.set(
      name,
      new Set([...referenced].filter((other) => other !== name && formulas.has(other))),
    );
  }
  const resolved = new Set<string>();
  const remaining = new Map(deps);
  while (remaining.size > 0) {
    const ready = [...remaining].filter(([, unmet]) => [...unmet].every((d) => resolved.has(d)));
    if (ready.length === 0) break;
    for (const [name] of ready) {
      resolved.add(name);
      remaining.delete(name);
    }
  }
  return [...remaining.keys()].sort();
}

/**
 * Problems the engine would reject or mis-evaluate, checked without running
 * the formula. A clean result still needs the dry run: this cannot execute
 * Python.
 */
export function inspectFormulas(template: ExperimentTemplate): FormulaIssue[] {
  const issues: FormulaIssue[] = [];
  const { valueIds, allIds } = templateIds(template);
  const seen = new Map<string, number>();
  for (const id of allIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1) {
      issues.push({
        calculation: "",
        message: `Question id '${id}' is used ${count} times. Ids must be unique across the client form, the lab form, and repeatable-group children.`,
      });
    }
  }

  const formulas = new Map(
    Object.entries(template.calculations).map(([name, calc]) => [name, calc.formula]),
  );
  const circular = new Set(circularNames(formulas));

  for (const [name, expr] of formulas) {
    if (RESERVED.has(name) || valueIds.has(name)) {
      issues.push({
        calculation: name,
        message: `Rename calculation '${name}'. That name is ${RESERVED.has(name) ? "a formula builtin" : "also a question id"}, so a formula cannot both read the answer and the result.`,
      });
    }
    if (expr.includes("__")) {
      issues.push({
        calculation: name,
        message: `Calculation '${name}' uses a dunder. The engine rejects those.`,
      });
    }
    for (const key of valueKeys(expr)) {
      if (!valueIds.has(key)) {
        issues.push({
          calculation: name,
          message: `Calculation '${name}' reads values['${key}'], which is not a question id.`,
        });
      }
    }
    if (circular.has(name)) continue;
    const code = stripLiterals(expr);
    const local = assignedNames(code);
    for (const ref of referencedNames(code)) {
      if (local.has(ref) || RESERVED.has(ref) || formulas.has(ref)) continue;
      issues.push({
        calculation: name,
        message: `Calculation '${name}' uses '${ref}', which is not a calculation, a builtin, or math. Answers must be values['…'].`,
      });
    }
  }

  if (circular.size > 0) {
    const names = [...circular].join(", ");
    for (const name of circular) {
      issues.push({
        calculation: name,
        message: `Circular dependency among calculations: ${names}.`,
      });
    }
  }
  return issues;
}

function standInScalar(question: Exclude<Question, { type: "repeatable-group" }>): AnswerValue {
  const config = question.config as { default?: AnswerValue; min?: number; options?: { value: AnswerValue }[] } | undefined;
  if (config && "default" in config && config.default !== undefined && config.default !== null) {
    return config.default;
  }
  switch (question.type) {
    case "number":
    case "rating":
      return typeof config?.min === "number" && config.min !== 0 ? config.min : 1;
    case "slider":
      return question.config.min !== 0 ? question.config.min : 1;
    case "select-number":
      return question.config.options[0]?.value ?? 1;
    case "select-string":
    case "radio":
    case "segmented":
      return question.config.options[0]?.value ?? "sample";
    case "multi-select":
    case "checkbox-group":
      return question.config.options[0] ? [question.config.options[0].value] : [];
    case "boolean":
      return false;
    case "tags":
      return config?.default ?? ["sample"];
    case "date":
      return "2026-01-01";
    case "time":
      return "00:00";
    case "datetime":
      return "2026-01-01T00:00";
    case "color":
      return "#000000";
    default:
      return "sample";
  }
}

/**
 * Answers to dry-run formulas with. Question defaults win, then a stand-in of
 * the right shape (numbers are 1, never 0, so a plain division still runs).
 * `trial` overrides either. Repeatable children become a list of `count`.
 */
export function standInValues(
  template: ExperimentTemplate,
  trial?: FormAnswers,
): FormAnswers {
  const values: FormAnswers = {};
  const fill = (question: Question) => {
    if (question.type === "repeatable-group") {
      for (const child of question.config.questions) {
        const one = standInScalar(child);
        values[child.id] = Array.from({ length: question.config.count }, () => one) as AnswerValue;
      }
      return;
    }
    values[question.id] = standInScalar(question);
  };
  for (const question of template.clientForm.questions) fill(question);
  for (const question of template.labForm.questions) fill(question);
  if (trial) Object.assign(values, trial);
  return values;
}

import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * experiment-manager stub for the stateless calculation dry run the onboarding
 * builder calls when an author tests their formulas:
 *
 *   POST /api/calculations/evaluate
 *
 * The real engine evaluates arbitrary Python. This stub deliberately does not:
 * it understands numeric literals, `+ - * /`, parentheses, `round(x[, n])`,
 * `values['question_id']` lookups and references to other calculations — which
 * is enough for the acceptance scenarios to drive the UI. Anything else comes
 * back as a `runtime` error rather than being silently faked.
 *
 * What matters for these tests is the *contract*, and that is mirrored exactly:
 * a broken formula never fails the request, each calculation reports its own
 * `status` (`ok` / `error` / `skipped`), dependants of a failure are `skipped`,
 * cycles are reported per member, and `missing_values` lists question ids a
 * formula read but never received. Real engine semantics (Python precedence,
 * banker's rounding, comprehensions, the `math` module) are covered by
 * experiment-manager's own test suite, not here.
 *
 * Stateless, so there is no `reset()`.
 */

interface QuestionLike {
  id?: string;
  type?: string;
  config?: {
    default?: unknown;
    count?: number;
    questions?: QuestionLike[];
  };
  default?: unknown;
}

interface FormLike {
  questions?: QuestionLike[];
}

interface CalculationError {
  kind: string;
  message: string;
  names: string[];
}

interface Outcome {
  formula: string;
  status: "ok" | "error" | "skipped";
  result: unknown;
  error: CalculationError | null;
}

class ZeroDivision extends Error {}

const VALUE_REF = /values\[\s*['"]([^'"]+)['"]\s*\]/g;

/** Mirrors the backend's `collect_values`: answers plus question defaults. */
function collectValues(
  forms: (FormLike | null | undefined)[],
  supplied: Record<string, unknown>,
): Record<string, unknown> {
  const values = { ...supplied };
  for (const form of forms) {
    for (const question of form?.questions ?? []) {
      if (question.type === "repeatable-group") {
        const count = question.config?.count;
        const children = question.config?.questions ?? [];
        if (typeof count !== "number") continue;
        for (const child of children) {
          const fallback = child.config?.default ?? child.default;
          if (!child.id || child.id in values || fallback == null) continue;
          values[child.id] = Array.from({ length: count }, () => fallback);
        }
        continue;
      }
      const fallback = question.config?.default ?? question.default;
      if (!question.id || question.id in values || fallback == null) continue;
      values[question.id] = fallback;
    }
  }
  return values;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function referencedValueKeys(formula: string): string[] {
  return [...formula.matchAll(VALUE_REF)].map((match) => match[1] as string);
}

function referencedCalcNames(formula: string, names: string[]): string[] {
  const withoutValues = formula.replace(VALUE_REF, "0");
  return names.filter((name) =>
    new RegExp(`\\b${name}\\b`).test(withoutValues),
  );
}

/** Numbers, `+ - * /`, parens and `round(x[, n])`. Nothing else. */
function parseArithmetic(src: string): number {
  let i = 0;

  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i] as string)) i += 1;
  };

  const expect = (char: string) => {
    skipSpace();
    if (src[i] !== char) throw new Error(`expected "${char}"`);
    i += 1;
  };

  const primary = (): number => {
    skipSpace();
    if (src[i] === "(") {
      i += 1;
      const value = expression();
      expect(")");
      return value;
    }
    if (src[i] === "-") {
      i += 1;
      return -primary();
    }
    if (src.startsWith("round(", i)) {
      i += "round(".length;
      const value = expression();
      skipSpace();
      let digits = 0;
      if (src[i] === ",") {
        i += 1;
        digits = expression();
      }
      expect(")");
      const factor = 10 ** digits;
      return Math.round(value * factor) / factor;
    }
    const literal = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (!literal) throw new Error(`unsupported expression near "${src.slice(i)}"`);
    i += literal[0].length;
    return Number(literal[0]);
  };

  const term = (): number => {
    let value = primary();
    for (;;) {
      skipSpace();
      const op = src[i];
      if (op !== "*" && op !== "/") return value;
      i += 1;
      const rhs = primary();
      if (op === "/" && rhs === 0) throw new ZeroDivision();
      value = op === "*" ? value * rhs : value / rhs;
    }
  };

  const expression = (): number => {
    let value = term();
    for (;;) {
      skipSpace();
      const op = src[i];
      if (op !== "+" && op !== "-") return value;
      i += 1;
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
  };

  const result = expression();
  skipSpace();
  if (i < src.length) throw new Error(`unsupported trailing input "${src.slice(i)}"`);
  return result;
}

function evaluateOne(
  name: string,
  formula: string,
  values: Record<string, unknown>,
  computed: Record<string, number>,
): { value?: number; error?: CalculationError } {
  if (formula.includes("__")) {
    return {
      error: {
        kind: "dunder",
        message: `Invalid expression in '${name}': dunder access not allowed`,
        names: [],
      },
    };
  }

  let substituted = formula;
  for (const key of referencedValueKeys(formula)) {
    const numeric = toNumber(values[key]);
    if (numeric === null) {
      return {
        error: {
          kind: "missing_value",
          message: `Missing value in '${name}': no answer for '${key}'`,
          names: [key],
        },
      };
    }
    substituted = substituted.replace(
      new RegExp(`values\\[\\s*['"]${key}['"]\\s*\\]`, "g"),
      `(${numeric})`,
    );
  }
  for (const [calcName, calcValue] of Object.entries(computed)) {
    substituted = substituted.replace(
      new RegExp(`\\b${calcName}\\b`, "g"),
      `(${calcValue})`,
    );
  }

  try {
    return { value: parseArithmetic(substituted) };
  } catch (error) {
    if (error instanceof ZeroDivision) {
      return {
        error: {
          kind: "zero_division",
          message: `Division by zero in '${name}'`,
          names: [],
        },
      };
    }
    return {
      error: {
        kind: "runtime",
        message: `Calculation error in '${name}': ${(error as Error).message}`,
        names: [],
      },
    };
  }
}

function resolveOrder(
  formulas: Record<string, string>,
): { order: string[]; unresolved: string[] } {
  const names = Object.keys(formulas);
  const pending = new Map(
    names.map((name) => [
      name,
      referencedCalcNames(formulas[name] as string, names).filter(
        (dep) => dep !== name,
      ),
    ]),
  );

  const order: string[] = [];
  const resolved = new Set<string>();
  for (;;) {
    const ready = [...pending.entries()]
      .filter(([, deps]) => deps.every((dep) => resolved.has(dep)))
      .map(([name]) => name)
      .sort();
    if (ready.length === 0) break;
    for (const name of ready) {
      order.push(name);
      resolved.add(name);
      pending.delete(name);
    }
  }
  return { order, unresolved: [...pending.keys()].sort() };
}

function duplicateQuestionIds(forms: (FormLike | null | undefined)[]): string[] {
  const seen = new Map<string, number>();
  for (const form of forms) {
    for (const question of form?.questions ?? []) {
      const children =
        question.type === "repeatable-group"
          ? (question.config?.questions ?? [])
          : [];
      for (const q of [question, ...children]) {
        if (!q.id) continue;
        seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
      }
    }
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;
  if (
    method !== "POST" ||
    path[0] !== "api" ||
    path[1] !== "calculations" ||
    path[2] !== "evaluate"
  ) {
    return false;
  }

  const body = (await ctx.readBody()) as {
    clientForm?: FormLike | null;
    labForm?: FormLike | null;
    calculations?: Record<string, { formula?: string } | string>;
    values?: Record<string, unknown>;
  };

  const forms = [body.clientForm, body.labForm];
  const values = collectValues(forms, body.values ?? {});
  const formulas: Record<string, string> = {};
  for (const [name, entry] of Object.entries(body.calculations ?? {})) {
    const formula = typeof entry === "string" ? entry : entry?.formula;
    if (typeof formula === "string") formulas[name] = formula;
  }

  const { order, unresolved } = resolveOrder(formulas);
  const outcomes: Record<string, Outcome> = {};
  const computed: Record<string, number> = {};
  const failed = new Set<string>();
  const declared = Object.keys(formulas);

  for (const name of order) {
    const formula = formulas[name] as string;
    const blocked = referencedCalcNames(formula, declared)
      .filter((dep) => failed.has(dep))
      .sort();
    if (blocked.length > 0) {
      outcomes[name] = {
        formula,
        status: "skipped",
        result: null,
        error: {
          kind: "dependency_failed",
          message: `Not evaluated — depends on ${blocked.join(
            ", ",
          )}, which did not produce a result`,
          names: blocked,
        },
      };
      failed.add(name);
      continue;
    }

    const { value, error } = evaluateOne(name, formula, values, computed);
    if (error) {
      outcomes[name] = { formula, status: "error", result: null, error };
      failed.add(name);
      continue;
    }
    computed[name] = value as number;
    outcomes[name] = { formula, status: "ok", result: value, error: null };
  }

  for (const name of unresolved) {
    outcomes[name] = {
      formula: formulas[name] as string,
      status: "error",
      result: null,
      error: {
        kind: "circular",
        message: `Circular dependency among calculations: ${unresolved.join(", ")}`,
        names: unresolved.filter((other) => other !== name),
      },
    };
  }

  const referenced = new Set(
    Object.values(formulas).flatMap((formula) => referencedValueKeys(formula)),
  );

  return ctx.json(200, {
    values,
    order,
    calculations: Object.fromEntries(
      declared.filter((name) => name in outcomes).map((name) => [name, outcomes[name]]),
    ),
    missing_values: [...referenced].filter((key) => !(key in values)).sort(),
    duplicate_question_ids: duplicateQuestionIds(forms),
  });
}

registerStub({
  name: "experiment-manager:calculation-dry-run",
  handle,
});

/**
 * Turns a plain arithmetic expression into the per-dish Python a dish run needs.
 */

export type DishFormulaErrorCode =
  /** Nothing to translate. */
  | "empty"
  /** A character outside the small grammar. */
  | "badCharacter"
  /** A name that is neither a measurement nor an earlier calculation. */
  | "unknownName"
  /** Python dunder access, which the engine rejects outright. */
  | "dunder"
  /** No measurement or calculation referenced, so the result is not per-dish. */
  | "noReferences";

export type DishFormulaResult =
  | { ok: true; formula: string }
  | { ok: false; code: DishFormulaErrorCode; name?: string };

/** `values['id']` for a measurement, or the bare name of another calculation. */
export type SeriesLookup = (name: string) => string | undefined;

type Token =
  | { kind: "name"; text: string }
  | { kind: "number"; text: string }
  | { kind: "op"; text: string };

const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER = /^\d+(?:\.\d+)?/;
const OPERATORS = new Set(["+", "-", "*", "/", "(", ")"]);

function tokenize(
  expression: string,
): { ok: true; tokens: Token[] } | { ok: false; code: DishFormulaErrorCode } {
  const tokens: Token[] = [];
  let rest = expression;
  while (rest.length > 0) {
    if (/^\s/.test(rest)) {
      rest = rest.slice(1);
      continue;
    }
    const name = NAME.exec(rest);
    if (name) {
      tokens.push({ kind: "name", text: name[0] });
      rest = rest.slice(name[0].length);
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ kind: "number", text: number[0] });
      rest = rest.slice(number[0].length);
      continue;
    }
    const char = rest[0] as string;
    if (OPERATORS.has(char)) {
      tokens.push({ kind: "op", text: char });
      rest = rest.slice(1);
      continue;
    }
    return { ok: false, code: "badCharacter" };
  }
  return { ok: true, tokens };
}

// The Python for one per-dish calculation, or why the expression was rejected.
export function generateDishFormula(
  expression: string,
  series: SeriesLookup,
): DishFormulaResult {
  if (expression.trim() === "") return { ok: false, code: "empty" };
  if (expression.includes("__")) return { ok: false, code: "dunder" };

  const lexed = tokenize(expression);
  if (!lexed.ok) return { ok: false, code: lexed.code };

  // One loop variable per distinct referenced name, in first-seen order, so the
  // generated code reads in the same order the author wrote it.
  const variables = new Map<string, string>();
  const sources: string[] = [];
  const divisors = new Set<string>();

  for (const [index, token] of lexed.tokens.entries()) {
    if (token.kind !== "name") continue;
    const source = series(token.text);
    if (source === undefined) {
      return { ok: false, code: "unknownName", name: token.text };
    }
    if (!variables.has(token.text)) {
      variables.set(token.text, `v${variables.size}`);
      sources.push(source);
    }
    // A bare name immediately after `/` is a divisor, and a zero there would
    // abort the whole calculate run just as a `None` would.
    if (lexed.tokens[index - 1]?.text === "/") {
      divisors.add(variables.get(token.text) as string);
    }
  }

  if (variables.size === 0) return { ok: false, code: "noReferences" };

  const body = lexed.tokens
    .map((token) => (token.kind === "name" ? variables.get(token.text) : token.text))
    .join(" ");

  const names = [...variables.values()];
  const guards = [
    ...names.map((variable) => `${variable} is not None`),
    ...[...divisors].map((variable) => `${variable} != 0`),
  ];

  // A single series iterates directly; `zip` of one list would yield tuples.
  const iteration =
    names.length === 1
      ? `for ${names[0]} in ${sources[0]}`
      : `for ${names.join(", ")} in zip(${sources.join(", ")})`;

  return {
    ok: true,
    formula: `[${body} if ${guards.join(" and ")} else None ${iteration}]`,
  };
}

/* ------------------------------------------------------------------ *
 * The reported values
 * ------------------------------------------------------------------ */

/** Name of the calculation holding the accepted pair's 0-based dish indexes. */
export const ACCEPTED_PAIR_CALC = "accepted_pair";

/** Name of the calculation reporting `target`'s averaged value. */
export function finalCalcName(target: string): string {
  return `final_${target}`;
}

/** One tolerance rule, with its series already resolved to an expression. */
export interface PairRuleSource {
  /** `values['B']` for a measurement, or a bare calculation name. */
  series: string;
  limit: number;
  decimals?: number;
}

function rounded(expression: string, decimals?: number): string {
  return decimals === undefined ? expression : `round(${expression}, ${decimals})`;
}

/**
 * Python finding the first pair of dishes that agrees on every rule, as
 * `[a, b]` 0-based indexes, or `None` when no pair does.
 */
export function generateAcceptedPairFormula(
  rules: readonly PairRuleSource[],
  maxDishes: number,
): string {
  const pairs: string[] = [];
  for (let b = 1; b < maxDishes; b += 1) {
    for (let a = 0; a < b; a += 1) pairs.push(`(${a}, ${b})`);
  }

  const conditions = rules.flatMap((rule) => {
    const first = `${rule.series}[p[0]]`;
    const second = `${rule.series}[p[1]]`;
    const difference = rounded(
      `abs(${rounded(first, rule.decimals)} - ${rounded(second, rule.decimals)})`,
      rule.decimals,
    );
    return [
      `p[1] < len(${rule.series})`,
      `${first} is not None`,
      `${second} is not None`,
      // Inclusive: a difference exactly equal to the limit agrees.
      `${difference} <= ${rule.limit}`,
    ];
  });

  return [
    `pairs = [${pairs.join(", ")}]`,
    `ok = [p for p in pairs if ${conditions.join(" and ")}]`,
    `[ok[0][0], ok[0][1]] if ok else None`,
  ].join("\n");
}

// Python averaging `series` over the accepted pair, the reported result.
export function generateFinalFormula(series: string, decimals?: number): string {
  const mean = `(${series}[${ACCEPTED_PAIR_CALC}[0]] + ${series}[${ACCEPTED_PAIR_CALC}[1]]) / 2`;
  return `${rounded(mean, decimals)} if ${ACCEPTED_PAIR_CALC} else None`;
}

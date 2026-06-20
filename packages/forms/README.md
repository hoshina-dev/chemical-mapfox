# @repo/forms

Schema + UI for JSON-driven lab forms. Consumed by apps as a workspace
dependency through Next.js `transpilePackages` (the package itself has no build
step — exports point at source).

## Exports

| Entry | Path | What |
| --- | --- | --- |
| `@repo/forms` | `src/index.ts` | Re-exports everything below. |
| `@repo/forms/schema` | `src/schema.ts` | Zod schemas + inferred TS types for every question type, plus `FormDoc`, `ExperimentTemplate`, `FormAnswers`, etc. |
| `@repo/forms/renderer` | `src/FormRenderer.tsx` | Mantine renderer — `FormRenderer` (a whole form), `QuestionField` (one question), `RepeatableGroupField`. |
| `@repo/forms/gallery` | `src/gallery.ts` | `GALLERY` metadata + example questions that drive the docs pages. |
| `@repo/forms/schema.json` | `experiment-template.schema.json` | The JSON Schema (see below). |

## Schema: two artifacts, one source of truth

There are **two** schema artifacts in this package, and they describe the same
shape:

1. **`experiment-template.schema.json`** — a JSON Schema (draft 2020-12). This
   is the **source of truth**. The backend validates and stores templates
   against this same shape, so it is the contract between frontend and backend.

2. **`src/schema.ts`** — Zod schemas, used for runtime validation and to derive
   TypeScript types on the frontend (the renderer, the docs pages, form
   builders). These are **hand-written to mirror** the JSON Schema.

### Why this is acceptable debt

The two are kept in sync **manually** — there is no codegen between them today.
That is deliberate, accepted tech debt: the schema does not change often, so the
cost of a generator (and of debugging its output) outweighs the cost of the
occasional manual edit.

**Rule:** when you change one, change the other. If you add/remove a question
type or a `config` field:

- update `experiment-template.schema.json` (source of truth, backend contract),
- mirror it in `src/schema.ts` (Zod),
- and, if it's a new question type, add a `GALLERY` entry in `src/gallery.ts`
  plus a renderer branch in `src/FormRenderer.tsx`.

The `experiment-template.schema.json` cross-form rule (question `id`s must be
unique across **both** `clientForm` and `labForm`) cannot be expressed in JSON
Schema and is enforced in code.

`examples/full-template.example.json` is a complete template that exercises
every question type — useful as a reference and a fixture.

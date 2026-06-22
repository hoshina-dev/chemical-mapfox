# experiment-manager — backend issues to fix

Issues in the [`experiment-manager`](../../experiment-manager) backend discovered
while building the `/internal/experiment/onboarding` template editor. Each notes
the current frontend state so the corresponding workaround can be removed once
the backend is fixed.

Backend base URL (dev): `http://experiment-manager.mapfox.hoshina.san`

---

## 1. Template **detail** response omits the template's own `description` — RESOLVED

**Fixed in:** experiment-manager PR #11 (`Fix migration`).

The detail response now includes top-level `description`, and
`ExperimentTemplateDetail` in the OpenAPI schema reflects it. After codegen,
`templateDetailToLoaded` reads `detail.description` and the onboarding editor
Metadata → Description field loads correctly.

---

## 2. Omitted / `null` descriptions are rejected by schema validation

**Endpoints:** `POST` / `PUT /api/samples/{sample_id}/experiments[/{lineage_id}]`

The backend validates the template against a JSON Schema in which `description`
must be a `string`. Its Pydantic models (`FormDoc`, `FormQuestion`) default an
omitted `description` to `None`, and the schema then rejects `null`:

```json
{
  "detail": {
    "message": "Experiment template violates schema",
    "errors": [
      "clientForm/description: None is not of type 'string'",
      "clientForm/questions/0: {... 'description': None ...} is not valid under any of the given schemas",
      "labForm/description: None is not of type 'string'"
    ]
  }
}
```

So a form/question without a description (the common case) fails to save.

**Backend fix needed (any of):**

- Allow `null`/absent `description` in the JSON Schema (e.g. `["string", "null"]`
  or not required), **or**
- Strip `None` fields from the Pydantic dump before JSON-Schema validation.

**Frontend state:** a **load-bearing workaround is still in place** —
`normalizeFormDocForApi` (in `apps/web/src/lib/experiment-manager/mappers.ts`)
coerces every form/question `description` to `""` before sending. Without it,
template creation/update fails entirely. **Remove that workaround once the
backend accepts null/absent descriptions.**

---

## 3. Error response shapes (reference, not a bug)

experiment-manager returns errors in more than one shape; the frontend
(`apps/web/src/app/actions/experiment-manager.ts` → `formatDetail`) handles all:

- FastAPI request validation: `{ "detail": [{ "loc": [...], "msg": "..." }] }`
- Template schema check: `{ "detail": { "message": "...", "errors": ["..."] } }`
- Handled errors: `{ "detail": "..." }`

# Documentation screenshots

Drop `.webp` files into the folders below. Until a file exists, the docs
show a text placeholder naming that file.

## Folders

| Kind | Path |
| --- | --- |
| **Localized (UI chrome)** | `apps/web/public/docs/{en\|pl}/` |
| **Shared (language-neutral)** | `apps/web/public/docs/shared/` |

Capture UI in the matching language for localized shots. If `pl` is
missing, the page falls back to the English file when present.

All files are **`.webp`**. Filenames must match exactly (no spaces).

## Inventory

Every current shot is **localized** (UI contains translated labels).

| Filename | Put here (per locale) | Used in | What to capture |
| --- | --- | --- | --- |
| `client-my-experiments-board.webp` | `apps/web/public/docs/{locale}/` | Client overview · Track → board | My experiments board with lifecycle lanes |
| `client-request-catalog.webp` | `apps/web/public/docs/{locale}/` | Client Request → catalogue | Specimen groups / templates catalogue |
| `client-request-intake.webp` | `apps/web/public/docs/{locale}/` | Client Request → intake | Intake form before submit |
| `client-experiment-detail.webp` | `apps/web/public/docs/{locale}/` | Client Track → detail | Detail + lifecycle timeline |
| `client-report-panel.webp` | `apps/web/public/docs/{locale}/` | Client Track → report | View / Download report panel |
| `client-sample-label.webp` | `apps/web/public/docs/{locale}/` | Client Shipping | Ship your sample QR + Print label |
| `client-notification-settings.webp` | `apps/web/public/docs/{locale}/` | Client Settings | Email notification toggles |
| `staff-experiments-listing.webp` | `apps/web/public/docs/{locale}/` | Staff overview · Experiments | Experiments table + filters |
| `staff-sample-checkin.webp` | `apps/web/public/docs/{locale}/` | Staff Check-in | Check-in page + button |
| `staff-workspace-start.webp` | `apps/web/public/docs/{locale}/` | Staff Experiments · Workspace | Sample received + Start experiment |
| `staff-lab-form-collab.webp` | `apps/web/public/docs/{locale}/` | Staff Workspace → collab | Lab form with presence / soft lock |
| `staff-workspace-tabs.webp` | `apps/web/public/docs/{locale}/` | Staff Workspace → tabs | Lab / Client intake / Calculations tabs |
| `staff-finalize-panel.webp` | `apps/web/public/docs/{locale}/` | Staff Finalize | Calculate / report / close |
| `staff-onboarding-samples.webp` | `apps/web/public/docs/{locale}/` | Staff Onboarding → samples | Samples list + Register sample |
| `staff-sample-templates.webp` | `apps/web/public/docs/{locale}/` | Staff Onboarding → templates | Templates table for one sample |
| `staff-template-builder.webp` | `apps/web/public/docs/{locale}/` | Staff Onboarding → builder | Template builder editing questions |
| `staff-register-sample.webp` | `apps/web/public/docs/{locale}/` | Staff Onboarding → register | Register sample modal |
| `staff-new-template.webp` | `apps/web/public/docs/{locale}/` | Staff Templates → create | New template builder |
| `staff-builder-calculations.webp` | `apps/web/public/docs/{locale}/` | Staff Templates → calculations | Builder calculations section |
| `staff-pdf-editor.webp` | `apps/web/public/docs/{locale}/` | Staff PDF report layout | PDF canvas editor |
| `staff-component-reference.webp` | `apps/web/public/docs/{locale}/` | Staff Onboarding · Component reference | Component reference / live preview |

Replace `{locale}` with `en` or `pl`.

### Capture status

Captured against `https://chemfox.ase.cx` into `apps/web/public/docs/{en|pl}/`
by switching the navbar language control (and `NEXT_LOCALE`).

| Filename | en | pl | Notes |
| --- | --- | --- | --- |
| `client-my-experiments-board.webp` | Done | Done | |
| `client-request-catalog.webp` | Done | Done | |
| `client-request-intake.webp` | Done | Done | |
| `client-experiment-detail.webp` | Done | Done | |
| `client-sample-label.webp` | Done | Done | Same REQUESTED detail (includes QR label) |
| `client-notification-settings.webp` | Done | Done | |
| `client-report-panel.webp` | Done | Done | client01 · `159c7177-…` |
| `staff-experiments-listing.webp` | Done | Done | |
| `staff-sample-checkin.webp` | Done | Done | |
| `staff-workspace-start.webp` | Done | Done | |
| `staff-lab-form-collab.webp` | Done | Done | |
| `staff-workspace-tabs.webp` | Done | Done | |
| `staff-finalize-panel.webp` | Done | Done | |
| `staff-onboarding-samples.webp` | Done | Done | |
| `staff-sample-templates.webp` | Done | Done | |
| `staff-template-builder.webp` | Done | Done | |
| `staff-register-sample.webp` | Done | Modal on Onboarding |
| `staff-new-template.webp` | Done | Coal → New template |
| `staff-builder-calculations.webp` | Done | Wtr template calculations |
| `staff-pdf-editor.webp` | Done | Wtr template PDF editor |
| `staff-component-reference.webp` | Done | Done | Prod `/internal/docs/string` |

Re-run helpers (credentials via env, not committed):

```bash
cd apps/web
# English
DOCS_BASE_URL=https://chemfox.ase.cx \
DOCS_CLIENT_EMAIL=… DOCS_CLIENT_PASSWORD=… \
DOCS_STAFF_EMAIL=… DOCS_STAFF_PASSWORD=… \
node scripts/capture-docs-screenshots.mjs

# Polish (navbar language switch)
DOCS_LOCALES=pl \
DOCS_BASE_URL=https://chemfox.ase.cx \
DOCS_CLIENT_EMAIL=… DOCS_CLIENT_PASSWORD=… \
DOCS_STAFF_EMAIL=… DOCS_STAFF_PASSWORD=… \
node scripts/capture-docs-screenshots-locales.mjs
```

### Minimum to start reviewing English docs

Add English files only first:

```
apps/web/public/docs/en/*.webp
```

Then add `pl/` copies when you translate the UI screenshots.

## Source of truth

Ids, placement rules, and which guide section shows which shot are defined in
`apps/web/src/lib/docs/screenshots.ts`.

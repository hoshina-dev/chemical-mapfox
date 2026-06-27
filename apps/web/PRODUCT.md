# Product

## Register

product

## Users

ChemFox serves two audiences with equal weight:

- **Experiment requesters (clients)** — researchers and lab customers who browse supported specimens, submit intake forms, track experiment lifecycle, and print sample labels for shipping. They use the app intermittently, often under deadline, and need clarity on status and next steps without lab jargon.
- **Lab technicians (staff)** — admins who check in samples, run collaborative lab-form workflows, manage experiment state, and onboard new templates. They live in the app daily, often alongside bench work, and need fast scanning, dense information, and reliable multi-user editing.

Both groups expect a professional tool that respects their time: approachable, not playful; precise, not cold.

## Product Purpose

ChemFox is the front-end for a chemical experiment workflow: request → sample receipt → lab execution → results. It connects ticketing, experiment-manager state, and JSON-driven lab forms into a single interface for clients and staff.

Success looks like requesters who never wonder where their sample is, and technicians who can move experiments forward without fighting the UI — especially during collaborative form editing on `/internal/experiment/*`.

## Brand Personality

**Approachable pro** — friendly but serious. The voice is direct and calm, like a colleague who knows the lab. Think Linear's clarity applied to regulated lab work: confident hierarchy, subtle motion, no fluff.

Emotional goal: *trust through competence* — users should feel the product is organized, current, and built by people who understand experiments, not a generic SaaS shell.

## Anti-references

- **Consumer / playful UI** — rounded blobs, mascot illustrations, gamification, celebration confetti, or "fun" empty states that undermine lab credibility.
- **Generic SaaS marketing patterns** — cream hero backgrounds, gradient text, eyebrow kickers on every section, identical icon-card grids.
- **Legacy enterprise gray** — tiny muted text, modal-heavy flows, and tables that hide the most important status information.
- **Dark neon / cyberpunk tool aesthetic** — decorative glow, high-chroma accents everywhere, or "developer tool" theatrics that distract from specimen and experiment data.

## Design Principles

1. **Status is the headline** — lifecycle state, ownership, and next action should be scannable before any secondary detail. Boards, badges, and timelines earn their space.
2. **Forms are the work** — lab and intake forms are not side panels; they deserve clear structure, field-level feedback, and collaborative presence that never obscures the data.
3. **Two registers, one system** — client surfaces stay lighter and explanatory; staff surfaces can be denser, but both share components and never feel like different products.
4. **Show the real object** — experiment titles, sample IDs, requester identity, and timestamps are first-class; avoid placeholder copy and anonymous cards.
5. **Motion with purpose** — hover lifts and transitions signal interactivity (as in the existing bold-card language), never decorate idle screens. Respect reduced motion.

## Accessibility & Inclusion

Sensible defaults: WCAG 2.1 AA contrast for body text and interactive controls, full keyboard operability for Mantine components, visible focus states, and `@media (prefers-reduced-motion: reduce)` alternatives for any custom animation. No special accommodations beyond best practice unless user research surfaces lab-specific needs (gloves, bench lighting).

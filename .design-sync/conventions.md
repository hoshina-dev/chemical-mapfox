# Chemical Mapfox — Design Conventions

## Stack

- **UI library**: [Mantine v7](https://mantine.dev) (`@mantine/core`) — all components, theming, and layout
- **Framework**: Next.js 15 App Router
- **TypeScript** throughout

## Using Mantine

Every design must live inside a `<MantineProvider>`. The provider is registered as `cfg.provider` and wraps every preview automatically.

Prefer Mantine's own spacing/color tokens over arbitrary inline styles:

```tsx
// spacing
<Stack gap="md" p="lg">       // xs / sm / md / lg / xl
<Group gap="sm" px="md">

// color aliases
c="dimmed"                     // secondary text
c="blue.6"                     // primary action
color="red"                    // danger
variant="light"                // soft tinted background
```

### Responsive containers

Wrap page content in `<Container size="lg">` (or `size="xl"` for data-dense views). Do not use pixel-width constraints outside containers.

## Navigation pattern

The app has **two separate nav components** for its two user audiences:

| Component | Audience | Route prefix |
|---|---|---|
| `NavbarClient` | External researchers (clients) | `/dashboard`, `/experiment/*` |
| `ClientNav` | Client sub-navigation within experiments | `/experiment/*` |
| `InternalNav` | Lab staff (technicians, admins) | `/internal/*` |

`NavbarClient` always receives a `SessionUser` prop. Do not mix nav components across audiences.

## ID display

Use `CopyableId` for any experiment or sample ID. It renders a monospace ID with a copy-to-clipboard button and optional link:

```tsx
<CopyableId value={experiment.id} href={`/experiment/${experiment.id}`} />
```

## Breadcrumbs

Use `Breadcrumbs` for all hierarchical page headers. The last crumb (current page) has no `href`:

```tsx
<Breadcrumbs items={[
  { href: "/dashboard", label: "Dashboard" },
  { href: "/experiment", label: "Experiments" },
  { label: "Current page" },         // no href = current, renders as text
]} />
```

## Links as buttons

Use `LinkButton` wherever a Mantine `Button` needs to navigate:

```tsx
<LinkButton href="/experiment/request" variant="light">
  Request experiment
</LinkButton>
```

Never pass `component={Link}` from a Server Component — `LinkButton` exists specifically to keep that client-only prop on the client.

## Timestamps

Use `LocalDateTime` for all ISO timestamps. It renders in the viewer's local timezone:

```tsx
<LocalDateTime iso={experiment.createdAt} />
```

## Raw data inspector

Use `RawJsonView` for debug / detail panels showing structured data:

```tsx
<RawJsonView data={experiment.metadata} />
```

## Sample labels / QR codes

`SampleLabel` renders a printable QR code card for physical sample shipping. Required props: `url` (check-in URL), `title`, `contextId`.

## Color semantics

| Use case | Mantine prop |
|---|---|
| Admin/staff badge | `color="grape"` |
| Client/user badge | `color="blue"` |
| Danger / destructive action | `color="red"` |
| Success / confirmed | `color="teal"` |
| In-progress / pending | `color="yellow"` |

## Data tables (`ExperimentListingTable`)

All listing tables live in `<ScrollArea>` wrappers for overflow. Column headers use `fw={600} size="sm" c="dimmed"`. Row cells are `size="sm"`.

## Presence / collaboration

`PresenceBar` renders an avatar row for real-time collaborators in experiment workspaces. It connects via WebSocket and is self-contained — just mount it.

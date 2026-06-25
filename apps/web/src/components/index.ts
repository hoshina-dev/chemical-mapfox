// Design-system barrel — re-exports the components synced to Claude Design.
// MantineProvider is exposed so cfg.provider can wrap every preview with it,
// injecting the CSS custom properties the theme uses.
//
// _process-polyfill must be imported first: Next.js internals bundled into
// this IIFE access process.env.* at module-eval time and crash without it.
import './_process-polyfill';
export { MantineProvider } from '@mantine/core';
// AuthCard/LoginForm/RegisterForm/OrganizationSelect are excluded because they
// transitively import server-only (session.ts). Action-only buttons (Logout,
// CheckIn, StartExperiment, Finalizing, RegisterSample) are excluded too.
export { NavbarClient } from './_ds_NavbarClient';
export { LocalDateTime } from './LocalDateTime';
export { LinkButton } from './links';
export { MyExperimentsBoard } from './experiment/MyExperimentsBoard';
export { RequestCatalog } from './experiment/request/RequestCatalog';
export { ExperimentListingTable } from './internal/ExperimentListingTable';
export { TechnicianTools } from './dashboard/TechnicianTools';
export { Breadcrumbs } from './internal/Breadcrumbs';
export { CopyableId } from './internal/CopyableId';
export { InternalNav } from './internal/InternalNav';
export { ClientNav } from './experiment/ClientNav';
export { SampleLabel } from './experiment/SampleLabel';
export { ReportPanel } from './experiment/ReportPanel';
export { RawJsonView } from './internal/RawJsonView';
export { PresenceBar } from './internal/collab/PresenceBar';

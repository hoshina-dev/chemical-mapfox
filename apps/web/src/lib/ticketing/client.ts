import "server-only";

import { TicketingConfiguration, TicketsApi } from "@repo/api-client";

import { getTicketingUrl } from "./config";

const configuration = new TicketingConfiguration({
  basePath: getTicketingUrl(),
  fetchApi: (input, init) => fetch(input, { ...init, cache: "no-store" }),
});

export const ticketsApi = new TicketsApi(configuration);

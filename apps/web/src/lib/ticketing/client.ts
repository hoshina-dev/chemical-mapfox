import "server-only";

import { TicketingConfiguration, TicketsApi } from "@repo/api-client";

import { createLoggedFetch } from "@/lib/log/downstream";

import { getTicketingUrl } from "./config";

const loggedFetch = createLoggedFetch("ticketing");

const configuration = new TicketingConfiguration({
  basePath: getTicketingUrl(),
  fetchApi: (input, init) =>
    loggedFetch(input, { ...init, cache: "no-store" }),
});

export const ticketsApi = new TicketsApi(configuration);

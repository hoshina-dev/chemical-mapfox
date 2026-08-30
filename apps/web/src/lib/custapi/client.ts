import "server-only";

import {
  CustApiConfiguration,
  OrganizationsApi,
  UsersApi,
} from "@repo/api-client";

import { createLoggedFetch } from "@/lib/log/downstream";

const DEFAULT_CUSTAPI_URL = "http://custapi.mapfox.hoshina.san/api/v1";

export function getCustApiUrl(): string {
  return process.env.CUSTAPI_URL?.replace(/\/$/, "") ?? DEFAULT_CUSTAPI_URL;
}

const loggedFetch = createLoggedFetch("custapi");

const configuration = new CustApiConfiguration({
  basePath: getCustApiUrl(),
  fetchApi: (input, init) =>
    loggedFetch(input, { ...init, cache: "no-store" }),
});

export const organizationsApi = new OrganizationsApi(configuration);
export const usersApi = new UsersApi(configuration);

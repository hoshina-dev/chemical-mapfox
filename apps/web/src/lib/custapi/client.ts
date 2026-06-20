import "server-only";

import {
  CustApiConfiguration,
  OrganizationsApi,
  UsersApi,
} from "@repo/api-client";

const DEFAULT_CUSTAPI_URL = "http://custapi.mapfox.hoshina.san/api/v1";

export function getCustApiUrl(): string {
  return process.env.CUSTAPI_URL?.replace(/\/$/, "") ?? DEFAULT_CUSTAPI_URL;
}

const configuration = new CustApiConfiguration({
  basePath: getCustApiUrl(),
  fetchApi: (input, init) => fetch(input, { ...init, cache: "no-store" }),
});

export const organizationsApi = new OrganizationsApi(configuration);
export const usersApi = new UsersApi(configuration);

/* eslint-disable @typescript-eslint/no-namespace */

// Experiment Manager is consumed as types only (openapi-typescript output);
// the runtime client is a hand-written fetch wrapper in the consuming app.
export namespace ExperimentManager {
  export type Paths = import("./experiment-manager").paths;
  export type Components = import("./experiment-manager").components;
  export type Operations = import("./experiment-manager").operations;
}

export type {
  UserDetailResponse,
  UserResponse,
  UserMembershipResponse,
  OrganizationResponse,
  CreateUserRequest,
  AddMemberRequest,
} from "./custapi";
export {
  Configuration as CustApiConfiguration,
  ResponseError as CustApiResponseError,
  MemberRole,
  OrganizationsApi,
  UsersApi,
} from "./custapi";

export type {
  GithubComHoshinaDevTicketingServiceInternalDtoAddExperimentTemplateRequest as TicketingAddExperimentTemplateRequest,
  GithubComHoshinaDevTicketingServiceInternalDtoCreateTicketRequest as TicketingCreateTicketRequest,
  GithubComHoshinaDevTicketingServiceInternalDtoErrorResponse as TicketingErrorResponse,
  GithubComHoshinaDevTicketingServiceInternalDtoTicketExperimentTemplateResponse as TicketingExperimentTemplateResponse,
  GithubComHoshinaDevTicketingServiceInternalDtoTicketResponse as TicketingTicketResponse,
  GithubComHoshinaDevTicketingServiceInternalDtoTransitionStatusRequest as TicketingTransitionStatusRequest,
} from "./ticketing";
export {
  Configuration as TicketingConfiguration,
  ExperimentTemplatesApi as TicketingExperimentTemplatesApi,
  HealthApi as TicketingHealthApi,
  ResponseError as TicketingResponseError,
  TicketsApi,
} from "./ticketing";

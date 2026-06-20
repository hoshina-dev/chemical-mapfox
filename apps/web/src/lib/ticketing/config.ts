import "server-only";

const DEFAULT_URL = "http://ticketing-service.mapfox.hoshina.san";

export function getTicketingUrl(): string {
  return process.env.TICKETING_URL?.replace(/\/$/, "") ?? DEFAULT_URL;
}

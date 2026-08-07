/**
 * Dummy organization id for ChemFox — the real "chemfox" organization's id in
 * CUSTAPI (see `organizations/search?q=chemfox`).
 *
 * CUSTAPI is organization-aware; ChemFox is not. Every ChemFox user is
 * assigned to this single org so the CUSTAPI membership / ticketing contracts
 * stay satisfied without exposing org pickers or membership resolution in the UI.
 * Both CUSTAPI and the ticketing service require this to be a real UUID.
 */
export const CHEMFOX_ORG_ID = "daef78e7-6251-4b51-92cd-c8fc16fb6cb7";

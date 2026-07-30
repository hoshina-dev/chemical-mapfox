/**
 * Dummy organization id for ChemFox.
 *
 * CUSTAPI is organization-aware; ChemFox is not. Every ChemFox user is
 * assigned to this single org so the CUSTAPI membership / ticketing contracts
 * stay satisfied without exposing org pickers or membership resolution in the UI.
 */
export const CHEMFOX_ORG_ID = "CHEMFOX_ORG";

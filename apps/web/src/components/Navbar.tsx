import { getSession, toSessionUser } from "@/lib/auth/dal";

import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  return <NavbarClient user={toSessionUser(session)} />;
}

import { redirect } from "next/navigation";

import { settingsPath } from "@/lib/settings/routes";

/** Legacy client settings URL — account settings now live at `/settings`. */
export default function LegacyExperimentSettingsRedirect() {
  redirect(settingsPath());
}

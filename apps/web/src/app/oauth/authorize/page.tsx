import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Container,
  Group,
  List,
  ListItem,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/dal";
import { loginPathWithReturnTo } from "@/lib/auth/returnTo";
import { BRAND } from "@/lib/brand";
import { getRequestOrigin } from "@/lib/http/origin";
import {
  authorizeRedirectUrl,
  type RawAuthorizeParams,
  validateAuthorizeRequest,
} from "@/lib/oauth/authorize";
import { isKnownAiRedirect, redirectHost } from "@/lib/oauth/redirect";
import { WRITE_SCOPES } from "@/lib/oauth/scopes";

export const dynamic = "force-dynamic";

const SCOPE_LABEL = {
  "experiments:write": "scope.experimentsWrite",
  "templates:write": "scope.templatesWrite",
} as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container size={520} py="xl">
      <Paper withBorder shadow="sm" radius="md" p="lg">
        <Stack gap="md">{children}</Stack>
      </Paper>
    </Container>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<RawAuthorizeParams>;
}) {
  const raw = await searchParams;
  const t = await getTranslations("auth.oauth");

  const session = await getSession();
  if (!session) {
    const query = new URLSearchParams(
      Object.entries(raw).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    );
    redirect(loginPathWithReturnTo(`/oauth/authorize?${query}`));
  }

  const result = await validateAuthorizeRequest(raw, await getRequestOrigin());
  if (!result.ok) {
    if (result.kind === "redirect") redirect(result.url);
    return (
      <Shell>
        <Title order={2}>{t("invalidTitle")}</Title>
        <Text>{t("invalidBody")}</Text>
      </Shell>
    );
  }
  const { params, client } = result;
  const host = redirectHost(params.redirectUri);
  const requested = params.scope.split(" ");
  const writeScopes = WRITE_SCOPES.filter((scope) => requested.includes(scope));

  if (session.role !== "admin") {
    return (
      <Shell>
        <Title order={2}>{t("staffOnlyTitle")}</Title>
        <Text>{t("staffOnlyBody", { brand: BRAND.name })}</Text>
        <Anchor
          href={authorizeRedirectUrl(params.redirectUri, {
            error: "access_denied",
            state: params.state,
          })}
        >
          {t("returnTo", { host })}
        </Anchor>
      </Shell>
    );
  }

  return (
    <Shell>
      <Title order={2}>
        {t("title", { client: client.clientName, brand: BRAND.name })}
      </Title>
      <Text size="sm" c="dimmed">
        {t("signedInAs", { name: session.name, email: session.email })}
      </Text>
      {!isKnownAiRedirect(params.redirectUri) && (
        <Alert color="orange" variant="light" title={t("unknownAppTitle")}>
          {t("unknownAppBody", { host })}
        </Alert>
      )}
      <Text>{t("intro", { client: client.clientName })}</Text>
      <form method="post" action="/oauth/authorize/decision">
        <Stack gap="md">
          <List size="sm" spacing={4}>
            <ListItem>{t("permissionRead")}</ListItem>
          </List>
          {writeScopes.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                {t("chooseWrite")}
              </Text>
              {writeScopes.map((scope) => (
                <Checkbox
                  key={scope}
                  name="grant"
                  value={scope}
                  defaultChecked
                  label={t(SCOPE_LABEL[scope])}
                />
              ))}
            </Stack>
          )}
          <Text size="sm" c="dimmed">
            {t("redirectNote", { host })}
          </Text>
          <Text size="sm" c="dimmed">
            {t("revokeNote")}
          </Text>
        <input type="hidden" name="response_type" value="code" />
        <input type="hidden" name="client_id" value={params.clientId} />
        <input type="hidden" name="redirect_uri" value={params.redirectUri} />
        <input type="hidden" name="code_challenge" value={params.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="scope" value={params.scope} />
        {params.state !== null && (
          <input type="hidden" name="state" value={params.state} />
        )}
        {params.resource !== null && (
          <input type="hidden" name="resource" value={params.resource} />
        )}
          <Group justify="flex-end">
            <Button type="submit" name="decision" value="deny" variant="default">
              {t("deny")}
            </Button>
            <Button type="submit" name="decision" value="approve">
              {t("approve")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Shell>
  );
}

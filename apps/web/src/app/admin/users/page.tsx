import { Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { UserLookup } from "@/components/admin/UserLookup";
import { requireAdmin } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const t = await getTranslations("staff.users");

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitle")}
          </Text>
        </div>
        <UserLookup />
      </Stack>
    </Container>
  );
}

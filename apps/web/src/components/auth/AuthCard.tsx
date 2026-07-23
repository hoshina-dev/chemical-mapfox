"use client";

import { Container, Group, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BRAND } from "@/lib/brand";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export type AuthTab = "login" | "register";

export function AuthCard({ defaultTab = "login" }: { defaultTab?: AuthTab }) {
  const t = useTranslations("auth.card");

  return (
    <Container size={460} py="xl">
      <Stack gap="lg">
        <Group justify="flex-end">
          <LanguageSwitcher size="xs" />
        </Group>
        <div>
          <Title order={1} ta="center">
            {BRAND.name}
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            {t("subtitle")}
          </Text>
        </div>

        <Paper withBorder shadow="sm" radius="md" p="lg">
          <Tabs defaultValue={defaultTab}>
            <Tabs.List grow mb="md">
              <Tabs.Tab value="login">{t("tabLogin")}</Tabs.Tab>
              <Tabs.Tab value="register">{t("tabRegister")}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="login">
              <LoginForm />
            </Tabs.Panel>
            <Tabs.Panel value="register">
              <RegisterForm />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>
    </Container>
  );
}

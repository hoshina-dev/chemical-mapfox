"use client";

import { Container, Paper, Stack, Tabs, Text, Title } from "@mantine/core";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export function AuthCard() {
  return (
    <Container size={460} py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1} ta="center">
            Chemical Mapfox
          </Title>
          <Text c="dimmed" ta="center" size="sm">
            Sign in or create an account to continue.
          </Text>
        </div>

        <Paper withBorder shadow="sm" radius="md" p="lg">
          <Tabs defaultValue="login">
            <Tabs.List grow mb="md">
              <Tabs.Tab value="login">Sign in</Tabs.Tab>
              <Tabs.Tab value="register">Register</Tabs.Tab>
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

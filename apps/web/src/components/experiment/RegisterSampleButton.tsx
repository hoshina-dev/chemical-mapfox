"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSampleAction } from "@/app/actions/experiment-manager";
import { sampleOnboardingPath } from "@/lib/experiment-manager/routes";

export function RegisterSampleButton() {
  const t = useTranslations("staff.registerSample");
  const [opened, { open, close }] = useDisclosure(false);
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSampleAction(name, description);
      if (!result.success) {
        setError(result.error);
        return;
      }
      close();
      reset();
      router.push(sampleOnboardingPath(result.data.id));
    });
  }

  return (
    <>
      <Button onClick={open} color="green">
        {t("button")}
      </Button>
      <Modal opened={opened} onClose={close} title={t("modalTitle")} centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("description")}
          </Text>
          {error && (
            <Alert color="red" variant="light" title={t("errorTitle")}>
              <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                {error}
              </Text>
            </Alert>
          )}
          <TextInput
            label={t("name")}
            required
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label={t("descriptionLabel")}
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submit}
              loading={isPending}
              disabled={!name.trim()}
              color="green"
            >
              {t("create")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

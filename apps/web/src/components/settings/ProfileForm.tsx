"use client";

import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateProfile } from "@/app/actions/account";
import { AvatarCropModal } from "@/components/settings/AvatarCropModal";
import { UserAvatar } from "@/components/UserAvatar";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ProfileForm({
  name,
  email,
  phoneNumber,
  avatarUrl,
}: {
  name: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
}) {
  const t = useTranslations("settings.profile");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string[];
    phoneNumber?: string[];
  }>({});
  const [saved, setSaved] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    avatarUrl ?? null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [cropModalOpened, setCropModalOpened] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  function handleFileSelect(file: File | null) {
    setFileError(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError(t("avatarInvalidType"));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(t("avatarTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setCropModalOpened(true);
    };
    reader.readAsDataURL(file);
  }

  function handleCropComplete(croppedFile: File) {
    setAvatarFile(croppedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(croppedFile);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      setSaved(false);
      const result = await updateProfile(formData);
      if (!result.success) {
        setError(result.error ?? null);
        setFieldErrors(result.errors ?? {});
        return;
      }
      setAvatarFile(null);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={2}>{t("title")}</Title>
            <Text c="dimmed">{t("subtitle")}</Text>
          </Stack>

          {error && (
            <Alert color="red" variant="light" title={tCommon("error")}>
              {error}
            </Alert>
          )}

          <Group gap="md" align="center">
            <div style={{ position: "relative" }}>
              <UserAvatar
                name={name}
                email={email}
                avatarUrl={avatarPreview}
                size={88}
                radius="50%"
              />
              <FileButton
                onChange={handleFileSelect}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                disabled={pending}
              >
                {(props) => (
                  <Button
                    {...props}
                    variant="filled"
                    size="compact-xs"
                    radius="xl"
                    aria-label={t("changePhoto")}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                    }}
                  >
                    <IconCamera size={14} />
                  </Button>
                )}
              </FileButton>
            </div>
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                {t("photo")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("photoHint")}
              </Text>
            </Stack>
          </Group>

          {fileError && (
            <Text c="red" size="sm">
              {fileError}
            </Text>
          )}

          <TextInput
            name="name"
            label={t("name")}
            defaultValue={name}
            required
            error={fieldErrors.name?.[0]}
            disabled={pending}
          />
          <TextInput
            label={t("email")}
            value={email}
            description={t("emailReadOnly")}
            disabled
            readOnly
          />
          <TextInput
            name="phoneNumber"
            label={t("phone")}
            defaultValue={phoneNumber ?? ""}
            description={t("phoneOptional")}
            error={fieldErrors.phoneNumber?.[0]}
            disabled={pending}
          />

          <Group gap="sm" align="center">
            <Button type="submit" loading={pending}>
              {tCommon("save")}
            </Button>
            {saved && !pending && (
              <Badge color="green" variant="light">
                {tCommon("saved")}
              </Badge>
            )}
          </Group>
        </Stack>
      </form>

      {rawImageSrc && (
        <AvatarCropModal
          opened={cropModalOpened}
          onClose={() => setCropModalOpened(false)}
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}

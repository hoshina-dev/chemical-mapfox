"use client";

import "react-image-crop/dist/ReactCrop.css";

import {
  Button,
  Group,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalRoot,
  ModalTitle,
  Stack,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  type Crop,
  makeAspectCrop,
  type PixelCrop,
} from "react-image-crop";

interface AvatarCropModalProps {
  opened: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export function AvatarCropModal({
  opened,
  onClose,
  imageSrc,
  onCropComplete,
}: AvatarCropModalProps) {
  const t = useTranslations("settings.profile");
  const tCommon = useTranslations("common");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const outputSize = Math.min(completedCrop.width * scaleX, 512);
    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      outputSize,
      outputSize,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "avatar.webp", {
          type: "image/webp",
        });
        onCropComplete(file);
        onClose();
      },
      "image/webp",
      0.85,
    );
  }, [completedCrop, onCropComplete, onClose]);

  return (
    <ModalRoot opened={opened} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>
          <ModalTitle fw={600}>{t("cropTitle")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Stack gap="md" pb="md">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  alt={t("cropPreviewAlt")}
                  src={imageSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: 400, maxWidth: "100%" }}
                />
              </ReactCrop>
            </div>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={!completedCrop}>
                {tCommon("save")}
              </Button>
            </Group>
          </Stack>
        </ModalBody>
      </ModalContent>
    </ModalRoot>
  );
}

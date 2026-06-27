"use client";

import { Avatar, type AvatarProps } from "@mantine/core";

import { avatarColorFor, avatarColorSeed } from "@/lib/avatarColors";
import { userInitials } from "@/lib/userInitials";

export interface UserAvatarProps extends Omit<AvatarProps, "src" | "children" | "name"> {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  alt,
  color,
  ...avatarProps
}: UserAvatarProps) {
  const seed = avatarColorSeed({ name, email });
  const fallbackColor = !avatarUrl && !color ? avatarColorFor(seed) : undefined;

  return (
    <Avatar
      src={avatarUrl ?? undefined}
      alt={alt ?? seed}
      color={color ?? fallbackColor}
      {...avatarProps}
    >
      {userInitials({ name, email })}
    </Avatar>
  );
}

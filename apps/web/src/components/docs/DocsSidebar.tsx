"use client";

import { GALLERY } from "@repo/forms";
import { NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocsNavItem } from "@/lib/docs/nav";
import { staffComponentTypePath } from "@/lib/docs/routes";

function isGuideActive(pathname: string, href: string, base: string): boolean {
  if (href === base) {
    return pathname === base || pathname === `${base}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsSidebar({
  guides,
  guideKeysNamespace,
  showComponentGallery = false,
}: {
  guides: readonly DocsNavItem[];
  /** docs.sidebar.staffGuides | docs.sidebar.clientGuides */
  guideKeysNamespace: "staffGuides" | "clientGuides";
  showComponentGallery?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("docs");
  const base = guides[0]?.href ?? "/";

  return (
    <ScrollArea h="100%">
      <Stack gap="lg" p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
            {t("sidebar.guides")}
          </Text>
          {guides.map((item) => {
            const active = isGuideActive(pathname, item.href, base);
            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                active={active}
                label={t(`sidebar.${guideKeysNamespace}.${item.key}`)}
                variant={active ? "filled" : "subtle"}
              />
            );
          })}
        </Stack>

        {showComponentGallery ? (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
              {t("sidebar.components")}
            </Text>
            {GALLERY.map((entry) => {
              const href = staffComponentTypePath(entry.type);
              const active = pathname === href || pathname === `${href}/`;
              return (
                <NavLink
                  key={entry.type}
                  component={Link}
                  href={href}
                  active={active}
                  label={t(`gallery.${entry.type}.label`)}
                  description={entry.type}
                  variant={active ? "filled" : "subtle"}
                />
              );
            })}
          </Stack>
        ) : null}
      </Stack>
    </ScrollArea>
  );
}

import { Box, Code, Stack, Text } from "@mantine/core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import {
  DOCS_SCREENSHOTS,
  type DocsScreenshotId,
  screenshotFilename,
  screenshotPublicPath,
  screenshotRepoPath,
} from "@/lib/docs/screenshots";
import { isAppLocale, messageFallbackLocale } from "@/i18n/config";

import classes from "./docsFigure.module.css";

function resolvePublicFile(publicPath: string): string | null {
  // publicPath is like `/docs/en/foo.webp`
  const relative = publicPath.replace(/^\//, "");
  // Next may be started from the app dir or the monorepo root.
  const candidates = [
    join(process.cwd(), "public", relative),
    join(process.cwd(), "apps/web/public", relative),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Renders a docs screenshot when the `.webp` is present under `public/`,
 * otherwise a text placeholder that names the expected file (and path).
 * Localized shots fall back to the English file when the active locale is missing.
 */
export async function DocsFigure({ id }: { id: DocsScreenshotId }) {
  const t = await getTranslations("docs.figure");
  const tShot = await getTranslations("docs.screenshots");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : messageFallbackLocale;
  const meta = DOCS_SCREENSHOTS[id];
  const filename = screenshotFilename(id);

  let publicPath = screenshotPublicPath(id, locale);
  let usedFallback = false;

  if (
    !resolvePublicFile(publicPath) &&
    meta.localized &&
    locale !== messageFallbackLocale
  ) {
    const enPath = screenshotPublicPath(id, messageFallbackLocale);
    if (resolvePublicFile(enPath)) {
      publicPath = enPath;
      usedFallback = true;
    }
  }

  const hasImage = Boolean(resolvePublicFile(publicPath));
  const dropPath = meta.localized
    ? screenshotRepoPath(id, locale)
    : screenshotRepoPath(id, "shared");

  return (
    <figure className={classes.figure}>
      {hasImage ? (
        <Box className={classes.frame}>
          <Image
            src={publicPath}
            alt={tShot(`${id}.alt`)}
            width={1440}
            height={900}
            className={classes.image}
            sizes="(max-width: 720px) 100vw, 720px"
            // Docs screenshots are replaced in place during authoring; skip the
            // optimizer cache so locale swaps always show the on-disk file.
            unoptimized
          />
        </Box>
      ) : (
        <Box className={classes.placeholder} role="img" aria-label={filename}>
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {t("placeholder", { filename })}
            </Text>
            <Text size="xs" c="dimmed">
              {t("pathHint", { path: dropPath })}
            </Text>
            <Code>{filename}</Code>
          </Stack>
        </Box>
      )}
      <figcaption className={classes.caption}>
        <Text size="sm" c="dimmed">
          {tShot(`${id}.caption`)}
          {usedFallback ? ` ${t("englishFallback")}` : null}
        </Text>
      </figcaption>
    </figure>
  );
}

"use client";

import {
  Anchor,
  type AnchorProps,
  Button,
  type ButtonProps,
} from "@mantine/core";
import Link from "next/link";
import type { ReactNode } from "react";

interface WithHref {
  href: string;
  children?: ReactNode;
}

/**
 * Mantine components are Client Components, so `component={Link}` (a function)
 * cannot be passed to them from a Server Component. These thin client wrappers
 * keep that polymorphic prop on the client side so Server Components can still
 * render Mantine-styled Next.js links. See AGENTS.md.
 */
export function LinkButton({ href, children, ...props }: ButtonProps & WithHref) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}

export function LinkAnchor({ href, children, ...props }: AnchorProps & WithHref) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  );
}

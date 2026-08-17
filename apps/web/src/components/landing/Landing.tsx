"use client";

import {
  Accordion,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { BrandIcon } from "@/components/brand/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BRAND } from "@/lib/brand";

import { HeadingMark, WorkflowDiagram } from "./decor";
import {
  ArrowRightIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  SampleIcon,
} from "./icons";
import { LabHeroArt } from "./LabHeroArt";
import classes from "./landing.module.css";
import type { OfferSample } from "@/lib/landing/offer";

export type { OfferSample } from "@/lib/landing/offer";

const NAV_LINKS = [
  { id: "offer", key: "labOffer" },
  { id: "certifications", key: "certifications" },
  { id: "about", key: "about" },
  { id: "contact", key: "contact" },
] as const;

const CERTIFICATION_KEYS = [
  "iso17025",
  "iso9001",
  "iso17043",
  "glp",
  "haccp",
  "iso14001",
] as const;

function ShieldIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToTop() {
  // Brand targets document top — not `#top` on <main>, which sits below the
  // sticky header and leaves ~64px of scroll remaining.
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "instant" : "smooth",
  });
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "instant" : "smooth",
    block: "start",
  });
}

export function Landing({
  workspaceHref,
  offer,
}: {
  workspaceHref: string | null;
  offer: OfferSample[] | null;
}) {
  const t = useTranslations("landing");
  const ctaHref = workspaceHref ?? "/login";
  const ctaLabel = workspaceHref
    ? t("nav.goToWorkspace")
    : t("nav.getStarted");

  const sampleCount = offer?.length ?? 0;
  const methodCount =
    offer?.reduce((sum, s) => sum + s.experiments.length, 0) ?? 0;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerInner}>
          <a
            href="#top"
            className={classes.brand}
            onClick={(e) => {
              e.preventDefault();
              scrollToTop();
            }}
          >
            <BrandIcon size={22} className={classes.brandIcon} />
            <span className={classes.brandLabel}>{BRAND.name}</span>
            <span className={classes.brandTag}>{BRAND.tagline}</span>
          </a>

          <nav className={classes.nav} aria-label={t("nav.primaryAriaLabel")}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={classes.navLink}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId(link.id);
                }}
              >
                {t(`nav.${link.key}`)}
              </a>
            ))}
          </nav>

          <Group gap="sm" wrap="nowrap">
            <LanguageSwitcher />
            {!workspaceHref && (
              <Anchor
                component={Link}
                href="/login"
                c="dimmed"
                fw={500}
                fz="sm"
                className={classes.signIn}
              >
                {t("nav.signIn")}
              </Anchor>
            )}
            <Button
              component={Link}
              href={ctaHref}
              color="green"
              radius="sm"
            >
              {ctaLabel}
            </Button>
          </Group>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className={classes.hero}>
          <Container size="xl" className={classes.heroInner}>
            <div className={classes.heroCopy}>
              <span className={classes.eyebrow}>{t("hero.eyebrow")}</span>
              <Title order={1} className={classes.heroTitle}>
                {t("hero.title")}
              </Title>
              <Text className={classes.heroLead}>
                {t("hero.lead", { brand: BRAND.name })}
              </Text>
              <Group gap="md" mt="lg">
                <Button
                  component={Link}
                  href={ctaHref}
                  color="green"
                  size="md"
                  radius="sm"
                >
                  {ctaLabel}
                </Button>
                <Button
                  variant="default"
                  size="md"
                  radius="sm"
                  onClick={() => scrollToId("offer")}
                >
                  {t("hero.exploreOffer")}
                </Button>
              </Group>
              <Group gap="lg" mt="xl" className={classes.heroTrust}>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>
                    {t("hero.accreditedLabel")}
                  </strong>{" "}
                  {t("hero.accredited")}
                </Text>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>{sampleCount}</strong>{" "}
                  {t("hero.specimenTypes")}
                </Text>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>{methodCount}</strong>{" "}
                  {t("hero.testMethods")}
                </Text>
              </Group>
            </div>
            <LabHeroArt />
          </Container>
        </section>

        {/* Laboratory offer */}
        <section id="offer" className={classes.section}>
          <Container size="xl">
            <SectionHeading
              step={0}
              kicker={t("offer.kicker")}
              title={t("offer.title")}
              lead={t("offer.lead")}
            />

            {offer === null ? (
              <Box className={classes.fallback}>
                <Text fw={600}>{t("offer.fallbackTitle")}</Text>
                <Text c="dimmed" fz="sm">
                  {t("offer.fallbackBody")}
                </Text>
              </Box>
            ) : (
              <Accordion
                variant="separated"
                radius="md"
                chevronPosition="right"
                className={classes.offer}
                classNames={{
                  item: classes.offerItem,
                  control: classes.offerControl,
                }}
              >
                {offer.map((sample) => (
                  <Accordion.Item key={sample.id} value={sample.id}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap" pr="md">
                        <Group gap="md" wrap="nowrap">
                          <ThemeIcon
                            variant="light"
                            color="green"
                            radius="md"
                            size={44}
                            className={classes.offerIcon}
                          >
                            <SampleIcon sampleId={sample.id} size={24} />
                          </ThemeIcon>
                          <div>
                            <Text fw={600} className={classes.offerName}>
                              {sample.name}
                            </Text>
                            {sample.description && (
                              <Text fz="sm" c="dimmed" lineClamp={1}>
                                {sample.description}
                              </Text>
                            )}
                          </div>
                        </Group>
                        <Badge
                          variant="light"
                          color="green"
                          radius="sm"
                          className={classes.offerCount}
                        >
                          {t("offer.methodCount", {
                            count: sample.experiments.length,
                          })}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {sample.experiments.length === 0 ? (
                        <Text fz="sm" c="dimmed">
                          {t("offer.methodsBeingAdded")}
                        </Text>
                      ) : (
                        <Stack gap="xs">
                          {sample.experiments.map((exp) => (
                            <div key={exp.id} className={classes.method}>
                              <Group gap="xs" wrap="nowrap" align="flex-start">
                                <span className={classes.methodDot} aria-hidden />
                                <div>
                                  <Text fw={500} fz="sm">
                                    {exp.name}
                                  </Text>
                                  {exp.description && (
                                    <Text fz="sm" c="dimmed">
                                      {exp.description}
                                    </Text>
                                  )}
                                </div>
                              </Group>
                            </div>
                          ))}
                          <Anchor
                            component={Link}
                            href={ctaHref}
                            fz="sm"
                            fw={600}
                            c="green.8"
                            mt={4}
                          >
                            <Group gap={6} wrap="nowrap" component="span">
                              {t("offer.requestThisExperiment")}
                              <ArrowRightIcon size={16} />
                            </Group>
                          </Anchor>
                        </Stack>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Container>
        </section>

        {/* How it works */}
        <section className={`${classes.sectionMuted} ${classes.hexBg}`}>
          <Container size="xl">
            <SectionHeading
              step={1}
              kicker={t("howItWorks.kicker")}
              title={t("howItWorks.title")}
              lead={t("howItWorks.lead")}
            />
            <WorkflowDiagram />
          </Container>
        </section>

        {/* Certifications */}
        <section id="certifications" className={classes.section}>
          <Container size="xl">
            <SectionHeading
              step={2}
              kicker={t("certifications.kicker")}
              title={t("certifications.title")}
              lead={t("certifications.lead")}
            />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {CERTIFICATION_KEYS.map((key) => (
                <div key={key} className={classes.certCard}>
                  <Group gap="sm" wrap="nowrap" mb="xs">
                    <ThemeIcon
                      variant="light"
                      color="green"
                      radius="md"
                      size={38}
                    >
                      <ShieldIcon />
                    </ThemeIcon>
                    <div>
                      <Text fw={700} className={classes.certCode}>
                        {t(`certifications.items.${key}.code`)}
                      </Text>
                      <Text fz="xs" c="dimmed" tt="uppercase" fw={600}>
                        {t(`certifications.items.${key}.title`)}
                      </Text>
                    </div>
                  </Group>
                  <Text fz="sm" c="dimmed">
                    {t(`certifications.items.${key}.description`)}
                  </Text>
                </div>
              ))}
            </SimpleGrid>
          </Container>
        </section>

        {/* About */}
        <section id="about" className={`${classes.sectionMuted} ${classes.hexBg}`}>
          <Container size="xl">
            <div className={classes.about}>
              <div className={classes.aboutCopy}>
                <SectionHeading
                  step={3}
                  kicker={t("about.kicker")}
                  title={t("about.title")}
                  lead={t("about.lead", { brand: BRAND.name })}
                  align="left"
                />
                <Text c="dimmed" mt="md">
                  {t("about.body")}
                </Text>
              </div>
              <div className={classes.statGrid}>
                <Stat value={`${sampleCount}`} label={t("about.statSpecimenTypes")} />
                <Stat value={`${methodCount}`} label={t("about.statAccreditedMethods")} />
                <Stat
                  value={t("about.statActiveAccreditationsValue")}
                  label={t("about.statActiveAccreditations")}
                />
                <Stat
                  value={t("about.statSampleIntakeValue")}
                  label={t("about.statSampleIntake")}
                />
              </div>
            </div>
          </Container>
        </section>

        {/* Contact */}
        <section id="contact" className={classes.section}>
          <Container size="xl">
            <div className={classes.contact}>
              <div>
                <SectionHeading
                  step={4}
                  kicker={t("contact.kicker")}
                  title={t("contact.title")}
                  lead={t("contact.lead")}
                  align="left"
                />
                <Button
                  component={Link}
                  href={ctaHref}
                  color="green"
                  size="md"
                  radius="sm"
                  mt="md"
                >
                  {ctaLabel}
                </Button>
              </div>
              <div className={classes.contactDetails}>
                <ContactRow
                  icon={<MailIcon />}
                  label={t("contact.email")}
                  value={BRAND.email}
                  href={`mailto:${BRAND.email}`}
                />
                <ContactRow
                  icon={<PhoneIcon />}
                  label={t("contact.phone")}
                  value={t("contact.phoneValue")}
                  href="tel:+48537848861"
                />
                <ContactRow
                  icon={<PinIcon />}
                  label={t("contact.laboratory")}
                  value={t("contact.laboratoryValue")}
                />
                <ContactRow
                  icon={<ClockIcon />}
                  label={t("contact.hours")}
                  value={t("contact.hoursValue")}
                />
              </div>
            </div>
          </Container>
        </section>
      </main>

      <footer className={classes.footer}>
        <Container size="xl">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="xs">
              <BrandIcon size={18} className={classes.brandIcon} />
              <Text fw={700} fz="sm">
                {BRAND.name}
              </Text>
            </Group>
            <Text fz="xs" c="dimmed">
              {t("footer.rights", {
                year: new Date().getFullYear(),
                legalName: BRAND.legalName,
              })}
            </Text>
          </Group>
        </Container>
      </footer>
    </div>
  );
}

const TOTAL_STEPS = 5;

function SectionHeading({
  kicker,
  title,
  lead,
  align = "center",
  step,
}: {
  kicker: string;
  title: string;
  lead?: string;
  align?: "center" | "left";
  step: number;
}) {
  return (
    <div
      className={classes.sectionHeading}
      data-align={align}
    >
      <HeadingMark className={classes.headingMark} active={step} total={TOTAL_STEPS} />
      <span className={classes.eyebrow}>{kicker}</span>
      <Title order={2} className={classes.sectionTitle}>
        {title}
      </Title>
      {lead && (
        <Text c="dimmed" className={classes.sectionLead}>
          {lead}
        </Text>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={classes.stat}>
      <Text className={classes.statValue}>{value}</Text>
      <Text fz="sm" c="dimmed">
        {label}
      </Text>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className={classes.contactRow}>
      <ThemeIcon variant="light" color="green" radius="md" size={38}>
        {icon}
      </ThemeIcon>
      <div>
        <Text fz="xs" tt="uppercase" fw={600} c="dimmed" className={classes.contactLabel}>
          {label}
        </Text>
        {href ? (
          <Anchor href={href} c="dark" fw={500}>
            {value}
          </Anchor>
        ) : (
          <Text fw={500}>{value}</Text>
        )}
      </div>
    </div>
  );
}

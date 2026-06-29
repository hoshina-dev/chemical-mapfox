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
import Link from "next/link";

import { ChemFoxIcon } from "@/components/brand/ChemFoxMark";

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
  { id: "offer", label: "Laboratory offer" },
  { id: "certifications", label: "Certifications" },
  { id: "about", label: "About us" },
  { id: "contact", label: "Contact" },
];

interface Certification {
  code: string;
  title: string;
  description: string;
}

const CERTIFICATIONS: Certification[] = [
  {
    code: "ISO/IEC 17025",
    title: "Testing competence",
    description:
      "Accredited for the general competence to carry out tests and calibrations, including sampling.",
  },
  {
    code: "ISO 9001",
    title: "Quality management",
    description:
      "Certified quality management system covering every step from intake to reporting.",
  },
  {
    code: "ISO 17043",
    title: "Proficiency testing",
    description:
      "Authorised provider of proficiency testing and inter-laboratory comparison schemes.",
  },
  {
    code: "GLP",
    title: "Good Laboratory Practice",
    description:
      "Compliant with GLP principles for the integrity and traceability of study data.",
  },
  {
    code: "HACCP",
    title: "Food safety",
    description:
      "Hazard analysis and critical control points applied across food and feed testing.",
  },
  {
    code: "ISO 14001",
    title: "Environmental management",
    description:
      "Environmental management system governing safe handling and disposal of reagents.",
  },
];

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

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Landing({
  workspaceHref,
  offer,
}: {
  workspaceHref: string | null;
  offer: OfferSample[] | null;
}) {
  const ctaHref = workspaceHref ?? "/login";
  const ctaLabel = workspaceHref ? "Go to your workspace" : "Get started";

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
              scrollToId("top");
            }}
          >
            <ChemFoxIcon size={22} className={classes.brandIcon} />
            <span className={classes.brandLabel}>ChemFox</span>
            <span className={classes.brandTag}>Laboratory Services</span>
          </a>

          <nav className={classes.nav} aria-label="Primary">
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
                {link.label}
              </a>
            ))}
          </nav>

          <Group gap="sm" wrap="nowrap">
            {!workspaceHref && (
              <Anchor
                component={Link}
                href="/login"
                c="dimmed"
                fw={500}
                fz="sm"
                className={classes.signIn}
              >
                Sign in
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
              <span className={classes.eyebrow}>Accredited laboratory services</span>
              <Title order={1} className={classes.heroTitle}>
                Chemical experiments, from request to certified results.
              </Title>
              <Text className={classes.heroLead}>
                ChemFox runs your samples through an accredited workflow — intake,
                lab execution and reporting in one place. Track every specimen,
                see exactly where it is, and receive results you can trust.
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
                  Explore our offer
                </Button>
              </Group>
              <Group gap="lg" mt="xl" className={classes.heroTrust}>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>ISO/IEC 17025</strong>{" "}
                  accredited
                </Text>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>{sampleCount}</strong>{" "}
                  specimen types
                </Text>
                <Text fz="sm" c="dimmed">
                  <strong className={classes.trustNum}>{methodCount}</strong>{" "}
                  test methods
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
              kicker="Laboratory offer"
              title="What we test"
              lead="Browse the specimens our labs support. Open any one to see the individual test methods available for it."
            />

            {offer === null ? (
              <Box className={classes.fallback}>
                <Text fw={600}>Our offer is being updated</Text>
                <Text c="dimmed" fz="sm">
                  The catalogue is briefly unavailable. Please check back shortly
                  or get in touch and we&apos;ll walk you through what we test.
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
                          {sample.experiments.length}{" "}
                          {sample.experiments.length === 1 ? "method" : "methods"}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {sample.experiments.length === 0 ? (
                        <Text fz="sm" c="dimmed">
                          Methods for this specimen are being added.
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
                              Request this experiment
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
              kicker="How it works"
              title="From request to certified results"
              lead="One accountable pipeline. You always know which stage your sample is in and what happens next."
            />
            <WorkflowDiagram />
          </Container>
        </section>

        {/* Certifications */}
        <section id="certifications" className={classes.section}>
          <Container size="xl">
            <SectionHeading
              step={2}
              kicker="Accreditations"
              title="Certifications & accreditations"
              lead="Our results carry recognised accreditation. Every method runs under a quality system audited against international standards."
            />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {CERTIFICATIONS.map((cert) => (
                <div key={cert.code} className={classes.certCard}>
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
                        {cert.code}
                      </Text>
                      <Text fz="xs" c="dimmed" tt="uppercase" fw={600}>
                        {cert.title}
                      </Text>
                    </div>
                  </Group>
                  <Text fz="sm" c="dimmed">
                    {cert.description}
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
                  kicker="About us"
                  title="A laboratory built around your samples"
                  lead="ChemFox brings together sample intake, collaborative lab execution and accredited reporting. Requesters always know where a specimen is; our technicians move work forward without fighting the tools."
                  align="left"
                />
                <Text c="dimmed" mt="md">
                  We pair experienced analysts with a modern workflow so that
                  every result is traceable, reproducible and delivered on time.
                  From a single water sample to a full production-hygiene
                  programme, the process is the same: clear, accountable and
                  quality-assured.
                </Text>
              </div>
              <div className={classes.statGrid}>
                <Stat value={`${sampleCount}`} label="Specimen types" />
                <Stat value={`${methodCount}`} label="Accredited methods" />
                <Stat value="6" label="Active accreditations" />
                <Stat value="24h" label="Sample intake" />
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
                  kicker="Contact"
                  title="Interested in our offer?"
                  lead="Get in touch today and let's start working together — or jump straight in and create your first request."
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
                  label="Email"
                  value="hello@chemfox.lab"
                  href="mailto:hello@chemfox.lab"
                />
                <ContactRow
                  icon={<PhoneIcon />}
                  label="Phone"
                  value="+48 22 000 00 00"
                  href="tel:+48220000000"
                />
                <ContactRow
                  icon={<PinIcon />}
                  label="Laboratory"
                  value="ul. Laboratoryjna 1, 00-001 Warszawa"
                />
                <ContactRow
                  icon={<ClockIcon />}
                  label="Hours"
                  value="Mon–Fri, 8:00–16:00"
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
              <ChemFoxIcon size={18} className={classes.brandIcon} />
              <Text fw={700} fz="sm">
                ChemFox
              </Text>
            </Group>
            <Text fz="xs" c="dimmed">
              © {new Date().getFullYear()} ChemFox Laboratory Services. All rights
              reserved.
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

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Demo content seed — development only.
 *
 * This is deliberately separate from `prisma/seed.ts`, which is wired to
 * `prisma db seed` and creates the two rows a real deployment genuinely needs
 * (the admin account and the site config). Mixing fabricated projects and
 * testimonials into that file would push fake content to production the first
 * time anyone ran a deploy seed.
 *
 * Run with: `npm run db:seed:demo`
 *
 * The script is idempotent. Every write is an upsert keyed on a natural unique
 * value, so running it twice does not duplicate anything, and it will not
 * overwrite the real site config.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Refuses to run against production.
 *
 * A demo seed pointed at a live database would publish fabricated projects and
 * fake testimonials under the site owner's name. The check is on `NODE_ENV`
 * because that is what the backend itself trusts to decide whether Swagger and
 * verbose errors are exposed.
 */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the demo seed with NODE_ENV=production. ' +
        'This script writes fabricated content and must never touch a live database.',
    );
  }
}

/** Builds a slug the same way ProjectsService does, so URLs match the API. */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** ISO date helper, so every date in this file reads unambiguously. */
function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Tech stacks
// ---------------------------------------------------------------------------

const TECH_STACKS = [
  { name: 'TypeScript', category: 'FRONTEND', order: 1 },
  { name: 'React', category: 'FRONTEND', order: 2 },
  { name: 'Next.js', category: 'FRONTEND', order: 3 },
  { name: 'Tailwind CSS', category: 'FRONTEND', order: 4 },
  { name: 'NestJS', category: 'BACKEND', order: 5 },
  { name: 'Node.js', category: 'BACKEND', order: 6 },
  { name: 'Fastify', category: 'BACKEND', order: 7 },
  { name: 'PostgreSQL', category: 'DATABASE', order: 8 },
  { name: 'Prisma', category: 'DATABASE', order: 9 },
  { name: 'Redis', category: 'DATABASE', order: 10 },
  { name: 'Docker', category: 'DEVOPS', order: 11 },
  { name: 'GitHub Actions', category: 'DEVOPS', order: 12 },
  { name: 'Terraform', category: 'DEVOPS', order: 13 },
  { name: 'React Native', category: 'MOBILE', order: 14 },
  { name: 'GraphQL', category: 'OTHER', order: 15 },
] as const;

/**
 * Seeds tech stacks and returns a name-to-id map for wiring relations.
 *
 * `TechStack.name` has no unique constraint in the schema, so `upsert` is not
 * available here — the script finds by name first and creates only when absent.
 */
async function seedTechStacks(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const tech of TECH_STACKS) {
    const existing = await prisma.techStack.findFirst({
      where: { name: tech.name },
    });

    const row = existing
      ? await prisma.techStack.update({
          where: { id: existing.id },
          data: { category: tech.category, order: tech.order },
        })
      : await prisma.techStack.create({ data: { ...tech } });

    ids.set(tech.name, row.id);
  }

  console.log(`  tech stacks: ${ids.size}`);
  return ids;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    title: 'Portfolio Platform',
    description:
      'A headless portfolio: NestJS API with RBAC and Cloudinary uploads, consumed by a Next.js front end.',
    longDesc:
      'Built to replace a static site that needed a redeploy for every content change. The API exposes ten resources behind a role-guarded admin surface, with rate limiting on every public write and refresh-token rotation on the auth layer. The front end renders as Server Components so the whole page is indexable without client-side hydration for content.',
    liveUrl: 'https://example.com/portfolio',
    repoUrl: 'https://github.com/averildwi/webportfolio',
    status: 'PUBLISHED',
    featured: true,
    order: 1,
    viewCount: 1284,
    likeCount: 47,
    tech: ['TypeScript', 'NestJS', 'Next.js', 'PostgreSQL', 'Prisma'],
  },
  {
    title: 'Ledger Sync Service',
    description:
      'Event-driven reconciliation between a payment provider and an internal ledger, with idempotent replay.',
    longDesc:
      'Webhooks arrive out of order and occasionally twice. This service assigns every event a deterministic key, persists it before processing, and reconciles against the provider on a schedule to catch anything dropped. Replaying a day of traffic produces the same ledger state, which made the migration off the legacy cron job verifiable rather than hopeful.',
    repoUrl: 'https://github.com/averildwi/ledger-sync',
    status: 'PUBLISHED',
    featured: true,
    order: 2,
    viewCount: 642,
    likeCount: 23,
    tech: ['NestJS', 'PostgreSQL', 'Redis', 'Docker'],
  },
  {
    title: 'Realtime Ops Dashboard',
    description:
      'Operational dashboard streaming deployment and error metrics over server-sent events.',
    longDesc:
      'Replaced a polling dashboard that hammered the metrics API every three seconds per open tab. Server-sent events cut request volume by two orders of magnitude and made the numbers actually current. Charts are virtualized so a thousand data points do not stall the main thread.',
    liveUrl: 'https://example.com/ops',
    status: 'PUBLISHED',
    featured: true,
    order: 3,
    viewCount: 918,
    likeCount: 31,
    tech: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js'],
  },
  {
    title: 'Schema Migration Toolkit',
    description:
      'CLI that diffs Prisma schemas across branches and flags destructive migrations before review.',
    longDesc:
      'A dropped column made it to staging because the migration diff was buried in a large pull request. This tool parses both schema versions, classifies each change by blast radius, and fails CI on anything destructive unless the change is explicitly acknowledged.',
    repoUrl: 'https://github.com/averildwi/schema-toolkit',
    status: 'PUBLISHED',
    featured: false,
    order: 4,
    viewCount: 377,
    likeCount: 14,
    tech: ['TypeScript', 'Prisma', 'GitHub Actions'],
  },
  {
    title: 'Field Report Mobile App',
    description:
      'Offline-first data collection app that queues submissions and syncs when connectivity returns.',
    longDesc:
      'Field teams work where there is no signal. Submissions are written to a local queue with conflict metadata, then reconciled server-side on reconnect using last-write-wins per field rather than per record, so two people editing different fields do not clobber each other.',
    status: 'PUBLISHED',
    featured: false,
    order: 5,
    viewCount: 289,
    likeCount: 9,
    tech: ['React Native', 'TypeScript', 'GraphQL'],
  },
  {
    title: 'Infrastructure Baseline',
    description:
      'Terraform modules for a reproducible staging environment, provisioned from scratch in under ten minutes.',
    status: 'DRAFT',
    featured: false,
    order: 6,
    tech: ['Terraform', 'Docker', 'GitHub Actions'],
  },
] as const;

/**
 * Seeds projects and their tech relations.
 *
 * One project is left as `DRAFT` on purpose: it exercises the public
 * endpoints' status filter, so a regression that leaks unpublished work shows
 * up immediately in the UI rather than in production.
 */
async function seedProjects(techIds: Map<string, string>): Promise<void> {
  for (const project of PROJECTS) {
    const { tech, ...fields } = project;
    const slug = toSlug(project.title);

    const row = await prisma.project.upsert({
      where: { slug },
      update: { ...fields, slug },
      create: { ...fields, slug },
    });

    // Relations are replaced rather than merged, matching how the API's update
    // path behaves — so re-running produces exactly the listed set.
    await prisma.projectTech.deleteMany({ where: { projectId: row.id } });
    await prisma.projectTech.createMany({
      data: tech
        .map((name) => techIds.get(name))
        .filter((id): id is string => Boolean(id))
        .map((techStackId) => ({ projectId: row.id, techStackId })),
    });
  }

  console.log(`  projects: ${PROJECTS.length} (1 draft, for status filtering)`);
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

const EXPERIENCES = [
  {
    company: 'Northwind Systems',
    role: 'Backend Engineer',
    description:
      'Own the billing and reconciliation services. Cut p99 latency on the invoice endpoint from 2.4s to 180ms by replacing an N+1 query pattern with a single aggregate, and introduced contract tests between the billing service and its three consumers.',
    startDate: date('2024-03-01'),
    // null endDate marks the current role — the UI renders "Present".
    endDate: null,
    order: 1,
    tech: ['NestJS', 'PostgreSQL', 'Redis', 'Docker'],
  },
  {
    company: 'Cartograph Labs',
    role: 'Fullstack Developer',
    description:
      'Built the customer-facing analytics surface and the API behind it. Migrated the front end from a client-rendered SPA to Server Components, which removed a 400KB bundle from the critical path and made the pages indexable.',
    startDate: date('2022-08-01'),
    endDate: date('2024-02-29'),
    order: 2,
    tech: ['React', 'Next.js', 'TypeScript', 'Node.js'],
  },
  {
    company: 'Freelance',
    role: 'Web Developer',
    description:
      'Delivered small business sites and internal tools end to end, from requirements through deployment and handover documentation.',
    startDate: date('2021-06-01'),
    endDate: date('2022-07-31'),
    order: 3,
    tech: ['TypeScript', 'React', 'PostgreSQL'],
  },
] as const;

async function seedExperiences(techIds: Map<string, string>): Promise<void> {
  for (const experience of EXPERIENCES) {
    const { tech, ...fields } = experience;

    // No unique constraint on Experience, so match on the company/role pair.
    const existing = await prisma.experience.findFirst({
      where: { company: experience.company, role: experience.role },
    });

    const row = existing
      ? await prisma.experience.update({
          where: { id: existing.id },
          data: fields,
        })
      : await prisma.experience.create({ data: fields });

    await prisma.experienceTech.deleteMany({ where: { experienceId: row.id } });
    await prisma.experienceTech.createMany({
      data: tech
        .map((name) => techIds.get(name))
        .filter((id): id is string => Boolean(id))
        .map((techStackId) => ({ experienceId: row.id, techStackId })),
    });
  }

  console.log(`  experiences: ${EXPERIENCES.length} (1 current, endDate null)`);
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const EDUCATIONS = [
  {
    institution: 'Universitas Brawijaya',
    degree: 'Bachelor of Computer Science',
    fieldOfStudy: 'Informatics Engineering',
    description:
      'Focused on distributed systems and databases. Final project implemented a consensus-backed key-value store to study partition behaviour under induced network faults.',
    startDate: date('2021-08-01'),
    endDate: date('2025-07-31'),
    order: 1,
  },
] as const;

async function seedEducations(): Promise<void> {
  for (const education of EDUCATIONS) {
    const existing = await prisma.education.findFirst({
      where: {
        institution: education.institution,
        degree: education.degree,
      },
    });

    if (existing) {
      await prisma.education.update({
        where: { id: existing.id },
        data: education,
      });
    } else {
      await prisma.education.create({ data: education });
    }
  }

  console.log(`  educations: ${EDUCATIONS.length}`);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

const ACHIEVEMENTS = [
  {
    title: 'AWS Certified Solutions Architect — Associate',
    issuer: 'Amazon Web Services',
    description:
      'Validated on designing distributed systems with an emphasis on cost, resilience, and recovery objectives.',
    date: date('2025-04-18'),
    featured: true,
    order: 1,
  },
  {
    title: 'National Informatics Competition — Finalist',
    issuer: 'Ministry of Education',
    description:
      'Top eight of over four hundred teams. Built a scheduling optimizer under a six-hour constraint.',
    date: date('2024-09-12'),
    featured: true,
    order: 2,
  },
  {
    title: 'Open Source Contributor — Prisma',
    issuer: 'Prisma',
    description:
      'Contributed a fix to connection-pool exhaustion under driver adapters, plus documentation for the affected path.',
    date: date('2025-01-30'),
    featured: false,
    order: 3,
  },
] as const;

async function seedAchievements(): Promise<void> {
  for (const achievement of ACHIEVEMENTS) {
    const existing = await prisma.achievement.findFirst({
      where: { title: achievement.title },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: achievement,
      });
    } else {
      await prisma.achievement.create({ data: achievement });
    }
  }

  console.log(`  achievements: ${ACHIEVEMENTS.length}`);
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

const TESTIMONIALS = [
  {
    name: 'Rina Hartono',
    role: 'Engineering Manager',
    company: 'Northwind Systems',
    message:
      'Took ownership of the billing service when it was the least understood part of our stack and left it as the best documented. The kind of engineer who fixes the cause rather than the symptom.',
    featured: true,
    order: 1,
  },
  {
    name: 'Daniel Wu',
    role: 'Product Lead',
    company: 'Cartograph Labs',
    message:
      'Pushed back on a spec I had written badly, explained precisely why it would not hold up, and proposed something better. Rare and valuable.',
    featured: true,
    order: 2,
  },
  {
    name: 'Siti Nurhaliza',
    role: 'Founder',
    company: 'Tunas Digital',
    message:
      'Delivered on schedule and handed over documentation clear enough that our own team could extend the work without asking questions.',
    featured: false,
    order: 3,
  },
] as const;

async function seedTestimonials(): Promise<void> {
  for (const testimonial of TESTIMONIALS) {
    const existing = await prisma.testimonial.findFirst({
      where: { name: testimonial.name, company: testimonial.company },
    });

    if (existing) {
      await prisma.testimonial.update({
        where: { id: existing.id },
        data: testimonial,
      });
    } else {
      await prisma.testimonial.create({ data: testimonial });
    }
  }

  console.log(`  testimonials: ${TESTIMONIALS.length}`);
}

// ---------------------------------------------------------------------------
// Guestbook (visitors + entries)
// ---------------------------------------------------------------------------

const VISITORS = [
  {
    provider: 'GITHUB',
    providerId: 'demo-gh-11111',
    name: 'Arya Pratama',
    email: 'arya@example.com',
    avatarUrl: null,
    entries: [
      {
        message:
          'Found the ledger sync writeup through a search and it saved me a day of debugging. Thanks for documenting the replay design.',
        status: 'APPROVED',
      },
    ],
  },
  {
    provider: 'GOOGLE',
    providerId: 'demo-goog-22222',
    name: 'Maya Kusuma',
    email: 'maya@example.com',
    avatarUrl: null,
    entries: [
      {
        message:
          'The Server Components migration notes were the clearest explanation of the tradeoffs I have read. Bookmarked.',
        status: 'APPROVED',
      },
    ],
  },
  {
    provider: 'GITHUB',
    providerId: 'demo-gh-33333',
    name: 'Bagus Setiawan',
    email: null,
    avatarUrl: null,
    entries: [
      // Left PENDING so moderation and the public status filter are testable.
      {
        message: 'Awaiting moderation — this entry should not appear publicly.',
        status: 'PENDING',
      },
    ],
  },
] as const;

async function seedGuestbook(): Promise<void> {
  let entryCount = 0;

  for (const visitor of VISITORS) {
    const { entries, ...fields } = visitor;

    const row = await prisma.visitor.upsert({
      where: {
        provider_providerId: {
          provider: visitor.provider,
          providerId: visitor.providerId,
        },
      },
      update: fields,
      create: fields,
    });

    // Guestbook has no natural unique key, so clear this visitor's entries and
    // recreate them to stay idempotent.
    await prisma.guestbook.deleteMany({ where: { visitorId: row.id } });
    for (const entry of entries) {
      await prisma.guestbook.create({
        data: { visitorId: row.id, ...entry },
      });
      entryCount += 1;
    }
  }

  console.log(
    `  visitors: ${VISITORS.length}, guestbook entries: ${entryCount} (1 pending)`,
  );
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

const CONTACTS = [
  {
    name: 'Hendra Wijaya',
    email: 'hendra@example.com',
    company: 'Meridian Retail',
    subject: 'Backend consulting for Q1',
    message:
      'We are replacing a monolith and want a second opinion on the service boundaries before committing. Are you available for a short engagement?',
    status: 'UNREAD',
  },
  {
    name: 'Clara Tan',
    email: 'clara@example.com',
    company: null,
    subject: 'Question about the ledger sync post',
    message:
      'How do you handle a provider that replays a webhook with a different payload for the same event id?',
    status: 'READ',
    readAt: date('2026-09-10'),
  },
] as const;

/**
 * Seeds contact submissions so the admin inbox has content to moderate.
 *
 * Statuses vary deliberately: an admin list filtered to UNREAD should return
 * exactly one of these.
 */
async function seedContacts(): Promise<void> {
  for (const contact of CONTACTS) {
    const existing = await prisma.contactForm.findFirst({
      where: { email: contact.email, subject: contact.subject },
    });

    if (existing) {
      await prisma.contactForm.update({
        where: { id: existing.id },
        data: contact,
      });
    } else {
      await prisma.contactForm.create({ data: contact });
    }
  }

  console.log(`  contact messages: ${CONTACTS.length} (1 unread, 1 read)`);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  assertNotProduction();

  console.log('Seeding demo content...');

  // Tech stacks first: projects and experiences reference their ids.
  const techIds = await seedTechStacks();

  await seedProjects(techIds);
  await seedExperiences(techIds);
  await seedEducations();
  await seedAchievements();
  await seedTestimonials();
  await seedGuestbook();
  await seedContacts();

  console.log('Demo content seeded. Re-running is safe and non-duplicating.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

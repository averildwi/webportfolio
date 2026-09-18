/**
 * Enums mirrored from `apps/backend/prisma/schema.prisma`.
 *
 * These are declared as const objects plus a derived union type rather than
 * TypeScript `enum`s: the values must serialize to the exact strings the API
 * expects, and a const object gives us both the runtime array (for building
 * filter UIs) and the literal union (for type checking) without the pitfalls
 * of `enum` under `isolatedModules`.
 *
 * If the Prisma schema changes, this file must change with it.
 */

export const TECH_CATEGORY = [
  "FRONTEND",
  "BACKEND",
  "DATABASE",
  "DEVOPS",
  "MOBILE",
  "OTHER",
] as const;
export type TechCategory = (typeof TECH_CATEGORY)[number];

export const PROJECT_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const DOC_TYPE = ["IMAGE", "PDF"] as const;
export type DocType = (typeof DOC_TYPE)[number];

export const AVAILABILITY_STATUS = [
  "OPEN_TO_WORK",
  "FREELANCE_ONLY",
  "NOT_AVAILABLE",
  "EMPLOYED",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUS)[number];

export const CONTACT_STATUS = ["UNREAD", "READ", "REPLIED"] as const;
export type ContactStatus = (typeof CONTACT_STATUS)[number];

export const GUESTBOOK_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export type GuestbookStatus = (typeof GUESTBOOK_STATUS)[number];

export const AUTH_PROVIDER = ["GOOGLE", "GITHUB"] as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[number];

export const TOKEN_OWNER = ["ADMIN", "VISITOR"] as const;
export type TokenOwner = (typeof TOKEN_OWNER)[number];

/** Roles carried in the JWT payload and enforced by the backend RolesGuard. */
export type AppRole = "ADMIN" | "VISITOR";

/** Human-readable labels for the availability badge. */
export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  OPEN_TO_WORK: "Open to work",
  FREELANCE_ONLY: "Freelance only",
  NOT_AVAILABLE: "Not available",
  EMPLOYED: "Employed",
};

/** Display labels for tech stack category filters. */
export const TECH_CATEGORY_LABEL: Record<TechCategory, string> = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  DATABASE: "Database",
  DEVOPS: "DevOps",
  MOBILE: "Mobile",
  OTHER: "Other",
};

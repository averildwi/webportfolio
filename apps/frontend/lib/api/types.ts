import type {
  AuthProvider,
  AvailabilityStatus,
  ContactStatus,
  DocType,
  GuestbookStatus,
  ProjectStatus,
  TechCategory,
} from "./enums";

/**
 * Resource types mirroring the backend's serialized responses.
 *
 * Two conventions apply throughout:
 *
 * 1. Every Prisma `DateTime` arrives as an ISO-8601 **string**, never a `Date`.
 *    Parsing is the caller's job, at the point of formatting.
 *
 * 2. Read endpoints return richer objects than write endpoints. The backend's
 *    `create`/`update` calls omit Prisma `include`s, so a POST response has no
 *    relations. Those are modelled as separate types (`Project` vs
 *    `ProjectListItem` vs `ProjectDetail`) instead of one optimistic interface
 *    with everything optional - that way the compiler stops us from reading
 *    `techStacks` off a create response, where it genuinely is not present.
 */

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

/** Wrapper applied by the backend's global TransformInterceptor. */
export interface StandardResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

/** Pagination metadata attached to list endpoints. */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends StandardResponse<T[]> {
  meta: PaginationMeta;
}

/** Shape produced by the backend's global exception filters. */
export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  data: null;
  error: string;
  timestamp: string;
}

/** A page of results, unwrapped from the envelope for ergonomic consumption. */
export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

/**
 * `page` is 1-indexed and `limit` is capped at 100 by the backend's
 * ValidationPipe. Sending a larger `limit` is a 400, not a silent clamp.
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface FeaturedPaginationQuery extends PaginationQuery {
  featured?: boolean;
}

// ---------------------------------------------------------------------------
// Site config
// ---------------------------------------------------------------------------

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  email?: string;
}

export interface SiteConfig {
  id: string;
  fullName: string;
  tagline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  resumeUrl: string | null;
  availabilityStatus: AvailabilityStatus;
  socialLinks: SocialLinks | null;
  updatedAt: string;
}

/** `avatarUrl` and `resumeUrl` are write-only through their upload endpoints. */
export interface UpdateSiteConfigInput {
  fullName?: string;
  tagline?: string;
  bio?: string;
  availabilityStatus?: AvailabilityStatus;
  socialLinks?: SocialLinks;
}

// ---------------------------------------------------------------------------
// Tech stack
// ---------------------------------------------------------------------------

export interface TechStack {
  id: string;
  name: string;
  iconUrl: string | null;
  category: TechCategory;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTechStackInput {
  name: string;
  category: TechCategory;
  order?: number;
}

export type UpdateTechStackInput = Partial<CreateTechStackInput>;

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export interface Experience {
  id: string;
  company: string;
  role: string;
  description: string | null;
  startDate: string;
  /** `null` means the position is current. */
  endDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Returned by the read endpoints, which flatten the ExperienceTech join. */
export interface ExperienceWithTech extends Experience {
  techStacks: TechStack[];
}

export interface CreateExperienceInput {
  company: string;
  role: string;
  description?: string;
  startDate: string;
  endDate?: string;
  /** Replaces the entire relation set; not a partial merge. */
  techStackIds?: string[];
  order?: number;
}

export interface UpdateExperienceInput {
  company?: string;
  role?: string;
  description?: string;
  startDate?: string;
  /**
   * Explicit `null` clears the end date, marking the role as current.
   * Omitting the key leaves the stored value untouched. The two are not
   * interchangeable.
   */
  endDate?: string | null;
  techStackIds?: string[];
  order?: number;
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEducationInput {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  description?: string;
  startDate: string;
  endDate?: string;
  order?: number;
}

export interface UpdateEducationInput {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  description?: string;
  startDate?: string;
  /** Explicit `null` means "still studying"; see UpdateExperienceInput. */
  endDate?: string | null;
  order?: number;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface ProjectDoc {
  id: string;
  projectId: string;
  title: string | null;
  url: string;
  type: DocType;
  order: number;
  createdAt: string;
}

/** Bare row, as returned by create/update/upload endpoints. */
export interface Project {
  id: string;
  title: string;
  /** Server-generated from the title at creation and immutable thereafter. */
  slug: string;
  description: string;
  longDesc: string | null;
  thumbnailUrl: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  status: ProjectStatus;
  featured: boolean;
  viewCount: number;
  likeCount: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** List endpoints include tech stacks but omit documentation. */
export interface ProjectListItem extends Project {
  techStacks: TechStack[];
}

/**
 * Detail endpoints add documentation and, for public requests, whether the
 * caller has already liked the project. `liked` is derived from a hash of the
 * request's IP and User-Agent, so it is absent when either is unavailable.
 */
export interface ProjectDetail extends ProjectListItem {
  docs: ProjectDoc[];
  liked?: boolean;
}

export interface ListProjectsQuery extends FeaturedPaginationQuery {
  /** Admin-only. Public listings are always filtered to PUBLISHED. */
  status?: ProjectStatus;
}

export interface CreateProjectInput {
  title: string;
  description: string;
  longDesc?: string;
  /** Validated with `@IsUrl()`; a bare hostname is rejected. */
  liveUrl?: string;
  repoUrl?: string;
  status?: ProjectStatus;
  featured?: boolean;
  techStackIds?: string[];
  order?: number;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

/** Raw (unwrapped) body of the like-toggle endpoint. */
export interface LikeToggleResult {
  liked: boolean;
  likeCount: number;
}

// ---------------------------------------------------------------------------
// Achievement
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  description: string | null;
  issuer: string | null;
  date: string;
  certificateUrl: string | null;
  featured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAchievementInput {
  title: string;
  description?: string;
  issuer?: string;
  /** Required, unlike most other date fields. */
  date: string;
  featured?: boolean;
  order?: number;
}

export type UpdateAchievementInput = Partial<CreateAchievementInput>;

// ---------------------------------------------------------------------------
// Testimonial
// ---------------------------------------------------------------------------

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  message: string;
  avatarUrl: string | null;
  featured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestimonialInput {
  name: string;
  role?: string;
  company?: string;
  message: string;
  featured?: boolean;
  order?: number;
}

export type UpdateTestimonialInput = Partial<CreateTestimonialInput>;

// ---------------------------------------------------------------------------
// Guestbook
// ---------------------------------------------------------------------------

/** Visitor fields exposed publicly; email and id are deliberately withheld. */
export interface GuestbookVisitor {
  name: string;
  avatarUrl: string | null;
  provider: AuthProvider;
}

/** Bare row, as returned by create/update. */
export interface Guestbook {
  id: string;
  visitorId: string;
  message: string;
  status: GuestbookStatus;
  createdAt: string;
}

/** Read endpoints include the authoring visitor. */
export interface GuestbookEntry extends Guestbook {
  visitor: GuestbookVisitor;
}

export interface CreateGuestbookInput {
  message: string;
}

export interface UpdateGuestbookStatusInput {
  status: GuestbookStatus;
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export interface ContactForm {
  id: string;
  name: string;
  email: string;
  company: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
  readAt: string | null;
}

export interface CreateContactInput {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
}

export interface UpdateContactStatusInput {
  status: ContactStatus;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AdminIdentity {
  id: string;
  email: string;
}

/** Raw (unwrapped) body of the login endpoint. */
export interface LoginResult {
  accessToken: string;
  admin: AdminIdentity;
}

/** Raw (unwrapped) body of the refresh and OAuth-exchange endpoints. */
export interface AccessTokenResult {
  accessToken: string;
}

export interface VisitorIdentity {
  id: string;
  provider: AuthProvider;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthIndicator = Record<
  string,
  { status: "up" | "down"; [key: string]: unknown }
>;

export interface HealthCheck {
  status: "ok" | "error" | "shutting_down";
  info?: HealthIndicator;
  error?: HealthIndicator;
  details: HealthIndicator;
}

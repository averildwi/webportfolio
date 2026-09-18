import { API_BASE_URL, DEFAULT_REVALIDATE_SECONDS } from "./config";
import type {
  ErrorResponse,
  Page,
  PaginatedResponse,
  StandardResponse,
} from "./types";

/**
 * Low-level HTTP client for the NestJS backend.
 *
 * Three behaviours of the backend drive this design:
 *
 * 1. Most responses are wrapped in `{ statusCode, message, data, timestamp }`,
 *    but the auth endpoints and the project like-toggle return their payload
 *    raw. A blanket "unwrap `.data`" would silently produce `undefined` for
 *    those, so unwrapping is explicit per call site (`request` vs `requestRaw`).
 *
 * 2. Validation failures come back as `message: string[]`, one entry per
 *    field. Those are preserved on the thrown error so forms can surface them
 *    per input rather than as one concatenated blob.
 *
 * 3. `forbidNonWhitelisted: true` means any extra property in a request body
 *    is a 400. Callers must send exactly the documented input shapes.
 */

/** Thrown for any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  /** Exception class name, or a Prisma error code such as `P2002`. */
  readonly code: string;
  /** Per-field validation messages, when the backend supplied several. */
  readonly issues: string[];

  constructor(status: number, message: string, code: string, issues: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** True when the failure is a missing or expired credential. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the caller is authenticated but lacks the required role. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** True when a rate limit was hit, so the UI can ask the user to wait. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Thrown when the request never reached the server. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Tidak dapat menghubungi server. Periksa koneksi kamu.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * Caching strategy for a request.
 *
 * - `revalidate`: cache and refresh in the background after N seconds.
 *   Only meaningful on the server; ignored in the browser.
 * - `no-store`: never cache. Required for anything user-specific or mutating.
 */
export type CachePolicy =
  | { kind: "revalidate"; seconds?: number; tags?: string[] }
  | { kind: "no-store" };

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Serialized as JSON. Mutually exclusive with `formData`. */
  body?: unknown;
  /** Sent as multipart. The browser sets the boundary, so we must not. */
  formData?: FormData;
  /** Appended as a query string; `undefined` and `null` entries are dropped. */
  query?: QueryParams;
  /** Bearer token for authenticated endpoints. */
  token?: string;
  /**
   * Whether to send cookies. Required for the refresh-token flow, since the
   * backend stores the refresh token in an httpOnly cookie scoped to
   * `/api/auth`.
   */
  credentials?: boolean;
  cache?: CachePolicy;
  signal?: AbortSignal;
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

/**
 * Builds a query string, omitting empty values.
 *
 * Empty strings are dropped alongside `undefined`/`null` because the backend's
 * boolean transformer treats `?featured=` as "no filter", and sending the bare
 * key is a needless difference from omitting it.
 */
function buildQueryString(query: QueryParams | undefined): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Normalizes the backend's error body into an `ApiError`.
 *
 * The body is read defensively: a 502 from a proxy or a crash before the
 * exception filter runs will not be JSON, and the resulting parse failure must
 * not mask the original status code.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: Partial<ErrorResponse> | null = null;

  try {
    payload = (await response.json()) as Partial<ErrorResponse>;
  } catch {
    // Non-JSON body; fall through to the status-derived message.
  }

  const rawMessage = payload?.message;
  const issues = Array.isArray(rawMessage) ? rawMessage : [];
  const message =
    issues[0] ??
    (typeof rawMessage === "string" ? rawMessage : null) ??
    `Permintaan gagal (${response.status})`;

  return new ApiError(
    response.status,
    message,
    payload?.error ?? response.statusText,
    issues,
  );
}

/** Translates a `CachePolicy` into fetch options. */
function cacheInit(policy: CachePolicy | undefined): RequestInit {
  // Default to no caching for mutations and unspecified requests: caching a
  // POST is never correct, and an accidental cache hit on user-specific data
  // is a privacy bug rather than a performance win.
  if (!policy || policy.kind === "no-store") {
    return { cache: "no-store" };
  }

  return {
    next: {
      revalidate: policy.seconds ?? DEFAULT_REVALIDATE_SECONDS,
      ...(policy.tags ? { tags: policy.tags } : {}),
    },
  } as RequestInit;
}

/**
 * Performs a request and returns the parsed body without unwrapping.
 *
 * Use this for the endpoints that bypass the backend's response interceptor:
 * `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/oauth/token`, and
 * `/projects/slug/:slug/like/toggle`.
 */
export async function requestRaw<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    formData,
    query,
    token,
    credentials = false,
    cache,
    signal,
  } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Content-Type is set only for JSON. For multipart the browser must generate
  // it so it can include the boundary parameter.
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method,
    headers,
    ...cacheInit(cache),
    ...(credentials ? { credentials: "include" as RequestCredentials } : {}),
    ...(signal ? { signal } : {}),
  };

  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}${path}${buildQueryString(query)}`,
      init,
    );
  } catch (cause) {
    // An aborted request is intentional (component unmount, newer keystroke),
    // so it must propagate untouched rather than surface as a network failure.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new NetworkError(cause);
  }

  if (!response.ok) throw await toApiError(response);

  // 204 has no body, and calling .json() on it throws.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * Performs a request against a wrapped endpoint and returns `data` directly.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const envelope = await requestRaw<StandardResponse<T>>(path, options);
  return envelope.data;
}

/**
 * Performs a request against a paginated endpoint.
 *
 * Returns both the items and the metadata, since callers almost always need
 * `totalPages` to render controls. Endpoints that are *not* paginated return a
 * bare array in `data` and must use `request<T[]>` instead - notably
 * `/tech-stacks`, `/experiences`, `/educations`, and `/testimonials`.
 */
export async function requestPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Page<T>> {
  const envelope = await requestRaw<PaginatedResponse<T>>(path, options);
  return { items: envelope.data, meta: envelope.meta };
}

/** Cache policy helper: revalidate on the standard interval. */
export const cached = (
  seconds = DEFAULT_REVALIDATE_SECONDS,
  tags?: string[],
): CachePolicy => ({ kind: "revalidate", seconds, ...(tags ? { tags } : {}) });

/** Cache policy helper: always hit the network. */
export const uncached: CachePolicy = { kind: "no-store" };

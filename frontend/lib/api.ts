export interface User {
  id: number;
  email: string;
  name: string | null;
  emailVerified: boolean;
  tier: string;
  membershipStartedAt: string | null;
  membershipExpiresAt: string | null;
  hasStripeCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  commonName: string;
  scientificName: string;
  score: number;
  edible: string;
  psychedelic: string;
  traits: string[];
  taxonomy: { genus: string; family: string; order: string };
  lookAlikes: (string | { name: string; slug: string; imageUrl: string; distinction: string })[];
  guideUrl: string | null;
  description: string;
  wikiUrl: string;
  representativeImage: string;
  whyMatch: string[];
  caution: string;
  gbifId: number | null;
}

export interface UploadGuidance {
  uploadedRoles: string[];
  missingRecommendedRoles: string[];
}

export interface ConsistencyCheck {
  likelyMixed: boolean;
  message: string;
  perPhoto: { photoNumber: number; topMatch: string; commonName: string; confidence: number }[];
}

export interface QuotaInfo {
  tier: string;
  used: number;
  limit: number | null;
  resetsAt?: string | null;
}

export interface IdentifyResult {
  matches: Match[];
  uploadGuidance: UploadGuidance;
  consistencyCheck: ConsistencyCheck | null;
  uploadId: string | null;
  quota_exceeded?: boolean;
  quota?: QuotaInfo;
}

export interface ImageMeta {
  filename: string;
  mimeType: string;
  size: number;
}

// Matches actual server response from listUserUploads in db.js
export interface UploadSummary {
  id: string;
  createdAt: string;
  imageCount: number;
  primaryMatch: string;
  primaryConfidence: number;
  mixedSpecies: boolean;
  consistencyMessage: string;
  userStory: string | null;
  coverImageUrl: string;
  coverFileName: string;
  previewImages: { id: number; role: string; filename: string; mimeType: string; previewUrl: string }[];
  topMatches: { rank: number; scientificName: string; commonName: string; confidence: number }[];
}

// Matches actual server response from getUserUploadDetail in db.js + server.js wrapper
export interface UploadDetail {
  id: string;
  createdAt: string;
  imageCount: number;
  primaryMatch: string;
  primaryConfidence: number;
  mixedSpecies: boolean;
  consistencyMessage: string;
  userStory: string | null;
  images: { id: number; role: string; filename: string; mimeType: string; bytes: number; createdAt: string; previewUrl: string }[];
  matches: Match[];
  uploadGuidance: UploadGuidance;
  consistencyCheck: ConsistencyCheck;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText, body);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Auth
export async function getMe(): Promise<{ user: User | null; isAdmin: boolean }> {
  return apiFetch<{ user: User | null; isAdmin: boolean }>("/api/auth/me");
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function getAuthConfig(): Promise<{ googleAuthEnabled: boolean }> {
  return apiFetch("/api/auth/config");
}

// Identify
export async function identify(
  images: string[],
  photoRoles: string[],
  imageMeta: ImageMeta[],
): Promise<IdentifyResult> {
  return apiFetch("/api/identify", {
    method: "POST",
    body: JSON.stringify({ images, photoRoles, imageMeta }),
  });
}

// Quota
export async function getQuota(): Promise<QuotaInfo> {
  return apiFetch("/api/quota");
}

// Uploads
export async function listUploads(limit = 20): Promise<UploadSummary[]> {
  const data = await apiFetch<{ uploads: UploadSummary[] }>(
    `/api/user/uploads?limit=${limit}`,
  );
  return data.uploads;
}

export async function submitFeedback(message: string, alsoEmail: boolean, email?: string): Promise<void> {
  await apiFetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ message, alsoEmail, email }),
  });
}

export async function saveStory(uploadId: string, story: string): Promise<void> {
  await apiFetch(`/api/user/uploads/${uploadId}/story`, {
    method: "PATCH",
    body: JSON.stringify({ story }),
  });
}

export async function getUploadDetail(
  uploadId: string,
): Promise<UploadDetail> {
  const data = await apiFetch<{ upload: UploadDetail }>(
    `/api/user/uploads/${uploadId}`,
  );
  return data.upload;
}

export async function createCheckoutSession(plan: "monthly" | "lifetime" = "monthly"): Promise<{ url: string }> {
  return apiFetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

export async function createPortalSession(): Promise<{ url: string }> {
  return apiFetch("/api/stripe/portal-session");
}

export async function cancelSubscription(): Promise<{ success: boolean; tier: string }> {
  return apiFetch("/api/stripe/cancel-subscription", { method: "POST" });
}

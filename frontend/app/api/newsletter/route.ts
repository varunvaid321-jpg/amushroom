// Cross-origin proxy for guide.orangutany.com newsletter form.
// Next.js rewrites in next.config.ts proxy /api/* to the backend, but rewrites
// don't forward CORS headers back to the browser. This route handler sits in
// front of the rewrite, handles CORS preflight (OPTIONS), and proxies POST
// with proper Access-Control-Allow-Origin so the guide site can call it.

const ALLOWED_ORIGIN = "https://guide.orangutany.com";
const BACKEND_URL = process.env.API_URL || "http://localhost:3001";
const MAX_BODY_BYTES = 4 * 1024; // match backend limit

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const headers = corsHeaders();

  // Guard against oversized payloads
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: "Request too large." },
      { status: 400, headers }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON." },
      { status: 400, headers }
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "Something went wrong." },
      { status: 502, headers }
    );
  }
}

const ALLOWED_ORIGIN = "https://guide.orangutany.com";
const BACKEND_URL = process.env.API_URL || "http://localhost:3001";

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
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/api/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status, headers });
  } catch {
    return Response.json(
      { error: "Something went wrong." },
      { status: 500, headers }
    );
  }
}

// Liveness probe for Railway (railway.toml healthcheckPath) and other
// orchestrators. The api app serves its own /health; the web app had none,
// so Railway web deploys failed their healthcheck.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}

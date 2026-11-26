import "server-only";

export function getServerApiBase() {
  return (
    process.env.API_BASE_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  );
}

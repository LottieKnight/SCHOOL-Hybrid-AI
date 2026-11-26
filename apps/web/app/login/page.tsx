import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const next = first(resolved.next);
  const ref = first(resolved.ref);

  const params = new URLSearchParams();
  if (next && next.startsWith("/")) params.set("next", next);
  if (ref) params.set("ref", ref);

  redirect(params.toString() ? `/auth?${params.toString()}` : "/auth");
}

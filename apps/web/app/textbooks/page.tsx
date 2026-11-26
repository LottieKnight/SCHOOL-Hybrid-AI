import { headers } from "next/headers";
import { BookstoreCatalogClient } from "@/components/bookstore/BookstoreCatalogClient";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";

export const dynamic = "force-dynamic";

export default async function TextbooksPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Textbooks"
        title="Institution-aware textbook shelves, without generic clutter."
        description="Browse your campus collection, universal resources, and open materials inside the same branded library shell."
      />
      <BookstoreCatalogClient
        mode="resource-library"
        defaultInstitution={
          institutionContext
            ? {
                id: institutionContext.id,
                name: institutionContext.name,
              }
            : null
        }
      />
    </div>
  );
}

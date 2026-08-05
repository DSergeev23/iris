import { PortalClient } from "@/features/portal/components/portal-client";
import { getPublishedPortal } from "@/features/portal/server/repository";

export const dynamic = "force-dynamic";

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const departments = await getPublishedPortal();
  const { department } = await searchParams;
  return <PortalClient departments={departments} initialSlug={department} />;
}

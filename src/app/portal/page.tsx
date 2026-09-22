import { PortalClient } from "@/features/portal/components/portal-client";
import { getPortalAddressStatus, getPublishedPortal } from "@/features/portal/server/repository";
import { logFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const { department } = await searchParams;
  try {
    const departments = await getPublishedPortal();
    const addressStatus = department && !departments.some((item) => item.slug === department)
      ? await getPortalAddressStatus(department)
      : undefined;
    return <PortalClient departments={departments} initialSlug={department} addressStatus={addressStatus} />;
  } catch (error) {
    logFailure("portal_content_load_failed", error);
    return <PortalClient departments={[]} loadError />;
  }
}

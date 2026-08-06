import { PublicationStatus } from "@prisma/client";
import { hasDatabaseConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { getS3ReadUrl } from "@/lib/s3";
import { demoDepartments } from "./demo-data";
import type { PortalDepartment } from "../types";

async function mapDepartment(item: Awaited<ReturnType<typeof getRawDepartment>>): Promise<PortalDepartment> {
  const [photoUrl, mediaUrls] = await Promise.all([
    item.head?.photoObjectKey ? getS3ReadUrl(item.head.photoObjectKey) : Promise.resolve(null),
    Promise.all(item.media.map((media) => getS3ReadUrl(media.storageObjectKey))),
  ]);
  return {
    id: item.id, slug: item.slug, name: item.name, intro: item.intro,
    head: item.head ? { name: [item.head.firstName, item.head.middleName, item.head.lastName].filter(Boolean).join(" "), role: item.head.roleTitle, biography: item.head.biography, photoUrl } : null,
    reference: item.reference ? { title: item.reference.title, description: item.reference.description } : null,
    facts: item.facts.map((fact) => ({ id: fact.id, iconKey: fact.iconKey, title: fact.title, body: fact.body })),
    media: item.media.map((media, index) => ({ id: media.id, title: media.title, description: media.description, kind: media.kind, mimeType: media.mimeType, url: mediaUrls[index] })),
    scenario: item.scenario ? {
      title: item.scenario.title, description: item.scenario.description, emergencyTitle: item.scenario.emergencyTitle, emergencyBody: item.scenario.emergencyBody,
      steps: item.scenario.steps.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        actions: step.actions.map((action) => ({
          id: action.id,
          title: action.title,
          body: action.body,
          actionLabel: action.actionLabel,
          kind: action.kind,
          targetStepId: action.targetStepId,
          targetMediaId: action.targetMediaId,
        })),
      })),
    } : null,
  };
}

async function getRawDepartment() {
  return db.department.findFirstOrThrow({
    include: {
      head: true, reference: true,
      facts: { orderBy: { sortOrder: "asc" } },
      media: { where: { status: PublicationStatus.PUBLISHED }, orderBy: { sortOrder: "asc" } },
      scenario: { where: { status: PublicationStatus.PUBLISHED }, include: { steps: { orderBy: { sortOrder: "asc" }, include: { actions: { orderBy: { sortOrder: "asc" } } } } } },
    },
  });
}

export async function getPublishedPortal() {
  if (!hasDatabaseConfig() && process.env.NODE_ENV !== "production") return demoDepartments;
  const departments = await db.department.findMany({
    where: { status: PublicationStatus.PUBLISHED },
    orderBy: { sortOrder: "asc" },
    include: {
      head: true, reference: true,
      facts: { orderBy: { sortOrder: "asc" } },
      media: { where: { status: PublicationStatus.PUBLISHED }, orderBy: { sortOrder: "asc" } },
      scenario: { where: { status: PublicationStatus.PUBLISHED }, include: { steps: { orderBy: { sortOrder: "asc" }, include: { actions: { orderBy: { sortOrder: "asc" } } } } } },
    },
  });
  return Promise.all(departments.map((item) => mapDepartment(item as Awaited<ReturnType<typeof getRawDepartment>>)));
}

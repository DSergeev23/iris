import { PublicationStatus } from "@prisma/client";
import { hasDatabaseConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { demoDepartments } from "./demo-data";
import type { PortalDepartment } from "../types";

function mapDepartment(item: Awaited<ReturnType<typeof getRawDepartment>>): PortalDepartment {
  return {
    id: item.id, slug: item.slug, name: item.name, intro: item.intro,
    head: item.head ? { name: [item.head.firstName, item.head.middleName, item.head.lastName].filter(Boolean).join(" "), role: item.head.roleTitle, biography: item.head.biography, photoObjectKey: item.head.photoObjectKey } : null,
    reference: item.reference ? { title: item.reference.title, description: item.reference.description } : null,
    facts: item.facts.map((fact) => ({ id: fact.id, iconKey: fact.iconKey, title: fact.title, body: fact.body })),
    media: item.media.map((media) => ({ id: media.id, title: media.title, description: media.description, kind: media.kind })),
    scenario: item.scenario ? {
      title: item.scenario.title, description: item.scenario.description, emergencyTitle: item.scenario.emergencyTitle, emergencyBody: item.scenario.emergencyBody,
      steps: item.scenario.steps.map((step) => ({ id: step.id, title: step.title, description: step.description, actions: step.actions.map((action) => ({ id: action.id, title: action.title, body: action.body, actionLabel: action.actionLabel, kind: action.kind })) })),
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
  return departments.map((item) => mapDepartment(item as Awaited<ReturnType<typeof getRawDepartment>>));
}

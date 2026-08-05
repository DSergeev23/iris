export type PortalDepartment = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  head: { name: string; role: string; biography: string; photoObjectKey?: string | null } | null;
  reference: { title: string; description: string } | null;
  facts: Array<{ id: string; iconKey: string; title: string; body: string }>;
  media: Array<{ id: string; title: string; description: string; kind: string }>;
  scenario: {
    title: string;
    description: string;
    emergencyTitle: string;
    emergencyBody: string;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      actions: Array<{ id: string; title: string; body: string; actionLabel: string; kind: string }>;
    }>;
  } | null;
};

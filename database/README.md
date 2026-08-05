# Iris content database

The production schema is managed by Prisma rather than hand-run SQL:

- [`../prisma/schema.prisma`](../prisma/schema.prisma) is the readable data model.
- [`../prisma/migrations/20260805120000_initial/migration.sql`](../prisma/migrations/20260805120000_initial/migration.sql) is the versioned migration for Timeweb PostgreSQL.
- `npm run db:seed` creates the three example departments only if the database is completely empty.

Do not execute a schema manually in the Timeweb panel. On deployment the application uses `prisma migrate deploy`, so the database structure is kept in sync with the exact application version.

## Data placement

| Data | Storage |
| --- | --- |
| Department names, order, publication status, texts and reference facts | PostgreSQL |
| Chief's name, bio, photo key and alt text | PostgreSQL |
| Video/PDF/image title, description, publication status and metadata | PostgreSQL |
| Photo/video/PDF file bytes and preview images | Timeweb S3 |
| Passwords, database/S3 credentials and session secrets | Timeweb environment variables |
| Patient symptoms, medical history and chat messages | Not part of this MVP |

## UI mapping

`departments` feeds the department chips on the patient portal and the selector in the admin panel. `scenarios`, `scenario_steps` and `scenario_actions` form the dynamic "Провести по шагам" flow. `media_items` provide videos, images and PDFs. The public portal reads only published records; the admin reads drafts too.

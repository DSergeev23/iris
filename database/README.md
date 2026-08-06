# Iris content database

The production schema is managed by Prisma rather than hand-run SQL:

- [`../prisma/schema.prisma`](../prisma/schema.prisma) is the readable data model.
- [`../prisma/migrations/20260805120000_initial/migration.sql`](../prisma/migrations/20260805120000_initial/migration.sql) is the versioned migration for Timeweb PostgreSQL.
- `npm run db:seed` creates the three example departments only if the database is completely empty.

Do not execute a hand-written schema in the Timeweb panel. Apply the versioned Prisma migrations with `npm run db:migrate` as an explicit deployment step when a release contains database changes. The application startup command is only `npm start`; migrations and data bootstrap do not run inside the web-container startup loop.

## First administrator

The first administrator is created through a guarded one-time route:

1. Add a random `ADMIN_SETUP_TOKEN` of at least 32 characters to the Timeweb application environment.
2. Deploy the application and open `/setup` on the technical or admin domain.
3. Enter the setup token, administrator email, display name, and a password of at least 16 characters.
4. Verify that `/admin` opens and `/login` accepts the new credentials.
5. Remove `ADMIN_SETUP_TOKEN` from Timeweb and redeploy.

The setup action refuses to create a second administrator even if the route is called concurrently. `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` are not used.

## Data placement

| Data | Storage |
| --- | --- |
| Department names, order, publication status, texts and reference facts | PostgreSQL |
| Chief's name, bio, photo key and alt text | PostgreSQL |
| Video/PDF/image title, description, publication status and metadata | PostgreSQL |
| Photo/video/PDF file bytes and preview images | Timeweb S3 |
| Passwords, database/S3 credentials and session secrets | Timeweb environment variables |
| Patient symptoms, medical history and chat messages | Not part of this MVP |

## Timeweb S3

Keep the bucket private. The browser uploads through a five-minute presigned `PUT` URL, and the application serves private files through short-lived signed `GET` URLs.

Configure bucket CORS for these origins:

```text
https://irisadmin.ru
https://dsergeev23-iris-f156.twc1.net
```

Allowed methods:

```text
PUT
GET
HEAD
```

Allowed request headers should include `Content-Type`. Do not expose `S3_ACCESS_KEY_ID` or `S3_SECRET_ACCESS_KEY` in browser-visible variables: all five S3 settings remain server-side Timeweb environment variables.

Upload flow:

1. `/api/uploads/presign` checks the admin session, department, MIME type, and size.
2. The browser uploads the bytes directly to Timeweb S3 and displays progress.
3. `/api/uploads/complete` verifies the object with `HeadObject` before writing PostgreSQL metadata.
4. New media stays in `DRAFT` until the administrator publishes it.

## UI mapping

`departments` feeds the department chips on the patient portal and the selector in the admin panel. `scenarios`, `scenario_steps` and `scenario_actions` form the dynamic "Провести по шагам" flow. `media_items` provide videos, images and PDFs. The public portal reads only published records; the admin reads drafts too.

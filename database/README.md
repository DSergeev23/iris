# Iris content database

These SQL files are the first migration set for Timeweb PostgreSQL. They are not tied to the static prototypes and do not contain credentials or real media.

## Run order

After creating a PostgreSQL database in Timeweb, run the files in this order:

```bash
psql "$DATABASE_URL" -f database/001_initial_schema.sql
psql "$DATABASE_URL" -f database/002_demo_content.sql
```

The second file is optional demo content. It deliberately creates no administrator: the first account must be created by the future server code from environment variables, with an Argon2id password hash.

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

`departments` feeds the department chips on the patient portal and the selector in the admin panel. `scenario_stages` and `scenario_situations` form the "Провести по шагам" flow. `media_items` provide videos, images and PDFs; a media item can be shown from multiple stages through `media_stage_links`.

The future app will expose two read models: public department content (published records only) and editable admin content (drafts included). The existing `admin.html` remains a visual prototype until it is moved into the Next.js app.

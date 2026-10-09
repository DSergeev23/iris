# Rehabilitation MVP snapshot

`screens.json` is copied byte-for-byte from `iris 2.0.zip` → `iris 2.0/app/screens.json`, the original MVP scenario source supplied by the owner. Its SHA-256 is `edafd323c24e2af909eab98c505f35470f4c555002b5bbae16a78cea1f4f2f03`. It contains 48 records. The patient flow reachable from the name form has 42 screens and 94 buttons; all eight MP4 files appear on 15 reachable screens. `department.json` contains the department, head, reference, and facts shown on `https://iriscare.ru/` before the domain cutover.

The original HTML, eight videos (about 110 MB), and head photo are staged in the local `output/mvp-source/` directory and excluded from Git. `node scripts/import-mvp-rehabilitation.mjs --check` verifies their sizes and SHA-256 digests. All eight archived MP4 files match the staged videos byte-for-byte. The published head photo on the new portal also matches the MVP SHA-256 digest. All eight published video routes returned partial content with the same byte lengths as the archive; their full hashes have not been compared.

Five source records are not reachable from the MVP patient flow: `greeting_message`, `call_center_schedule`, `exercise_guidelines`, `thank_you_message`, and `unknown_command`. Their content remains in `screens.json`; the importer does not create patient-facing steps for them. The other non-step record, `start_prompt`, becomes the scenario welcome text. `exercise_guidelines` supplies the media-list description in the original MVP, and the importer preserves that description.

## Existing Timeweb department

The live admin at `dsergeev23-iris-f156.twc1.net` already has a published `early-medical-rehabilitation` department, its head photo, reference, three facts, and eight published videos. Its current scenario has four generic steps. `npm run import:mvp:existing` validates the department and video titles/sizes, reuses their S3 objects, and atomically replaces its scenario and media descriptions with the MVP content. The previous scenario is saved in the audit event for recovery. A repeat run with the same snapshot makes no changes. The script requires only the existing `DATABASE_URL` environment variable.

## Timeweb App Platform without SSH

The repository's `npm run start` command now applies migrations, imports the MVP scenario once, and starts Next.js. It uses the application's existing `DATABASE_URL` and published videos, so no SSH, panel command change, or local media upload is needed. The import keeps the prior scenario in an audit event and skips itself on later restarts. Keep a PostgreSQL backup before release where the hosting platform provides one.

Check the App Platform deployment logs for `Updated existing rehabilitation department: 42 steps, 94 actions, 8 reused videos.` If the script reports a video mismatch, the transaction does not run; verify the eight uploaded files in the admin. Then check the department in `/admin` and test `/portal?department=early-medical-rehabilitation`, including both joint-specific video branches. Do not put database credentials in the command or repository.

The original MVP's free-text feedback box does not save or send its contents. The imported scenario keeps the same box and text, with a visible note that its contents are not sent or saved. The import also preserves patient-facing headings and opens the stage selection on repeat entry, as the MVP does.

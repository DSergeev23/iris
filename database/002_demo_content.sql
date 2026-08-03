-- Demonstration content reflecting the current static admin prototype.
-- File object keys are examples only; real uploads will create new S3 keys.

INSERT INTO departments (slug, name, intro, status, sort_order)
VALUES
  ('trauma', 'Травматология', 'Помощник для пациентов после травм и операций. Здесь собраны понятные шаги восстановления, видео и ответы на частые вопросы.', 'published', 1),
  ('neuro', 'Неврология', 'Помощник для пациентов неврологического отделения: восстановление движений, речи, равновесия и контроль самочувствия.', 'published', 2),
  ('therapy', 'Терапия', 'Помощник для пациентов терапевтического отделения: назначения, показатели, дыхание, давление и подготовка к выписке.', 'published', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO department_heads (
  department_id, first_name, last_name, role_title, biography, photo_object_key, photo_alt
)
SELECT id, 'Андрей', 'Константинов', 'Заведующий отделением, травматолог-ортопед',
  'Ведет пациентов после операций и помогает команде отделения выстроить понятный маршрут восстановления.',
  'departments/trauma/head/andrey-konstantinov.jpg', 'Андрей Константинов'
FROM departments WHERE slug = 'trauma'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_heads (
  department_id, first_name, last_name, role_title, biography, photo_object_key, photo_alt
)
SELECT id, 'Елена', 'Морозова', 'Заведующая отделением, врач-невролог',
  'Курирует восстановление пациентов после инсульта и при других неврологических состояниях, помогает выстроить последовательный план наблюдения.',
  'departments/neuro/head/elena-morozova.jpg', 'Елена Морозова'
FROM departments WHERE slug = 'neuro'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_heads (
  department_id, first_name, last_name, role_title, biography, photo_object_key, photo_alt
)
SELECT id, 'Сергей', 'Павлов', 'Заведующий отделением, врач-терапевт',
  'Ведет пациентов с заболеваниями сердца, легких и общими состояниями, где особенно важны режим, контроль показателей и понятные назначения.',
  'departments/therapy/head/sergey-pavlov.jpg', 'Сергей Павлов'
FROM departments WHERE slug = 'therapy'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_reference_sections (department_id, title, description)
SELECT id, 'О травматологическом отделении',
  'Отделение помогает пациентам после травм, операций на суставах и сложных переломов. Врачи и медсестры сопровождают восстановление от первых движений до подготовки к выписке.'
FROM departments WHERE slug = 'trauma'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_reference_sections (department_id, title, description)
SELECT id, 'О неврологическом отделении',
  'В отделении помогают пациентам с нарушениями движения, речи, чувствительности и равновесия. Команда подбирает индивидуальный режим восстановления и контролирует изменения состояния.'
FROM departments WHERE slug = 'neuro'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_reference_sections (department_id, title, description)
SELECT id, 'О терапевтическом отделении',
  'Отделение занимается диагностикой и лечением заболеваний внутренних органов. Пациенты проходят обследования, получают терапию и рекомендации по дальнейшему наблюдению.'
FROM departments WHERE slug = 'therapy'
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO department_facts (department_id, icon_key, title, body, sort_order)
SELECT id, fact.icon_key, fact.title, fact.body, fact.sort_order
FROM departments
CROSS JOIN LATERAL (
  VALUES
    ('clock', 'Время обхода', 'Ежедневно с 09:00 до 11:00', 1),
    ('building', 'Пост медсестры', 'Корпус 2, этаж 4, рядом с палатой № 8', 2),
    ('info', 'Часы посещения', 'Ежедневно с 16:00 до 19:00', 3)
) AS fact(icon_key, title, body, sort_order)
WHERE slug = 'trauma'
ON CONFLICT (department_id, sort_order) DO NOTHING;

INSERT INTO department_facts (department_id, icon_key, title, body, sort_order)
SELECT id, fact.icon_key, fact.title, fact.body, fact.sort_order
FROM departments
CROSS JOIN LATERAL (
  VALUES
    ('clock', 'Врачебный обход', 'Ежедневно с 10:00 до 12:00', 1),
    ('building', 'Кабинет ЛФК', 'Корпус 1, этаж 3, кабинет № 315', 2),
    ('info', 'Тихий час', 'Ежедневно с 14:00 до 16:00', 3)
) AS fact(icon_key, title, body, sort_order)
WHERE slug = 'neuro'
ON CONFLICT (department_id, sort_order) DO NOTHING;

INSERT INTO department_facts (department_id, icon_key, title, body, sort_order)
SELECT id, fact.icon_key, fact.title, fact.body, fact.sort_order
FROM departments
CROSS JOIN LATERAL (
  VALUES
    ('clock', 'Утренние измерения', 'Давление и температура с 07:00', 1),
    ('building', 'Процедурный кабинет', 'Этаж 5, напротив поста медсестры', 2),
    ('info', 'Прием передач', 'Ежедневно с 12:00 до 18:00', 3)
) AS fact(icon_key, title, body, sort_order)
WHERE slug = 'therapy'
ON CONFLICT (department_id, sort_order) DO NOTHING;

INSERT INTO scenario_stages (department_id, title, description, sort_order)
SELECT id, stage.title, stage.description, stage.sort_order
FROM departments
CROSS JOIN LATERAL (
  VALUES
    ('Где вы сейчас?', 'Пациент выбирает текущий этап восстановления', 1),
    ('Что беспокоит?', 'Уточняем состояние после травмы или операции', 2),
    ('Что сделать сейчас?', 'Показываем упражнения, памятку или видео', 3),
    ('Следующий шаг', 'Продолжение маршрута или срочная помощь', 4)
) AS stage(title, description, sort_order)
WHERE slug = 'trauma'
ON CONFLICT (department_id, sort_order) DO NOTHING;

INSERT INTO media_items (
  department_id, kind, title, description, status, storage_object_key,
  original_filename, mime_type, file_size_bytes, duration_seconds, sort_order
)
SELECT id, 'video', 'Как безопасно встать с кровати', 'После операции и на этапе первых движений.', 'published',
  'departments/trauma/media/safe-bed-rise.mp4', 'safe-bed-rise.mp4', 'video/mp4', 0, 90, 1
FROM departments WHERE slug = 'trauma'
ON CONFLICT (storage_object_key) DO NOTHING;

INSERT INTO media_items (
  department_id, kind, title, description, status, storage_object_key,
  original_filename, mime_type, file_size_bytes, duration_seconds, sort_order
)
SELECT id, 'video', 'Как безопасно сесть на кровати', 'Первые движения при слабости и головокружении.', 'published',
  'departments/neuro/media/safe-bed-sit.mp4', 'safe-bed-sit.mp4', 'video/mp4', 0, 130, 1
FROM departments WHERE slug = 'neuro'
ON CONFLICT (storage_object_key) DO NOTHING;

INSERT INTO media_items (
  department_id, kind, title, description, status, storage_object_key,
  original_filename, mime_type, file_size_bytes, duration_seconds, sort_order
)
SELECT id, 'video', 'Как правильно измерить давление', 'Положение тела, руки и повторное измерение.', 'published',
  'departments/therapy/media/measure-blood-pressure.mp4', 'measure-blood-pressure.mp4', 'video/mp4', 0, 70, 1
FROM departments WHERE slug = 'therapy'
ON CONFLICT (storage_object_key) DO NOTHING;

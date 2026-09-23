-- Rename only the previous system defaults; administrator-authored content is preserved.
UPDATE "scenarios" SET "title" = 'Провести по этапам' WHERE "title" = 'Провести по шагам';
UPDATE "scenarios" SET "description" = 'Подскажем безопасный следующий этап после травмы или операции.' WHERE "description" = 'Подскажем безопасный следующий шаг после травмы или операции.';
UPDATE "scenario_steps" SET "title" = 'Следующий этап' WHERE "title" = 'Следующий шаг';
UPDATE "scenario_actions" SET "body" = 'Хочу понять следующий этап.' WHERE "body" = 'Хочу понять следующий шаг.';
UPDATE "scenario_actions" SET "body" = 'Перейти к следующему этапу.' WHERE "body" = 'Перейти к следующему шагу.';
UPDATE "departments" SET "intro" = 'Понятные этапы восстановления после травмы или операции. Выберите, что нужно сделать сейчас.' WHERE "intro" = 'Понятные шаги восстановления после травмы или операции. Выберите, что нужно сделать сейчас.';

-- Rollback: run the same statements with the old and new phrases exchanged.

ALTER TABLE "scenarios"
  ADD COLUMN "emergency_button_label" TEXT NOT NULL DEFAULT 'Что считать срочным',
  ADD COLUMN "emergency_detail_title" TEXT NOT NULL DEFAULT 'Когда срочно звать помощь',
  ADD COLUMN "emergency_detail_body" TEXT NOT NULL DEFAULT 'Позовите медицинскую сестру кнопкой вызова у кровати или обратитесь на пост.';

UPDATE "scenarios"
SET "emergency_detail_title" = "emergency_title",
    "emergency_detail_body" = CASE
      WHEN "emergency_body" = '' THEN 'Позовите медицинскую сестру кнопкой вызова у кровати или обратитесь на пост.'
      ELSE "emergency_body"
    END;

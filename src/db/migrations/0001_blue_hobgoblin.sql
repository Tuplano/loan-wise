CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reminders_enabled` integer DEFAULT true NOT NULL,
	`reminder_days_before` integer DEFAULT 3 NOT NULL
);

ALTER TABLE `app_settings` ADD `display_name` text DEFAULT 'You' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `email` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `currency` text DEFAULT 'PHP' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `appearance` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `default_interest_rate` real DEFAULT 0 NOT NULL;
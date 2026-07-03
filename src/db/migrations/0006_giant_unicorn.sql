CREATE TABLE `payment_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` integer NOT NULL,
	`payment_id` integer,
	`kind` text DEFAULT 'installment' NOT NULL,
	`amount_cents` integer NOT NULL,
	`principal_applied_cents` integer NOT NULL,
	`interest_applied_cents` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `paid_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `payments` SET `paid_cents` = `amount_cents` WHERE `is_paid` = 1;--> statement-breakpoint
INSERT INTO `payment_transactions` (`loan_id`, `payment_id`, `kind`, `amount_cents`, `principal_applied_cents`, `interest_applied_cents`, `paid_at`, `note`, `created_at`)
SELECT `loan_id`, `id`, 'installment', `amount_cents`, `principal_portion_cents`, `interest_portion_cents`, COALESCE(`paid_at`, `due_date`), `note`, `created_at`
FROM `payments` WHERE `is_paid` = 1;
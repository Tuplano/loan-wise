DELETE FROM `reminders`;--> statement-breakpoint
DELETE FROM `payments`;--> statement-breakpoint
DELETE FROM `loans`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` integer NOT NULL,
	`installment_number` integer NOT NULL,
	`due_date` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`principal_portion_cents` integer NOT NULL,
	`interest_portion_cents` integer NOT NULL,
	`is_paid` integer DEFAULT false NOT NULL,
	`paid_at` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_loan_installment_idx` ON `payments` (`loan_id`,`installment_number`);

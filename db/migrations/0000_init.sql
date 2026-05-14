CREATE TABLE `conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`onset_date` text,
	`resolution_date` text,
	`code` text,
	`description` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conditions_patient_idx` ON `conditions` (`patient_id`);--> statement-breakpoint
CREATE INDEX `conditions_description_idx` ON `conditions` (`description`);--> statement-breakpoint
CREATE TABLE `encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`encounter_class` text,
	`reason_description` text,
	`total_cost` real,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `encounters_patient_idx` ON `encounters` (`patient_id`);--> statement-breakpoint
CREATE INDEX `encounters_start_date_idx` ON `encounters` (`start_date`);--> statement-breakpoint
CREATE INDEX `encounters_class_idx` ON `encounters` (`encounter_class`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`start_date` text,
	`stop_date` text,
	`code` text,
	`description` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `medications_patient_idx` ON `medications` (`patient_id`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`date` text,
	`code` text,
	`description` text,
	`value` text,
	`units` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `observations_patient_idx` ON `observations` (`patient_id`);--> statement-breakpoint
CREATE INDEX `observations_code_idx` ON `observations` (`code`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`dob` text NOT NULL,
	`gender` text,
	`race` text,
	`ethnicity` text,
	`marital_status` text,
	`address_zip` text
);
--> statement-breakpoint
CREATE INDEX `patients_last_name_idx` ON `patients` (`last_name`);
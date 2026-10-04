-- 0003: provider-independent daily digest preferences and story feedback.
-- Weather uses Open-Meteo; MVP news sources are ABC RSS registry entries.
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locality_name` text,
	`locality_region` text,
	`latitude` real,
	`longitude` real,
	`timezone` text DEFAULT 'Australia/Sydney' NOT NULL,
	`delivery_local_time` text DEFAULT '07:00' NOT NULL,
	`digest_length` text DEFAULT 'concise' NOT NULL,
	`source_mode` text DEFAULT 'all' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `user_preferences_coordinates_check` CHECK ((`latitude` IS NULL AND `longitude` IS NULL) OR (`latitude` IS NOT NULL AND `longitude` IS NOT NULL AND `latitude` BETWEEN -90 AND 90 AND `longitude` BETWEEN -180 AND 180)),
	CONSTRAINT `user_preferences_delivery_time_check` CHECK (length(`delivery_local_time`) = 5 AND `delivery_local_time` GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(`delivery_local_time`, 1, 2) < '24'),
	CONSTRAINT `user_preferences_digest_length_check` CHECK (`digest_length` IN ('concise', 'standard')),
	CONSTRAINT `user_preferences_source_mode_check` CHECK (`source_mode` IN ('all', 'selected'))
);
--> statement-breakpoint
CREATE TABLE `user_preference_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `user_preference_topics_kind_check` CHECK (`kind` IN ('curated', 'custom', 'exclude')),
	CONSTRAINT `user_preference_topics_value_length_check` CHECK (length(`value`) BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preference_topics_user_kind_value_unique` ON `user_preference_topics` (`user_id`,`kind`,`value`);
--> statement-breakpoint
CREATE INDEX `user_preference_topics_user_idx` ON `user_preference_topics` (`user_id`);
--> statement-breakpoint
CREATE TABLE `user_preference_sources` (
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `source_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `story_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`article_identifier` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_feedback_user_source_article_unique` ON `story_feedback` (`user_id`,`source_id`,`article_identifier`);
--> statement-breakpoint
CREATE INDEX `story_feedback_user_idx` ON `story_feedback` (`user_id`);
-- 0004: persist independently enabled MVP digest sections.
-- Existing rows with a resolved location inherit both sections enabled. Rows
-- without a location inherit News enabled and Weather disabled so constraints
-- remain valid; new preference rows default both sections on in the app.
CREATE TABLE `__new_user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locality_name` text,
	`locality_region` text,
	`latitude` real,
	`longitude` real,
	`timezone` text DEFAULT 'Australia/Sydney' NOT NULL,
	`delivery_local_time` text DEFAULT '07:00' NOT NULL,
	`digest_length` text DEFAULT 'concise' NOT NULL,
	`source_mode` text DEFAULT 'all' NOT NULL,
	`weather_enabled` integer DEFAULT true NOT NULL,
	`news_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `user_preferences_weather_enabled_check` CHECK (`weather_enabled` IN (0, 1)),
	CONSTRAINT `user_preferences_news_enabled_check` CHECK (`news_enabled` IN (0, 1)),
	CONSTRAINT `user_preferences_coordinates_check` CHECK ((`weather_enabled` = 0 AND ((`latitude` IS NULL AND `longitude` IS NULL) OR (`latitude` IS NOT NULL AND `longitude` IS NOT NULL AND `latitude` BETWEEN -90 AND 90 AND `longitude` BETWEEN -180 AND 180))) OR (`weather_enabled` = 1 AND `latitude` IS NOT NULL AND `longitude` IS NOT NULL AND `latitude` BETWEEN -90 AND 90 AND `longitude` BETWEEN -180 AND 180)),
	CONSTRAINT `user_preferences_delivery_time_check` CHECK (length(`delivery_local_time`) = 5 AND `delivery_local_time` GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(`delivery_local_time`, 1, 2) < '24'),
	CONSTRAINT `user_preferences_digest_length_check` CHECK (`digest_length` IN ('concise', 'standard')),
	CONSTRAINT `user_preferences_source_mode_check` CHECK (`source_mode` IN ('all', 'selected'))
);
--> statement-breakpoint
INSERT INTO `__new_user_preferences` (`user_id`, `locality_name`, `locality_region`, `latitude`, `longitude`, `timezone`, `delivery_local_time`, `digest_length`, `source_mode`, `weather_enabled`, `news_enabled`, `created_at`, `updated_at`) SELECT `user_id`, `locality_name`, `locality_region`, `latitude`, `longitude`, `timezone`, `delivery_local_time`, `digest_length`, `source_mode`, CASE WHEN `latitude` IS NOT NULL AND `longitude` IS NOT NULL THEN 1 ELSE 0 END, 1, `created_at`, `updated_at` FROM `user_preferences`;
--> statement-breakpoint
DROP TABLE `user_preferences`;
--> statement-breakpoint
ALTER TABLE `__new_user_preferences` RENAME TO `user_preferences`;
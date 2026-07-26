-- Migration to add banner-related columns to the announcements table
ALTER TABLE announcements ADD COLUMN banner_title TEXT DEFAULT '';
ALTER TABLE announcements ADD COLUMN banner_subtitle TEXT DEFAULT '';
ALTER TABLE announcements ADD COLUMN banner_link TEXT DEFAULT '';
ALTER TABLE announcements ADD COLUMN banner_image TEXT DEFAULT '';
ALTER TABLE announcements ADD COLUMN is_banner_active TEXT DEFAULT 'false';
ALTER TABLE announcements ADD COLUMN days_to_live INTEGER DEFAULT 7;

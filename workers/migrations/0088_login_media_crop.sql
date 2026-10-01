-- Persist WYSIWYG focal position and zoom for login banner images.
ALTER TABLE login_media_slides
  ADD COLUMN crop_x REAL NOT NULL DEFAULT 0.5
  CHECK (crop_x >= 0.0 AND crop_x <= 1.0);

ALTER TABLE login_media_slides
  ADD COLUMN crop_y REAL NOT NULL DEFAULT 0.5
  CHECK (crop_y >= 0.0 AND crop_y <= 1.0);

ALTER TABLE login_media_slides
  ADD COLUMN crop_zoom REAL NOT NULL DEFAULT 1.0
  CHECK (crop_zoom >= 1.0 AND crop_zoom <= 3.0);

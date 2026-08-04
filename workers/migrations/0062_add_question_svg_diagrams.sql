-- Store server-sanitized SVG diagrams and their dedicated accessibility text.
-- image_alt remains reserved for raster/image-library media.
ALTER TABLE questions ADD COLUMN svg_content TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN svg_alt TEXT NOT NULL DEFAULT '';

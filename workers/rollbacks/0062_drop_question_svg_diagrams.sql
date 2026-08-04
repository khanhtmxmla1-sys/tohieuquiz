-- Roll back the SVG diagram persistence columns introduced by migration 0062.
-- This is destructive: stored SVG diagrams and their accessibility text are removed.
ALTER TABLE questions DROP COLUMN svg_alt;
ALTER TABLE questions DROP COLUMN svg_content;

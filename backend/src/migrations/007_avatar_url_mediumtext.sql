-- Migration 007: Expand avatar_url to MEDIUMTEXT for persistent image storage
ALTER TABLE users MODIFY COLUMN avatar_url MEDIUMTEXT NULL;

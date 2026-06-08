-- Add cover_letter_viewed column to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS cover_letter_viewed boolean DEFAULT false;

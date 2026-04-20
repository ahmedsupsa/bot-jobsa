-- Support chat: attachments + shared resource metadata.
-- Run this in Supabase SQL Editor.

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachment_url   TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size  INTEGER,
  ADD COLUMN IF NOT EXISTS meta             JSONB;

-- Storage bucket "support" (public read for simplicity – URLs are unguessable).
INSERT INTO storage.buckets (id, name, public)
VALUES ('support', 'support', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "support_uploads" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "support_reads" ON storage.objects FOR SELECT
  USING (bucket_id = 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

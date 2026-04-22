-- Allow deleting jobs without losing application history.
-- Re-creates the FK on applications.job_id with ON DELETE SET NULL,
-- so that when a job is removed, related application rows remain
-- (their job_id simply becomes NULL).

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'applications'::regclass
      AND contype  = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%REFERENCES admin_jobs%'
  LOOP
    EXECUTE format('ALTER TABLE applications DROP CONSTRAINT %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE applications
  ADD CONSTRAINT applications_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES admin_jobs(id) ON DELETE SET NULL;

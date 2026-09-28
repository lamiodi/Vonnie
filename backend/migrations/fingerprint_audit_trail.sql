-- Fingerprint enrollment audit trail
-- 1. Creates audit_logs (the earlier migration was never applied — expense
--    audit writes have been silently failing into their try/catch).
-- 2. Widens the audit action CHECK to include fingerprint_enroll.
-- 3. Adds per-user enrollment tracking columns so "when and by whom was this
--    worker's fingerprint changed" is directly answerable.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Allow fingerprint_enroll as an audited action
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action::text = ANY (ARRAY[
    'create'::character varying, 'update'::character varying, 'delete'::character varying,
    'verify'::character varying, 'refund'::character varying, 'void'::character varying,
    'approve'::character varying, 'reject'::character varying,
    'fingerprint_enroll'::character varying
  ]::text[]));

-- Track enrollment directly on the user row
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fingerprint_enrolled_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fingerprint_enrolled_by uuid;
ALTER TABLE public.users ADD CONSTRAINT users_fingerprint_enrolled_by_fkey
  FOREIGN KEY (fingerprint_enrolled_by) REFERENCES public.users(id);

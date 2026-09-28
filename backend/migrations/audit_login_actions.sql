-- Allow login events in the audit log
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action::text = ANY (ARRAY[
    'create'::character varying, 'update'::character varying, 'delete'::character varying,
    'verify'::character varying, 'refund'::character varying, 'void'::character varying,
    'approve'::character varying, 'reject'::character varying,
    'fingerprint_enroll'::character varying,
    'login'::character varying, 'login_failed'::character varying
  ]::text[]));

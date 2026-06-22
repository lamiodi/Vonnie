-- Create expenses table for tracking shop daily costs
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  category character varying NOT NULL CHECK (category::text = ANY (ARRAY['rent'::character varying, 'electricity'::character varying, 'diesel'::character varying, 'fuel'::character varying, 'internet'::character varying, 'product_purchase'::character varying, 'maintenance'::character varying, 'logistics'::character varying, 'marketing'::character varying, 'petty_cash'::character varying, 'staff_welfare'::character varying, 'refund_or_loss'::character varying, 'miscellaneous'::character varying]::text[])),
  payment_method character varying NOT NULL CHECK (payment_method::text = ANY (ARRAY['cash'::character varying, 'card'::character varying, 'transfer'::character varying, 'bank_transfer'::character varying, 'paystack'::character varying]::text[])),
  supplier character varying,
  description text,
  receipt_reference character varying,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);

-- Create index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON expenses(recorded_by);

-- Create audit_logs table for tracking financial actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action character varying NOT NULL CHECK (action::text = ANY (ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying, 'verify'::character varying, 'refund'::character varying, 'void'::character varying, 'approve'::character varying, 'reject'::character varying]::text[])),
  entity_type character varying NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Create index for faster entity lookups
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

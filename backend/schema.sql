-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_settings (
  id integer NOT NULL DEFAULT nextval('admin_settings_id_seq'::regclass),
  enable_online_booking boolean DEFAULT true,
  enable_email_notifications boolean DEFAULT true,
  updated_by uuid,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT admin_settings_pkey PRIMARY KEY (id),
  CONSTRAINT admin_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  worker_id uuid NOT NULL,
  date date NOT NULL,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  status character varying NOT NULL DEFAULT 'present'::character varying CHECK (status::text = ANY (ARRAY['present'::character varying, 'absent'::character varying, 'late'::character varying, 'half_day'::character varying, 'overtime'::character varying, 'flagged'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  check_in_latitude numeric,
  check_in_longitude numeric,
  check_out_latitude numeric,
  check_out_longitude numeric,
  location_verification_status character varying CHECK (location_verification_status::text = ANY (ARRAY['verified'::character varying, 'rejected'::character varying, 'flagged'::character varying]::text[])),
  distance_from_shop numeric,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id)
);
CREATE TABLE public.booking_services (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  service_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT booking_services_pkey PRIMARY KEY (id),
  CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);
CREATE TABLE public.booking_workers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  assigned_by uuid,
  role character varying DEFAULT 'primary'::character varying CHECK (role::text = ANY (ARRAY['primary'::character varying::text, 'secondary'::character varying::text, 'assistant'::character varying::text])),
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'cancelled'::character varying::text, 'completed'::character varying::text])),
  assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT booking_workers_pkey PRIMARY KEY (id),
  CONSTRAINT booking_workers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id),
  CONSTRAINT booking_workers_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_name character varying NOT NULL,
  customer_email character varying,
  customer_phone character varying,
  status character varying NOT NULL DEFAULT 'pending_confirmation'::character varying CHECK (status::text = ANY (ARRAY['scheduled'::character varying, 'in-progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'pending_confirmation'::character varying]::text[])),
  total_amount numeric NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  booking_number character varying NOT NULL UNIQUE,
  scheduled_time timestamp with time zone NOT NULL,
  payment_status character varying DEFAULT 'pending'::character varying CHECK (payment_status::text = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
  customer_type character varying DEFAULT 'pre_booked'::character varying CHECK (customer_type::text = ANY (ARRAY['walk_in'::character varying, 'pre_booked'::character varying]::text[])),
  queue_priority integer DEFAULT 3,
  worker_id uuid,
  duration integer NOT NULL DEFAULT 0,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id)
);
CREATE TABLE public.coupon_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  coupon_id uuid NOT NULL,
  transaction_id uuid,
  booking_id uuid,
  customer_email character varying,
  discount_amount numeric NOT NULL,
  used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT coupon_usage_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usage_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT coupon_usage_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT coupon_usage_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.pos_transactions(id)
);
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying, 'fixed'::character varying]::text[])),
  discount_value numeric NOT NULL,
  min_order_amount numeric DEFAULT 0,
  max_discount_amount numeric,
  usage_limit integer,
  used_count integer DEFAULT 0,
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT coupons_pkey PRIMARY KEY (id),
  CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.customer_queue (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_type character varying NOT NULL CHECK (customer_type::text = ANY (ARRAY['booking'::character varying, 'walk_in'::character varying]::text[])),
  booking_id uuid,
  walk_in_id uuid,
  queue_position integer NOT NULL CHECK (queue_position >= 0),
  status character varying DEFAULT 'waiting'::character varying CHECK (status::text = ANY (ARRAY['waiting'::character varying, 'called'::character varying, 'in_service'::character varying, 'completed'::character varying, 'no_show'::character varying]::text[])),
  arrival_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  called_time timestamp with time zone,
  service_start_time timestamp with time zone,
  service_end_time timestamp with time zone,
  assigned_worker_id uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_queue_pkey PRIMARY KEY (id),
  CONSTRAINT customer_queue_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT customer_queue_walk_in_id_fkey FOREIGN KEY (walk_in_id) REFERENCES public.walk_in_customers(id),
  CONSTRAINT customer_queue_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES public.users(id)
);
CREATE TABLE public.inventory_movements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  movement_type character varying NOT NULL CHECK (movement_type::text = ANY (ARRAY['adjustment'::character varying, 'sale'::character varying, 'restock'::character varying, 'return'::character varying, 'transfer'::character varying]::text[])),
  quantity integer NOT NULL,
  reference_type character varying,
  reference_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  note text,
  CONSTRAINT inventory_movements_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.password_reset_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.payment_confirmation_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  previous_payment_status character varying,
  new_payment_status character varying NOT NULL,
  confirmation_method character varying NOT NULL,
  payment_reference character varying,
  confirmation_notes text,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_confirmation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT payment_confirmation_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT payment_confirmation_logs_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  amount numeric NOT NULL,
  currency character varying DEFAULT 'NGN'::character varying,
  reference character varying NOT NULL UNIQUE,
  paystack_reference character varying,
  description text,
  metadata jsonb,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  booking_id uuid,
  pos_transaction_id uuid,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT payments_pos_transaction_id_fkey FOREIGN KEY (pos_transaction_id) REFERENCES public.pos_transactions(id)
);
CREATE TABLE public.pos_transaction_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  transaction_id uuid NOT NULL,
  product_id uuid,
  product_name character varying,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  service_id uuid,
  service_duration integer,
  CONSTRAINT pos_transaction_items_pkey PRIMARY KEY (id),
  CONSTRAINT pos_transaction_items_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.pos_transactions(id),
  CONSTRAINT pos_transaction_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT pos_transaction_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);
CREATE TABLE public.pos_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  transaction_number character varying NOT NULL UNIQUE,
  customer_name character varying,
  customer_email character varying,
  customer_phone character varying,
  subtotal numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  coupon_id uuid,
  total_amount numeric NOT NULL,
  payment_method character varying NOT NULL CHECK (payment_method::text = ANY (ARRAY['cash'::character varying, 'paystack'::character varying, 'bank_transfer'::character varying]::text[])),
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pos_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT pos_transactions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT pos_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  sku character varying UNIQUE,
  category character varying,
  price numeric NOT NULL,
  cost numeric,
  stock_level integer NOT NULL DEFAULT 0,
  unit character varying DEFAULT 'piece'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  duration integer NOT NULL,
  price numeric NOT NULL,
  category character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.signup_status (
  id integer NOT NULL DEFAULT nextval('signup_status_id_seq'::regclass),
  is_enabled boolean DEFAULT true,
  updated_by uuid,
  updated_at timestamp without time zone DEFAULT now(),
  message text DEFAULT 'Signups are currently enabled.'::text,
  CONSTRAINT signup_status_pkey PRIMARY KEY (id),
  CONSTRAINT signup_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.time_off_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  worker_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT time_off_requests_pkey PRIMARY KEY (id),
  CONSTRAINT time_off_requests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  role character varying NOT NULL DEFAULT 'user'::character varying CHECK (role::text = ANY (ARRAY['admin'::character varying, 'manager'::character varying, 'staff'::character varying, 'user'::character varying]::text[])),
  phone character varying,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  current_status character varying NOT NULL DEFAULT 'available'::character varying CHECK (current_status::text = ANY (ARRAY['available'::text, 'busy'::text, 'offline'::text])),
  specialty character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.walk_in_customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_name character varying NOT NULL,
  customer_phone character varying,
  customer_email character varying,
  priority_level character varying DEFAULT 'normal'::character varying CHECK (priority_level::text = ANY (ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying]::text[])),
  arrival_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  status character varying DEFAULT 'waiting'::character varying CHECK (status::text = ANY (ARRAY['waiting'::character varying, 'assigned'::character varying, 'in_service'::character varying, 'completed'::character varying, 'cancelled'::character varying]::text[])),
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT walk_in_customers_pkey PRIMARY KEY (id),
  CONSTRAINT walk_in_customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  endpoint_id uuid,
  event_type character varying NOT NULL,
  payload jsonb NOT NULL,
  response jsonb,
  success boolean NOT NULL,
  delivered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_deliveries_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES public.webhook_endpoints(id)
);
CREATE TABLE public.webhook_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  url text NOT NULL,
  secret character varying NOT NULL,
  event_types ARRAY NOT NULL DEFAULT ARRAY['*'::text],
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id)
);

-- Migration: Create service_products junction table
-- This table links services to the products they consume (e.g., Knotless Braids -> Attachment)

CREATE TABLE IF NOT exists public.service_products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity_required integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_products_pkey PRIMARY KEY (id),
  CONSTRAINT service_products_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE,
  CONSTRAINT service_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT service_products_unique_link UNIQUE (service_id, product_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON public.service_products(service_id);

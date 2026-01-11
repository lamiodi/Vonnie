ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_by_size JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS size VARCHAR(10);
ALTER TABLE public.pos_transaction_items ADD COLUMN IF NOT EXISTS size VARCHAR(10);

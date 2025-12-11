ALTER TABLE pos_transaction_items
ADD COLUMN IF NOT EXISTS service_name VARCHAR(255);

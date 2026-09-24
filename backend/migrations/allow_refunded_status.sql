-- Migration: Allow 'refunded' in pos_transactions.status
ALTER TABLE pos_transactions DROP CONSTRAINT IF EXISTS pos_transactions_status_check;
ALTER TABLE pos_transactions ADD CONSTRAINT pos_transactions_status_check 
  CHECK (status::text = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text]));

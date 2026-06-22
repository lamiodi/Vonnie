/**
 * Script to create ecommerce_orders table
 * Run with: node scripts/create-ecommerce-table.js
 */

import { query } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTable() {
  console.log('Creating ecommerce_orders table...');
  
  try {
    // Create the table
    await query(`
      CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        wp_order_id integer,
        customer_email character varying NOT NULL,
        customer_phone character varying,
        customer_name character varying,
        shipping_address text,
        items text NOT NULL,
        total_amount numeric NOT NULL,
        status character varying DEFAULT 'pending_payment'::character varying,
        payment_method character varying DEFAULT 'paystack'::character varying,
        paystack_reference character varying,
        paid_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT ecommerce_orders_pkey PRIMARY KEY (id),
        CONSTRAINT ecommerce_orders_status_check 
          CHECK (status::text = ANY (ARRAY[
            'pending_payment'::text, 
            'completed'::text, 
            'failed'::text, 
            'cancelled'::text
          ]))
      );
    `);
    
    console.log('✓ Table created successfully');
    
    // Create indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_wp_order_id ON ecommerce_orders(wp_order_id);
      CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_paystack_reference ON ecommerce_orders(paystack_reference);
      CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_status ON ecommerce_orders(status);
      CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_created_at ON ecommerce_orders(created_at DESC);
    `);
    
    console.log('✓ Indexes created successfully');
    
    // Verify table exists
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ecommerce_orders'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nTable columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('\n✅ ecommerce_orders table is ready!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

createTable();

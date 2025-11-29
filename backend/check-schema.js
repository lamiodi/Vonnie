import { query } from './src/config/database.js';

async function checkAdminSettingsSchema() {
  try {
    console.log('🔍 Checking admin_settings table schema...');
    
    // Check if table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_settings'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ admin_settings table does not exist');
      return;
    }
    
    console.log('✅ admin_settings table exists');
    
    // Get column information
    const columns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Current columns in admin_settings table:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Check if enable_maintenance_mode column exists
    const maintenanceModeExists = await query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_settings' 
        AND column_name = 'enable_maintenance_mode'
      );
    `);
    
    if (maintenanceModeExists.rows[0].exists) {
      console.log('\n✅ enable_maintenance_mode column exists');
    } else {
      console.log('\n❌ enable_maintenance_mode column is missing');
    }
    
    // Show current data
    const currentData = await query('SELECT * FROM admin_settings LIMIT 1;');
    if (currentData.rows.length > 0) {
      console.log('\n📊 Current admin settings data:');
      console.log(currentData.rows[0]);
    } else {
      console.log('\n📊 No admin settings data found');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAdminSettingsSchema();
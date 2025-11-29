import { query } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';

async function executeFixScript() {
  try {
    console.log('🔧 Executing fix-admin-settings.sql script...');
    
    // Read the SQL script
    const sqlScript = fs.readFileSync(path.join(process.cwd(), 'scripts', 'fix-admin-settings.sql'), 'utf8');
    
    // Execute the SQL script
    await query(sqlScript);
    
    console.log('✅ Fix script executed successfully');
    
    // Verify the fix by checking schema again
    console.log('\n🔍 Verifying the fix...');
    
    const columns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'admin_settings'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Updated columns in admin_settings table:');
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
      console.log('\n✅ enable_maintenance_mode column has been added successfully');
    } else {
      console.log('\n❌ enable_maintenance_mode column is still missing');
    }
    
    // Show updated data
    const currentData = await query('SELECT * FROM admin_settings LIMIT 1;');
    if (currentData.rows.length > 0) {
      console.log('\n📊 Updated admin settings data:');
      console.log(currentData.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error executing fix script:', error.message);
  } finally {
    process.exit(0);
  }
}

executeFixScript();
import { getClient } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const STAFF_DATA = [
  // Admin users
  {
    name: 'System Administrator', 
    email: 'admin@vonnex2x.com',
    role: 'admin',
    phone: '+234-800-000-0001'
  },
  
  // Manager users  
  {
    name: 'General Manager',
    email: 'manager@vonnex2x.com', 
    role: 'manager',
    phone: '+234-800-000-0002'
  },

  // Staff users (Hairstylists, Beauticians, etc.)
  {
    name: 'Grace Hairstylist',
    email: 'grace@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0003'
  },
  {
    name: 'Sarah Beautician',
    email: 'sarah@vonnex2x.com', 
    role: 'staff',
    phone: '+234-800-000-0004'
  },
  {
    name: 'Joy Nail Tech',
    email: 'joy@vonnex2x.com',
    role: 'staff', 
    phone: '+234-800-000-0005'
  },
  {
    name: 'Amaka Braids Specialist',
    email: 'amaka@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0006'
  },
  {
    name: 'Chioma Massage Therapist',
    email: 'chioma@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0007'
  },
  {
    name: 'Tola Skincare Specialist',
    email: 'tola@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0008'
  }
];

async function clearAndInsertStaff() {
  const client = await getClient();
  
  try {
    console.log('🗑️  Clearing existing staff...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('🔄 Handling all foreign key dependencies...');
    
    // Get all staff IDs that will be deleted
    const staffIdsResult = await client.query(
      'SELECT id FROM users WHERE role IN ($1, $2, $3)',
      ['admin', 'manager', 'staff']
    );
    const staffIds = staffIdsResult.rows.map(row => row.id);
    
    if (staffIds.length === 0) {
      console.log('✅ No existing staff to clear');
    } else {
      console.log(`📋 Found ${staffIds.length} staff members to clear`);
      
      // Handle all foreign key dependencies
      for (const staffId of staffIds) {
        // Set created_by to NULL for coupons
        await client.query('UPDATE coupons SET created_by = NULL WHERE created_by = $1', [staffId]);
        
        // Set assigned_by to NULL for booking_workers
        await client.query('UPDATE booking_workers SET assigned_by = NULL WHERE assigned_by = $1', [staffId]);
        
        // Set created_by to NULL for walk_in_customers
        await client.query('UPDATE walk_in_customers SET created_by = NULL WHERE created_by = $1', [staffId]);
        
        // Delete booking_workers entries for this staff
        await client.query('DELETE FROM booking_workers WHERE worker_id = $1', [staffId]);
        
        // Delete attendance records for this staff
        await client.query('DELETE FROM attendance WHERE worker_id = $1', [staffId]);
        
        // Update bookings - set worker_id to NULL where this staff was assigned
        await client.query('UPDATE bookings SET worker_id = NULL WHERE worker_id = $1', [staffId]);
        
        // Set updated_by to NULL for signup_status
        await client.query('UPDATE signup_status SET updated_by = NULL WHERE updated_by = $1', [staffId]);
      }
      
      // Now delete the staff users
      const deleteResult = await client.query(
        'DELETE FROM users WHERE role IN ($1, $2, $3)',
        ['admin', 'manager', 'staff']
      );
      console.log(`✅ Deleted ${deleteResult.rowCount} staff members`);
    }
    
    console.log('📝 Inserting new staff members...');
    
    // Hash password for all staff
    const hashedPassword = await bcrypt.hash('password', 10);
    
    // Insert new staff members
    let insertedCount = 0;
    for (const staff of STAFF_DATA) {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, phone, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
        [staff.name, staff.email, hashedPassword, staff.role, staff.phone, true]
      );
      const newId = result.rows[0].id;
      insertedCount++;
      console.log(`✅ Added: ${staff.name} (${staff.role})`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`\n🎉 Successfully completed staff update!`);
    console.log(`   - Cleared: ${staffIds.length} existing staff`);
    console.log(`   - Added: ${insertedCount} new staff members`);
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Error updating staff:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
console.log('🚀 Starting staff update process...\n');

clearAndInsertStaff()
  .then(() => {
    console.log('\n✅ Staff update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Staff update failed:', error.message);
    process.exit(1);
  });
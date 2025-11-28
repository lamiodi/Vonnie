import { query, getClient } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const STAFF_DATA = [
  // Admin users
  {
    id: 'admin-001',
    name: 'System Administrator', 
    email: 'admin@vonnex2x.com',
    role: 'admin',
    phone: '+234-800-000-0001'
  },
  
  // Manager users  
  {
    id: 'manager-001',
    name: 'General Manager',
    email: 'manager@vonnex2x.com', 
    role: 'manager',
    phone: '+234-800-000-0002'
  },

  // Staff users (Hairstylists, Beauticians, etc.)
  {
    id: 'staff-001',
    name: 'Grace Hairstylist',
    email: 'grace@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0003'
  },
  {
    id: 'staff-002',
    name: 'Sarah Beautician',
    email: 'sarah@vonnex2x.com', 
    role: 'staff',
    phone: '+234-800-000-0004'
  },
  {
    id: 'staff-003',
    name: 'Joy Nail Tech',
    email: 'joy@vonnex2x.com',
    role: 'staff', 
    phone: '+234-800-000-0005'
  },
  {
    id: 'staff-004',
    name: 'Amaka Braids Specialist',
    email: 'amaka@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0006'
  },
  {
    id: 'staff-005',
    name: 'Chioma Massage Therapist',
    email: 'chioma@vonnex2x.com',
    role: 'staff',
    phone: '+234-800-000-0007'
  },
  {
    id: 'staff-006',
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
    
    // Delete existing staff (admin, manager, staff roles)
    const deleteResult = await client.query(
      'DELETE FROM users WHERE role IN ($1, $2, $3)',
      ['admin', 'manager', 'staff']
    );
    console.log(`✅ Cleared ${deleteResult.rowCount} existing staff members`);
    
    // Hash password for all users (default password: 'password')
    const hashedPassword = await bcrypt.hash('password', 10);
    
    console.log('➕ Inserting new staff...');
    
    // Insert new staff members
    for (const staff of STAFF_DATA) {
      await client.query(
        `INSERT INTO users (id, name, email, password, role, phone, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [staff.id, staff.name, staff.email, hashedPassword, staff.role, staff.phone, true]
      );
      console.log(`✅ Added: ${staff.name} (${staff.role})`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`\n🎉 Successfully updated staff database!`);
    console.log(`📊 Total staff added: ${STAFF_DATA.length}`);
    console.log('\n🔑 Default password for all accounts: "password"');
    console.log('⚠️  Please change passwords after first login!');
    
    // Show summary
    console.log('\n📋 Staff Summary:');
    console.log('- Admins: 1');
    console.log('- Managers: 1'); 
    console.log('- Staff: 6');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating staff:', error.message);
  } finally {
    client.release();
  }
}

// Run the script
clearAndInsertStaff().then(() => {
  console.log('\n✨ Script completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
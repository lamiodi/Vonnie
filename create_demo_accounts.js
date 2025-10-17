require('dotenv').config({ path: './backend/.env' });
const { supabaseAdmin } = require('./backend/config/supabase');

async function createDemoAccounts() {
  console.log('Creating demo accounts...');

  // Demo Admin Account
  const adminAccount = {
    email: 'admin@vonnex2x.com',
    password: 'Admin123!',
    first_name: 'Vonne',
    last_name: 'Admin',
    phone: '+234-800-000-0001',
    role: 'admin'
  };

  // Demo Staff Account  
  const staffAccount = {
    email: 'staff@vonnex2x.com',
    password: 'Staff123!',
    first_name: 'Sarah',
    last_name: 'Johnson',
    phone: '+234-800-000-0002',
    role: 'staff'
  };

  try {
    // Create Admin Account
    console.log('Creating admin account...');
    const { data: adminAuth, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: adminAccount.email,
      password: adminAccount.password,
      email_confirm: true
    });

    if (adminAuthError) {
      console.error('Admin auth creation error:', adminAuthError.message);
      return;
    }

    // Create Admin Profile
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: adminAuth.user.id,
        email: adminAccount.email,
        first_name: adminAccount.first_name,
        last_name: adminAccount.last_name,
        phone: adminAccount.phone,
        role: adminAccount.role,
        hire_date: new Date().toISOString().split('T')[0],
        salary: 150000.00,
        is_active: true
      })
      .select()
      .single();

    if (adminProfileError) {
      console.error('Admin profile creation error:', adminProfileError.message);
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(adminAuth.user.id);
      return;
    }

    console.log('✅ Admin account created successfully!');
    console.log('   Email:', adminAccount.email);
    console.log('   Password:', adminAccount.password);

    // Create Staff Account
    console.log('Creating staff account...');
    const { data: staffAuth, error: staffAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: staffAccount.email,
      password: staffAccount.password,
      email_confirm: true
    });

    if (staffAuthError) {
      console.error('Staff auth creation error:', staffAuthError.message);
      return;
    }

    // Create Staff Profile
    const { data: staffProfile, error: staffProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: staffAuth.user.id,
        email: staffAccount.email,
        first_name: staffAccount.first_name,
        last_name: staffAccount.last_name,
        phone: staffAccount.phone,
        role: staffAccount.role,
        hire_date: new Date().toISOString().split('T')[0],
        salary: 80000.00,
        commission_rate: 10.00,
        is_active: true
      })
      .select()
      .single();

    if (staffProfileError) {
      console.error('Staff profile creation error:', staffProfileError.message);
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(staffAuth.user.id);
      return;
    }

    console.log('✅ Staff account created successfully!');
    console.log('   Email:', staffAccount.email);
    console.log('   Password:', staffAccount.password);

    console.log('\n🎉 Demo accounts created successfully!');
    console.log('\nYou can now login with:');
    console.log('Admin - Email:', adminAccount.email, 'Password:', adminAccount.password);
    console.log('Staff - Email:', staffAccount.email, 'Password:', staffAccount.password);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createDemoAccounts();
}

module.exports = { createDemoAccounts };
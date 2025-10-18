const { createClient } = require('@supabase/supabase-js');

// Use the credentials from your .env file
const SUPABASE_URL = 'https://pqpruuatcsazimqwvlrc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHJ1dWF0Y3NhemltcXd2bHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDYzMjk5MSwiZXhwIjoyMDc2MjA4OTkxfQ.ZmS9hRSmt96Pbq1767KNTMopuADVVx82ygWv4PVcPJU';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createDemoAccount(email, password, firstName, lastName, phone, role) {
  try {
    console.log(`Creating ${role} account: ${email}`);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      console.log(`❌ Auth creation failed:`, authError.message);
      return;
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        role,
        is_active: true
      });

    if (profileError) {
      console.log(`❌ Profile creation failed:`, profileError.message);
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return;
    }

    console.log(`✅ Successfully created ${role} account: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.log(`❌ Error creating ${email}:`, error.message);
  }
}

async function main() {
  console.log('Creating demo accounts...');
  
  // Create admin account
  await createDemoAccount(
    'admin@vonnex2x.com', 
    'admin123', 
    'Vonne', 
    'Admin', 
    '+2348000000001', 
    'admin'
  );

  // Create staff account
  await createDemoAccount(
    'staff@vonnex2x.com', 
    'staff123', 
    'Sarah', 
    'Johnson', 
    '+2348000000002', 
    'staff'
  );

  console.log('\n🎉 Demo account creation completed!');
  console.log('\nYou can now login with:');
  console.log('Admin - Email: admin@vonnex2x.com / Password: admin123');
  console.log('Staff - Email: staff@vonnex2x.com / Password: staff123');
}

main().catch(console.error);
const { createClient } = require('@supabase/supabase-js');

// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createDemoAccounts() {
  console.log('Creating demo accounts...');
  
  const demoAccounts = [
    {
      email: 'admin@demo.com',
      password: 'admin123',
      first_name: 'Demo',
      last_name: 'Admin',
      phone: '+1234567890',
      role: 'admin'
    },
    {
      email: 'staff@demo.com',
      password: 'staff123',
      first_name: 'Demo',
      last_name: 'Staff',
      phone: '+1234567891',
      role: 'staff'
    }
  ];

  for (const account of demoAccounts) {
    try {
      console.log(`\nCreating account: ${account.email}`);
      
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', account.email)
        .single();

      if (existingUser) {
        console.log(`✅ Account ${account.email} already exists`);
        continue;
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true
      });

      if (authError) {
        console.log(`❌ Auth creation failed for ${account.email}:`, authError.message);
        continue;
      }

      // Create user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: account.first_name,
          last_name: account.last_name,
          phone: account.phone,
          role: account.role
        })
        .select()
        .single();

      if (profileError) {
        console.log(`❌ Profile creation failed for ${account.email}:`, profileError.message);
        // Cleanup: delete the auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        continue;
      }

      console.log(`✅ Successfully created ${account.role} account: ${account.email}`);
      console.log(`   Password: ${account.password}`);
      console.log(`   User ID: ${authData.user.id}`);

    } catch (error) {
      console.log(`❌ Error creating ${account.email}:`, error.message);
    }
  }

  console.log('\nDemo account creation completed!');
  console.log('\nDemo Accounts:');
  console.log('Admin: admin@demo.com / admin123');
  console.log('Staff: staff@demo.com / staff123');
}

// Instructions for the user
console.log('='.repeat(60));
console.log('DEMO ACCOUNT CREATION SCRIPT');
console.log('='.repeat(60));
console.log('\nBefore running this script:');
console.log('1. Replace SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY with your actual values');
console.log('2. Get your Service Role Key from Supabase Dashboard → Settings → API');
console.log('3. Run: node create_demo_simple.js');
console.log('='.repeat(60));

// Uncomment the line below to run the function automatically
// createDemoAccounts().catch(console.error);
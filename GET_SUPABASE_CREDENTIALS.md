# 🔍 How to Get Your Supabase Credentials

## Step 1: Go to Your Supabase Dashboard
1. Login to [supabase.com](https://supabase.com)
2. Click on your project name

## Step 2: Find Your API Settings
1. In the left sidebar, click on **Settings**
2. Click on **API**

## Step 3: Copy Your Credentials
You'll see these important values:

### 🔗 Project URL
```
https://[your-project-ref].supabase.co
```
- Copy the entire URL
- Looks like: `https://abcdefghijklmnop.supabase.co`

### 🔑 API Keys
- **anon public** - Use this for `VITE_SUPABASE_ANON_KEY` (frontend)
- **service_role** - Use this for `SUPABASE_SERVICE_ROLE_KEY` (backend)

## Step 4: Update Your Environment Files

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://[your-project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Backend (.env)
```env
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 5: Run Database Migrations
1. Go to **SQL Editor** in Supabase dashboard
2. Copy content from `database/migrations/001_initial_schema.sql`
3. Paste and run the SQL
4. Repeat for `002_rls_policies.sql`

## Step 6: Test Your Connection
Restart your development servers and check that the authentication works!

## 📋 What Your Credentials Should Look Like

### Project URL Example:
```
https://abcdefghijklmnop.supabase.co
```

### API Key Example:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3BxcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDYwNjcyNjAsImV4cCI6MTk2MTY0MzI2MH0.abcdefghijklmnopqrstuvwxyz1234567890
```

## 🔒 Security Notes
- Never commit your actual keys to version control
- Use test keys during development
- Rotate keys if they get compromised
- Keep your service_role key secure (backend only)

## 🆘 Need Help?
- Check that your project is active in Supabase
- Verify the URL format is correct
- Ensure you're copying the entire key (starts with `eyJ...`)
- Make sure your Supabase project is in the same region as your users
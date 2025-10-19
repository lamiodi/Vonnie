import postgres from 'postgres';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Mock data for testing when database is not available
const mockUsers = [
  {
    id: '1',
    email: 'admin@vonnex2x.com',
    password_hash: '$2b$10$example.hash.for.admin',
    full_name: 'System Administrator',
    phone: '+1234567890',
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '2',
    email: 'staff@vonnex2x.com',
    password_hash: '$2b$10$example.hash.for.staff',
    full_name: 'Staff Member',
    phone: '+1234567891',
    role: 'staff',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

const mockServices = [
  { id: 1, name: 'Web Development', category: 'Technology', price: 1500.00, is_active: true, created_at: new Date() },
  { id: 2, name: 'Graphic Design', category: 'Design', price: 800.00, is_active: true, created_at: new Date() },
  { id: 3, name: 'Digital Marketing', category: 'Marketing', price: 1200.00, is_active: true, created_at: new Date() }
]

let sql;
let isConnected = false;

// Try to create PostgreSQL connection
try {
  sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5, // Reduced timeout for faster fallback
  });
  
  // Test connection
  await sql`SELECT NOW() as current_time`;
  isConnected = true;
  console.log('✅ Database connected successfully');
} catch (error) {
  console.log('⚠️  Database connection failed, using mock data:', error.message);
  isConnected = false;
}

// Mock SQL function for when database is not available
const mockSql = {
  unsafe: async (query, params = []) => {
    console.log('🔄 Mock query:', query, params);
    
    if (query.includes('COUNT(*) as total FROM services')) {
      return [{ total: mockServices.length }];
    }
    
    if (query.includes('SELECT * FROM services')) {
      return mockServices;
    }
    
    if (query.includes('COUNT(*) as user_count FROM users')) {
      return [{ user_count: mockUsers.length }];
    }
    
    if (query.includes('SELECT * FROM users')) {
      return mockUsers;
    }
    
    return [];
  }
};

// Use template literal function for mock
const mockTemplate = (strings, ...values) => {
  const query = strings.join('?');
  console.log('🔄 Mock template query:', query, values);
  
  if (query.includes('SELECT NOW()')) {
    return [{ current_time: new Date() }];
  }
  
  // Handle user queries
  if (query.includes('SELECT * FROM users WHERE email')) {
    const email = values[0];
    const user = mockUsers.find(u => u.email === email);
    return user ? [user] : [];
  }
  
  if (query.includes('SELECT * FROM users WHERE id')) {
    const id = values[0];
    const user = mockUsers.find(u => u.id === id);
    return user ? [user] : [];
  }
  
  if (query.includes('SELECT id FROM users WHERE email')) {
    const email = values[0];
    const user = mockUsers.find(u => u.email === email);
    return user ? [{ id: user.id }] : [];
  }
  
  if (query.includes('INSERT INTO users')) {
    // Simulate user creation
    const newUser = {
      id: String(mockUsers.length + 1),
      email: values[0],
      password_hash: values[1],
      full_name: values[2],
      phone: values[3],
      role: values[4],
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    mockUsers.push(newUser);
    return [newUser];
  }
  
  if (query.includes('COUNT(*) as user_count FROM users')) {
    return [{ user_count: mockUsers.length }];
  }
  
  if (query.includes('COUNT(*) as service_count FROM services')) {
    return [{ service_count: mockServices.length }];
  }
  
  if (query.includes('SELECT email, full_name, role FROM users')) {
    return mockUsers.slice(0, 3);
  }
  
  return [];
};

// Assign unsafe method to mock template function
mockTemplate.unsafe = mockSql.unsafe;

// Test connection function
export const testConnection = async () => {
  if (isConnected) {
    try {
      const result = await sql`SELECT NOW() as current_time`;
      console.log('✅ Database connected successfully at:', result[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  } else {
    console.log('⚠️  Using mock database connection');
    return true;
  }
};

// Export the appropriate sql connection
const exportedSql = isConnected ? sql : mockTemplate;
export { exportedSql as sql };
export default exportedSql;
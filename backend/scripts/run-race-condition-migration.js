// Database migration runner for race condition fix
import { query } from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🚀 Running race condition fix migration...');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', 'fix_worker_assignment_race_condition.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements, handling trigger functions properly
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    let functionBody = '';
    
    const lines = migrationSQL.split('\n');
    
    for (const line of lines) {
      // Skip comment lines
      if (line.trim().startsWith('--')) continue;
      
      // Track if we're inside a function definition
      if (line.includes('CREATE OR REPLACE FUNCTION') && !inFunction) {
        inFunction = true;
        functionBody = line + '\n';
        continue;
      }
      
      // If we're in a function, collect all lines until we reach the end
      if (inFunction) {
        functionBody += line + '\n';
        
        // Check for the end of function marker (LANGUAGE plpgsql;)
        if (line.includes('LANGUAGE plpgsql') && line.trim().endsWith(';')) {
          statements.push(functionBody.trim());
          functionBody = '';
          inFunction = false;
        }
        continue;
      }
      
      // For regular statements
      currentStatement += line + '\n';
      
      // Split on semicolon for regular statements
      if (line.trim().endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📋 Executing ${statements.length} migration statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.startsWith('--')) {
        try {
          console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          await query(statement);
        } catch (error) {
          // Ignore errors for indexes/constraints that might already exist
          if (error.code === '42P07' || error.code === '42710' || error.message.includes('already exists')) {
            console.log(`   ⚠️  Skipping (already exists): ${error.message.split('\"')[1] || 'constraint/index'}`);
          } else if (error.code === '2BP01') { // dependent objects still exist
            console.log(`   ⚠️  Skipping (dependent objects exist): ${error.message}`);
          } else {
            console.error(`   ❌ Error executing statement: ${error.message}`);
            console.error(`   Statement: ${statement.substring(0, 200)}...`);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Race condition fix migration completed successfully!');
    
    // Verify the constraints were created
    console.log('\n🔍 Verifying constraints...');
    
    const constraints = await query(`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'booking_workers' 
        AND constraint_type = 'CHECK'
    `);
    
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'booking_workers' 
        AND indexname LIKE '%unique%'
    `);
    
    console.log(`   Found ${constraints.rows.length} check constraints`);
    console.log(`   Found ${indexes.rows.length} unique indexes`);
    
    if (indexes.rows.length > 0) {
      console.log('   ✅ Unique constraint successfully created!');
    } else {
      console.log('   ⚠️  Unique constraint may not have been created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();
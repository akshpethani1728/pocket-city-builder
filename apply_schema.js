const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://ixxtjpcqpxfusstmybow.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4eHRqcGNxcHhmdXNzdG15Ym93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTAxMjE0OSwiZXhwIjoyMTA2NTg4MTQ5fQ.un_dGhPoLSGCFBwirPfLStJhFjA0rggClJUNbzOG240';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const sql = fs.readFileSync('schema.sql', 'utf8');

async function apply() {
  // First, try to create exec_sql function if it doesn't exist
  const createExecSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;
  `;
  
  // Try to create the exec_sql function first
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error && error.message.includes('function exec_sql') && error.message.includes('does not exist')) {
      console.log('Creating exec_sql function...');
      // Try to create it via raw SQL
      const { error } = await supabase.from('_dummy').select('1').limit(0); // dummy query to test connection
      console.log('Connection test:', error?.message || 'OK');
    }
  } catch (e) {
    console.log('Connection test error:', e.message);
  }

  // Since we can't easily create exec_sql via the client,
  // let's try to use the Supabase REST API directly to run SQL
  // We'll use the PostgREST API to create a temporary function
  
  // Actually, let's try a different approach: use the Supabase REST API directly
  // to run raw SQL via the /rpc endpoint with a custom function
  
  // First, let's try to create a temporary exec function
  const createFuncSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error && error.message.includes('does not exist')) {
      console.log('exec_sql function does not exist, need to create it first');
      // We need to create it via raw SQL
      // Let's try using the REST API directly
    }
  } catch (e) {
    console.log('Test error:', e.message);
  }
}

apply().catch(console.error);
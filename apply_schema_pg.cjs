const { Client } = require('pg');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4eHRqcGNxcHhmdXNzdG15Ym93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTAxMjE0OSwiZXhwIjoyMTA2NTg4MTQ5fQ.un_dGhPoLSGCFBwirPfLStJhFjA0rggClJUNbzOG240';

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ixxtjpcqpxfusstmybow',
  password: SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false }
});

const sql = require('fs').readFileSync('schema.sql', 'utf8');

async function apply() {
  try {
    await client.connect();
    console.log('Connected to Supabase via pooler');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
        console.log('OK:', stmt.substring(0, 80) + '...');
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('already exists') || e.message.includes('duplicate')) {
          console.log('SKIP (exists):', stmt.substring(0, 80) + '...');
        } else {
          console.log('ERROR:', stmt.substring(0, 80) + '...', e.message);
        }
      }
    }
    console.log('Schema applied');
  } catch (e) {
    console.error('Connection error:', e.message);
  } finally {
    await client.end();
  }
}

apply().catch(console.error);
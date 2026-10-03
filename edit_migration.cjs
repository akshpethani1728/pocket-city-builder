const fs = require('fs');
let c = fs.readFileSync('supabase/migrations/20261003093345_initial_schema.sql', 'utf8');
c = c.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";');
fs.writeFileSync('supabase/migrations/20261003093345_initial_schema.sql', c);
console.log('added pgcrypto');
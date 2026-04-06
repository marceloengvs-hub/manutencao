
import fs from 'fs';
import path from 'path';

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = envContent.split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      acc[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
    return acc;
  }, {});

  const url = `${env.VITE_SUPABASE_URL}/rest/v1/manutencoes?select=count`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      'Range-Unit': 'items',
      'Prefer': 'count=exact'
    }
  });

  const data = await response.json();
  console.log('Count:', data);
}

main().catch(console.error);

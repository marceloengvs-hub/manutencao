
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Try to read .env.local
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = envContent.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=')
  if (key && value) acc[key.trim()] = value.trim()
  return acc
}, {} as any)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function findMaintenance() {
  const { data, error } = await supabase
    .from('manutencoes')
    .select('id, titulo, checklist_json, protocolo_id, created_at')
    .ilike('titulo', '%Fibra%')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching maintenance:', error)
    return
  }

  console.log('--- FOUND RECORDS ---')
  data.forEach(m => {
    console.log(`ID: ${m.id} | Titulo: ${m.titulo} | Created: ${m.created_at}`)
    console.log(`Checklist: ${JSON.stringify(m.checklist_json)}`)
    console.log(`Proto ID: ${m.protocolo_id}`)
    console.log('---')
  })
}

findMaintenance()

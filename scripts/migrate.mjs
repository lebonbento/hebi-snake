/**
 * Applique api/_lib/schema.sql à la base pointée par DATABASE_URL.
 * Le schéma est écrit en « if not exists » : le relancer ne casse rien.
 *
 *   DATABASE_URL='postgres://…' npm run migrate
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!url) {
  console.error("DATABASE_URL manquante. Récupère-la avec `vercel env pull` ou depuis l'onglet")
  console.error('Storage du projet Vercel, puis relance :')
  console.error("  DATABASE_URL='postgres://…' npm run migrate")
  process.exit(1)
}

const sql = neon(url)
const schema = readFileSync(resolve(root, 'api/_lib/schema.sql'), 'utf8')

// neon() over HTTP ne prend qu'une instruction à la fois : on découpe.
const instructions = schema
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.trim().startsWith('--')))

for (const instruction of instructions) {
  const titre = instruction.replace(/\s+/g, ' ').slice(0, 70)
  await sql.query(instruction)
  console.log(`✓ ${titre}…`)
}

const [{ n }] = await sql.query('select count(*)::int as n from joueurs')
console.log(`\n✓ base prête — ${n} joueur(s) enregistré(s)`)

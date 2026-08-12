/**
 * Sert dist/ ET les routes /api sur un Postgres local (PGlite, en mémoire),
 * sans Vercel, sans Neon et sans réseau.
 *
 *   npm run build && npm run local
 *
 * Les handlers sont les MÊMES fichiers que ceux déployés : ce qu'on essaie ici
 * est ce qui partira en production.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { utiliserBase } from '../api/_lib/db.js'
import classement from '../api/classement.js'
import compte from '../api/compte.js'
import score from '../api/score.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const PORT = Number(process.env.PORT || 4180)

if (!existsSync(dist)) {
  console.error('dist/ est absent — lance `npm run build` d’abord.')
  process.exit(1)
}

const db = new PGlite()
await db.exec(readFileSync(resolve(root, 'api/_lib/schema.sql'), 'utf8'))
utiliserBase(async (text, params) => (await db.query(text, params)).rows)

const ROUTES = { '/api/compte': compte, '/api/score': score, '/api/classement': classement }

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function lireCorps(req) {
  return new Promise((ok) => {
    let brut = ''
    req.on('data', (c) => (brut += c))
    req.on('end', () => {
      try {
        ok(brut ? JSON.parse(brut) : {})
      } catch {
        ok({})
      }
    })
  })
}

/** Donne à `res` la forme que les handlers Vercel attendent. */
function habille(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  return res
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const handler = ROUTES[url.pathname]

  if (handler) {
    if (req.method === 'POST') req.body = await lireCorps(req)
    try {
      await handler(req, habille(res))
    } catch (e) {
      console.error(e)
      habille(res).status(500).end(JSON.stringify({ erreur: 'boum' }))
    }
    return
  }

  // Statique, avec repli sur index.html (l'app est une page unique).
  const demande = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let fichier = join(dist, demande)
  if (!existsSync(fichier) || statSync(fichier).isDirectory()) fichier = join(dist, 'index.html')

  res.setHeader('Content-Type', TYPES[extname(fichier)] || 'application/octet-stream')
  createReadStream(fichier).pipe(res)
}).listen(PORT, () => {
  console.log(`HEBI en local sur http://localhost:${PORT} (Postgres en mémoire)`)
})

/**
 * Génère les icônes PWA à partir d'un SVG construit ici même.
 *
 * Le kanji 蛇 est un TRACÉ vectoriel, pas un <text> : l'icône ne dépend donc
 * d'aucune police installée sur la machine qui la rasterise, ni sur l'appareil
 * qui l'affiche.
 *
 * Ce contour est extrait de Noto Sans JP 700 (Adobe), sous SIL Open Font
 * License 1.1, qui autorise les dérivés à condition d'en livrer la licence :
 * voir public/fonts/OFL-NotoSansJP.txt.
 *
 *   npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/icons')

const INK = '#0b0b12'
const RED = '#dc2626'

// Contour du glyphe, repère de la police : 1000 upem, y vers le HAUT.
const KANJI_PATH =
  'M639 846H756V644H639ZM444 709H961V503H850V606H551V503H444ZM518 534H630V83Q630 52 639.0 43.5Q648 35 680 35Q688 35 706.0 35.0Q724 35 745.5 35.0Q767 35 785.5 35.0Q804 35 814 35Q834 35 844.0 45.0Q854 55 858.5 84.0Q863 113 866 170Q885 157 914.5 144.5Q944 132 968 127Q962 51 947.0 8.5Q932 -34 902.5 -52.0Q873 -70 823 -70Q815 -70 799.0 -70.0Q783 -70 763.5 -70.0Q744 -70 724.5 -70.0Q705 -70 689.5 -70.0Q674 -70 667 -70Q609 -70 576.0 -56.0Q543 -42 530.5 -9.0Q518 24 518 83ZM852 471 929 376Q880 349 822.5 324.0Q765 299 706.5 277.0Q648 255 592 236Q588 255 576.5 281.0Q565 307 555 325Q608 345 662.0 369.0Q716 393 765.5 419.5Q815 446 852 471ZM188 837H291V602H188ZM117 663H422V287H117V382H332V567H117ZM57 663H145V240H57ZM197 622H279V334H289V71H186V334H197ZM29 80Q77 86 138.0 94.0Q199 102 267.5 112.0Q336 122 405 133L412 30Q316 12 219.5 -4.5Q123 -21 45 -34ZM325 219 413 246Q428 204 442.0 157.0Q456 110 466.0 64.5Q476 19 480 -17L387 -46Q384 -10 375.0 36.0Q366 82 353.0 130.0Q340 178 325 219Z'

// Boîte englobante réelle du glyphe, pour un centrage optique exact.
const GLYPH = { xMin: 29, yMin: -70, xMax: 968, yMax: 846 }
const GLYPH_CX = (GLYPH.xMin + GLYPH.xMax) / 2
const GLYPH_CY = (GLYPH.yMin + GLYPH.yMax) / 2
const GLYPH_H = GLYPH.yMax - GLYPH.yMin

/**
 * @param size        côté du carré, en px
 * @param discRatio   diamètre du disque rouge, en fraction du côté
 * @param kanjiRatio  hauteur du kanji, en fraction du diamètre du disque
 */
function buildSvg({ size = 512, discRatio = 0.74, kanjiRatio = 0.6 } = {}) {
  const c = size / 2
  const r = (size * discRatio) / 2
  const scale = (r * 2 * kanjiRatio) / GLYPH_H

  // scale(s, -s) remet l'axe y dans le sens du SVG (vers le bas).
  const tx = c - scale * GLYPH_CX
  const ty = c + scale * GLYPH_CY
  const t = (n) => Number(n.toFixed(3))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${INK}"/>
  <circle cx="${c}" cy="${c}" r="${t(r)}" fill="${RED}"/>
  <g transform="translate(${t(tx)} ${t(ty)}) scale(${t(scale)} ${t(-scale)})">
    <path d="${KANJI_PATH}" fill="#ffffff"/>
  </g>
</svg>
`
}

// Le masque d'Android peut rogner jusqu'à 20 % de chaque bord : sur la variante
// maskable, tout ce qui compte reste dans le cercle central de 80 %.
const TARGETS = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  { file: 'icon-maskable-512.png', size: 512, opts: { discRatio: 0.56, kanjiRatio: 0.62 } },
  { file: 'apple-touch-icon.png', size: 180, opts: {} },
]

mkdirSync(out, { recursive: true })

for (const { file, size, opts } of TARGETS) {
  const svg = buildSvg({ size, ...opts })
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(out, file))
  console.log(`✓ ${file} (${size}×${size})`)
}

// Le SVG sert aussi de favicon sur desktop, où il reste net à toute taille.
writeFileSync(resolve(root, 'public/favicon.svg'), buildSvg({ size: 512 }))
console.log('✓ favicon.svg')

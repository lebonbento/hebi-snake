/**
 * Les kanji que le serpent peut manger.
 *
 * Choisis pour trois raisons : peu de traits, donc lisibles dans une case de
 * 15 à 20 px ; un sens concret, qu'un enfant se représente ; et une traduction
 * courte, qui tient sur une ligne quand elle monte à l'écran.
 *
 * Un seul caractère par case — c'est pour ça qu'on n'utilise pas de mots en
 * hiragana : « ねこ » ne tiendrait pas là où 猫 tient.
 */
export const KANJI = [
  // La nature
  { c: '水', fr: 'eau' },
  { c: '火', fr: 'feu' },
  { c: '山', fr: 'montagne' },
  { c: '川', fr: 'rivière' },
  { c: '木', fr: 'arbre' },
  { c: '花', fr: 'fleur' },
  { c: '空', fr: 'ciel' },
  { c: '海', fr: 'mer' },
  { c: '雨', fr: 'pluie' },
  { c: '雪', fr: 'neige' },
  { c: '風', fr: 'vent' },
  { c: '星', fr: 'étoile' },
  { c: '石', fr: 'pierre' },
  { c: '日', fr: 'soleil' },
  { c: '月', fr: 'lune' },

  // Les animaux
  { c: '犬', fr: 'chien' },
  { c: '猫', fr: 'chat' },
  { c: '魚', fr: 'poisson' },
  { c: '鳥', fr: 'oiseau' },
  { c: '虫', fr: 'insecte' },
  { c: '馬', fr: 'cheval' },
  { c: '蛇', fr: 'serpent' }, // le clin d'œil : c'est le nom du jeu

  // Le corps
  { c: '手', fr: 'main' },
  { c: '目', fr: 'œil' },
  { c: '口', fr: 'bouche' },
  { c: '耳', fr: 'oreille' },
  { c: '足', fr: 'pied' },
  { c: '心', fr: 'cœur' },

  // Le quotidien
  { c: '米', fr: 'riz' },
  { c: '茶', fr: 'thé' },
  { c: '本', fr: 'livre' },
  { c: '車', fr: 'voiture' },
  { c: '家', fr: 'maison' },
  { c: '人', fr: 'personne' },
  { c: '子', fr: 'enfant' },
  { c: '友', fr: 'ami' },

  // Les contraires, faciles à retenir par paires
  { c: '大', fr: 'grand' },
  { c: '小', fr: 'petit' },
  { c: '上', fr: 'haut' },
  { c: '下', fr: 'bas' },
  { c: '力', fr: 'force' },
]

export function kanjiAuHasard() {
  return KANJI[(Math.random() * KANJI.length) | 0]
}

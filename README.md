# HEBI 蛇

**En ligne : https://hebi-snake.vercel.app**

Snake franco-japonais, installable sur iPhone et Android, **jouable hors-ligne**.
Grille 17×17, canvas interpolé à 60 fps, swipes enchaînables, sons WebAudio synthétiques.

Le jeu lui-même ne dépend de rien : ton record vit dans le `localStorage` du
téléphone et la partie tourne en mode avion. Seul le **classement mondial**
parle à un serveur, et son absence n'empêche jamais de jouer.

## Lancer en local

```bash
npm install
npm run dev
```

Le service worker est actif en dev (`devOptions.enabled`), ce qui permet de tester
le mode hors-ligne sans passer par un build : couper le réseau dans les DevTools
et recharger.

## Builder

```bash
npm run build      # → dist/
npm run preview    # sert dist/ en local, sur le vrai service worker
```

## Icônes

Les PNG ne sont pas édités à la main, ils sont **générés** :

```bash
npm run icons
```

Le script construit un SVG (kanji 蛇 blanc sur disque rouge, fond encre) et le
rasterise en 192, 512, maskable 512 et apple-touch-icon 180. Le kanji est un
tracé vectoriel extrait de Noto Sans JP (OFL), pas un `<text>` : l'icône ne
dépend d'aucune police installée.

## Déployer

Le dépôt est relié au projet Vercel `hebi-snake` : chaque push sur `main`
déploie en production.

```bash
git push
```

⚠️ La protection « Vercel Authentication » est **désactivée** sur ce projet.
C'est indispensable : activée (c'est le défaut sur les nouveaux projets), elle
renvoie un 302 vers la page de connexion Vercel pour tout le monde, et l'app
devient impossible à installer sur un téléphone.

## Le classement

Un joueur = un pseudo unique + un code à 4 chiffres. Le code n'est pas un mot de
passe : il sert à retrouver son nom sur un autre téléphone, et à empêcher
d'écrire un score sous le nom de quelqu'un d'autre. Il est stocké haché.

Le nom n'est demandé qu'à la fin d'une partie **qui entre dans le top 20**,
comme sur une borne. Le reste du temps on joue sans rien saisir.

- `GET  /api/classement` → les 20 meilleurs + le record mondial
- `POST /api/compte` → `{ action: 'creer' | 'retrouver', pseudo, code }`
- `POST /api/score` → `{ pseudo, code, score }`, ne garde que le meilleur

**Le jeu reste jouable hors-ligne.** Seul le classement demande le réseau : s'il
est injoignable, la partie se déroule normalement et le score est mis en file,
réémis au retour du réseau. Comme le serveur ne retient que le meilleur score,
réémettre deux fois la même partie est sans conséquence.

Garde-fous contre les scores fantaisistes : le score doit être un multiple de 10,
positif, et sous le maximum théorique du plateau (2860 = 286 bouchées × 10). La
contrainte est posée **dans la base**, pas seulement dans le code. Ça reste un jeu
public sans authentification forte : quelqu'un de déterminé peut envoyer un score
qu'il n'a pas fait, dans la limite du plafond.

### Base

Neon Postgres, une seule table (`api/_lib/schema.sql`). L'unicité des pseudos est
tenue par la **clé primaire** sur le pseudo normalisé — accents et casse
confondus — et pas par un `select` préalable qui laisserait passer deux
inscriptions simultanées.

```bash
DATABASE_URL='postgres://…' npm run migrate
```

## Contrôles

```bash
npm run build      # doit passer sans erreur ni warning
npm run lint
npm run verifie          # Playwright : iPhone SE + grand écran, sur dist/
npm run verifie <url>    # ... ou sur la prod
npm run test-classement  # logique du classement sur un vrai Postgres (PGlite)
npm run test-parcours    # parcours joueur complet : jouer → mourir → nom → tableau
npm run local            # dist/ + les routes /api sur un Postgres en mémoire
```

`npm run local` et `npm run test-parcours` font tourner **les mêmes fichiers**
`api/*.js` que ceux déployés, sur un Postgres local : pas de Neon, pas de réseau,
pas de Vercel, et pourtant c'est bien le code de production qui est exercé.

Audit Lighthouse (v11, mobile) : **PWA 100**, performance 99, bonnes pratiques 100.
La v12 de Lighthouse a supprimé la catégorie PWA, il faut donc `lighthouse@11`
pour retrouver `installable-manifest` et `maskable-icon`.

Le mode hors-ligne, lui, n'est pas vérifié par Lighthouse mais par
`npm run verifie`, qui coupe réellement le réseau et recharge la page.

## Ce qui rend le hors-ligne réel

- Les polices (Press Start 2P, Space Grotesk) sont **self-hostées** dans
  `public/fonts`, pas chargées depuis Google Fonts.
- Le service worker précache **tout** : HTML, JS, CSS, polices, icônes.
- Après la première visite, **jouer** ne déclenche plus aucune requête. Les seuls
  appels réseau vont à `/api`, pour le classement, et ils échouent sans bruit.

## Structure

```
api/classement.js        GET  : les 20 meilleurs + le record mondial
api/compte.js            POST : créer ou retrouver un pseudo
api/score.js             POST : enregistrer un score
api/_lib/logique.js      validation + requêtes (le « _ » exclut le dossier des routes)
api/_lib/schema.sql      la table, et les contraintes qui tiennent les scores
api/_lib/db.js           connexion Neon, et la couture qui permet de tester en local
public/fonts/            polices woff2 (latin + latin-ext)
public/icons/            PNG générés par npm run icons
src/HebiSnake.jsx        le jeu
src/Classement.jsx       le tableau des meilleurs scores
src/SaisieNom.jsx        l'écran « ENTREZ VOTRE NOM »
src/api.js               client du classement + file d'attente hors-ligne
src/InstallPrompt.jsx    encart « Installer l'app » (Android) / geste iOS
src/index.css            Tailwind, @font-face, safe-areas, blocage du scroll
vite.config.js           React + Tailwind v4 + vite-plugin-pwa (manifest inclus)
```

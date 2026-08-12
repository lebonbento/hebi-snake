# HEBI 蛇

Snake franco-japonais, installable sur iPhone et Android, **jouable hors-ligne**.
Grille 17×17, canvas interpolé à 60 fps, swipes enchaînables, sons WebAudio synthétiques.

Aucun serveur, aucune base de données : le record vit dans le `localStorage` du téléphone.

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

Le projet est lié à Vercel : tout push sur `main` déclenche un déploiement de
production.

```bash
git push
```

Un déploiement manuel reste possible avec `npx vercel --prod`.

## Ce qui rend le hors-ligne réel

- Les polices (Press Start 2P, Space Grotesk) sont **self-hostées** dans
  `public/fonts`, pas chargées depuis Google Fonts.
- Le service worker précache **tout** : HTML, JS, CSS, polices, icônes.
- Après la première visite, l'app ne fait plus une seule requête réseau.

## Structure

```
public/fonts/            polices woff2 (latin + latin-ext)
public/icons/            PNG générés par npm run icons
scripts/generate-icons.mjs
src/HebiSnake.jsx        le jeu
src/InstallPrompt.jsx    encart « Installer l'app » (Android) / geste iOS
src/index.css            Tailwind, @font-face, safe-areas, blocage du scroll
vite.config.js           React + Tailwind v4 + vite-plugin-pwa (manifest inclus)
```

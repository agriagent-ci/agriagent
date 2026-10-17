/**
 * Aperçu HTML de l'écran de vérification, à partir du composant RÉEL et de la feuille
 * de styles réellement construite (dist/assets/index-*.css).
 *
 * Ce n'est PAS une capture d'écran : le VPS n'a ni navigateur ni outil de capture
 * (chromium ne démarre pas, pas de sudo). C'est le rendu figé du composant, à ouvrir
 * dans un navigateur pour voir l'écran tel qu'il s'affiche.
 *
 * Usage : npx tsx --tsconfig tsconfig.json scripts/apercu-verification.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

// Pas de faux `window` : framer-motion (utilisé par cet écran) a besoin d'un vrai
// environnement navigateur ou d'aucun du tout, pas d'un objet partiel. Sans `window`,
// il prend son chemin de rendu serveur et l'écran se rend correctement.
const EMAIL_AFFICHE = 'test2@agriagent.com';
const FICHIER = process.argv[2] ?? '/home/hermes/apercu-verification.html';

async function main() {
  const { AuthProvider } = await import('../src/contexts/AuthContext');
  const { VerificationScreen } = await import('../src/screens/auth/VerificationScreen');

  const ecran = renderToStaticMarkup(
    createElement(AuthProvider, null,
      createElement(VerificationScreen, { onBack: () => {}, emailInitial: EMAIL_AFFICHE }))
  );

  const dossier = join(process.cwd(), 'dist', 'assets');
  const css = readdirSync(dossier).find((f) => f.endsWith('.css'));
  if (!css) throw new Error('aucun CSS construit dans dist/assets');
  const feuille = readFileSync(join(dossier, css), 'utf8');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Aperçu — vérification par code AgriAgent</title>
<style>${feuille}</style>
<style>
  body { margin: 0; background: #fafaf9; }
  .note { max-width: 430px; margin: 0 auto; padding: 14px 16px 0; font-size: 12px; line-height: 1.45;
          color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; }
  .note code { background: #d1fae5; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
  <div class="note">
    Aperçu figé du composant <code>VerificationScreen</code> avec la feuille de styles de
    l'application — <strong>pas une capture d'écran</strong> (le serveur n'a pas de navigateur).
    Sur l'application en ligne, le champ est actif : le producteur tape les chiffres reçus
    par email puis appuie sur « Valider ».
  </div>
  ${ecran}
</body>
</html>
`;

  writeFileSync(FICHIER, html, 'utf8');
  console.log(`aperçu écrit : ${FICHIER} (${(html.length / 1024).toFixed(0)} Ko)`);
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});

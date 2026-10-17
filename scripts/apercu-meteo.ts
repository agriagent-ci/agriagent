/**
 * Fabrique un aperçu HTML de la page météo à partir des composants RÉELS et des données
 * du jour, avec la feuille de styles réellement construite (dist/assets/index-*.css).
 *
 * Pourquoi : le VPS n'a ni navigateur ni outil de capture d'écran (pas de sudo, chromium
 * ne démarre pas). Ce fichier n'est donc PAS une capture d'écran : c'est le rendu figé du
 * composant, à ouvrir dans un navigateur pour voir la page telle qu'elle s'affiche.
 *
 * Usage : npx tsx --tsconfig tsconfig.json scripts/apercu-meteo.ts [base] [fichier]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PrevisionsMeteo } from '../src/screens/culture/PrevisionsMeteo';
import { MeteoDuJour } from '../src/screens/dashboard/MeteoDuJour';
import { chargerPrevisions } from '../src/lib/meteo-previsions';

(globalThis as unknown as { React: typeof React }).React = React;

const BASE = process.argv[2] ?? 'http://127.0.0.1:8080/api';
const FICHIER = process.argv[3] ?? '/home/hermes/apercu-meteo.html';
const PARCELLE = '00000000-0000-4000-a000-000000000002';

function feuilleDeStyles(): string {
  const dossier = join(process.cwd(), 'dist', 'assets');
  const fichier = readdirSync(dossier).find((f) => f.endsWith('.css'));
  if (!fichier) throw new Error('aucun CSS construit dans dist/assets');
  return readFileSync(join(dossier, fichier), 'utf8');
}

async function main() {
  const donnees = await chargerPrevisions(PARCELLE, 5, BASE);
  if (!donnees.disponible) throw new Error(`données indisponibles : ${donnees.message}`);

  const cartes = renderToStaticMarkup(
    createElement(PrevisionsMeteo, { parcelleId: PARCELLE, jours: 5, donneesInitiales: donnees })
  );
  const mini = renderToStaticMarkup(
    createElement(MeteoDuJour, { parcelleId: PARCELLE, donneesInitiales: donnees, onOuvrirMeteo: () => {} })
  );

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Aperçu — météo AgriAgent</title>
<style>${feuilleDeStyles()}</style>
<style>
  body { background: #fafaf9; margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
  .cadre { max-width: 430px; margin: 0 auto; padding: 16px; }
  .bandeau { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px;
             padding: 10px 12px; font-size: 12px; line-height: 1.45; margin-bottom: 16px; }
  .etiquette { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #78716c; margin: 18px 0 8px; }
</style>
</head>
<body>
  <div class="cadre">
    <p class="etiquette">Aperçu figé — composants réels, données du ${new Date().toLocaleDateString('fr-FR')}</p>
    <div class="bandeau">
      Ce fichier est le <strong>rendu réel</strong> des composants <code>MeteoDuJour</code> et
      <code>PrevisionsMeteo</code> avec la feuille de styles de l'application — pas une capture
      d'écran (le serveur n'a pas de navigateur). La page en ligne, elle, est interactive :
      cliquez sur la mini-carte pour ouvrir l'onglet Météo.
    </div>

    <p class="etiquette">Écran Accueil — mini-carte météo</p>
    ${mini}

    <p class="etiquette">Onglet Météo — 5 prochains jours</p>
    ${cartes}
  </div>
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

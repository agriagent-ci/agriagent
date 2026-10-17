/**
 * Rend réellement les cartes de diagnostic en HTML, avec les 9 lignes de la base,
 * pour prouver que l'onglet « Diag. » ne plante plus.
 *
 * Usage : npx tsx scripts/test-render-diagnostic.tsx
 *
 * - contre-épreuve : rend la valeur brute (diag.hypotheses) et vérifie que React
 *   lève bien « Objects are not valid as a React child » — c'est le bug d'origine.
 * - correction : rend <DiagnosticCard /> pour chacune des lignes et vérifie que
 *   le HTML sort sans exception, avec le bon contenu.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Diagnostic } from '../src/types/database';

// Le projet compile en JSX automatique (tsconfig.app.json) ; tsx, lancé hors du
// build Vite, utilise le JSX classique. On expose donc React globalement avant
// d'importer les composants, sinon « React is not defined ».
(globalThis as unknown as { React: typeof React }).React = React;

const { DiagnosticCard } = await import('../src/screens/culture/DiagnosticCard');

const env = Object.fromEntries(
  readFileSync('/home/hermes/agriagent-backend/.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const reponse = await fetch(
  `${env.SUPABASE_URL}/rest/v1/diagnostics?select=*&order=date_diagnostic.desc,id.desc`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
);
if (!reponse.ok) {
  console.error(`ÉCHEC : lecture des diagnostics impossible (HTTP ${reponse.status})`);
  process.exit(1);
}
const lignes = (await reponse.json()) as Diagnostic[];
console.log(`${lignes.length} diagnostics lus dans Supabase\n`);

const obsReponse = await fetch(`${env.SUPABASE_URL}/rest/v1/observations?select=*`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const observations = obsReponse.ok
  ? ((await obsReponse.json()) as Observation[])
  : [];

// --- contre-épreuve : le bug d'origine ------------------------------------
const exemple = lignes[0];
console.log('=== contre-épreuve : rendu BRUT de hypotheses (avant correction) ===');
console.log(`  type en base : ${Array.isArray(exemple.hypotheses) ? 'tableau' : typeof exemple.hypotheses}`);
try {
  renderToStaticMarkup(React.createElement('span', null, exemple.hypotheses as never));
  console.log('  → pas d’exception (la valeur ne contenait peut-être que des chaînes)');
} catch (e) {
  console.log(`  → React lève : ${(e as Error).message.slice(0, 130)}`);
  console.log('    c’est exactement ce qui laissait l’onglet « Diag. » vide.');
}

// --- correction -----------------------------------------------------------
console.log('\n=== rendu des cartes corrigées ===');
let echecs = 0;
for (const [i, ligne] of lignes.entries()) {
  try {
    const html = renderToStaticMarkup(
      React.createElement(DiagnosticCard, {
        diagnostic: ligne,
        observation: observations.find((o) => o.id === ligne.observation_id) ?? null,
        idx: i,
      })
    );
    const maladies = (html.match(/Maladie probable/g) ?? []).length;
    const actions = (html.match(/À faire cette semaine/g) ?? []).length;
    const bandeaux = (html.match(/Rien d’inquiétant|À surveiller|Action urgente/g) ?? []).length;
    const date = new Date(ligne.date_diagnostic).toLocaleDateString('fr-FR');
    const ok = html.includes('Mon diagnostic du') && !html.includes('[object Object]');
    console.log(
      `  ${ok ? '✔' : '✘'} ${date.padEnd(11)} ${String(html.length).padStart(6)} car. · bandeau:${bandeaux} maladies:${maladies} actions:${actions}`
    );
    if (!ok) echecs++;
  } catch (e) {
    console.log(`  ✘ ligne ${ligne.id} : ${(e as Error).message.slice(0, 140)}`);
    echecs++;
  }
}

console.log(`\n${echecs === 0 ? `✔ Les ${lignes.length} cartes s'affichent sans erreur` : `✘ ${echecs} carte(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

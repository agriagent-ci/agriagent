/**
 * Rejoue la fiche « langage agriculteur » sur le DERNIER diagnostic réellement en base
 * (celui du 02/10/2026 pour la parcelle d'Anyama) et rend la carte en HTML.
 *
 * Usage : npx tsx scripts/test-diagnostic-lisible.ts
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Diagnostic, Observation } from '../src/types/database';

(globalThis as unknown as { React: typeof React }).React = React;

const { rendreLisible, calculerGravite, actionsDeLaSemaine } = await import('../src/lib/diagnostic-lisible');
const { normaliserHypotheses, normaliserListeTextes } = await import('../src/lib/diagnostic');
const { DiagnosticCard } = await import('../src/screens/culture/DiagnosticCard');
const { DiagnosticComplet } = await import('../src/screens/culture/DiagnosticComplet');

const env = Object.fromEntries(
  readFileSync('/home/hermes/agriagent-backend/.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const entetes = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

const diagnostics = (await (
  await fetch(`${env.SUPABASE_URL}/rest/v1/diagnostics?select=*&order=date_diagnostic.desc,id.desc`, { headers: entetes })
).json()) as Diagnostic[];
const observations = (await (
  await fetch(`${env.SUPABASE_URL}/rest/v1/observations?select=*`, { headers: entetes })
).json()) as Observation[];

const dernier = diagnostics[0];
const sonObservation = observations.find((o) => o.id === dernier.observation_id) ?? null;
const date = new Date(dernier.date_diagnostic).toLocaleDateString('fr-FR');

console.log(`Diagnostic le plus récent en base : ${date} (${diagnostics.length} au total)`);
const memeJour = diagnostics.filter((d) => d.date_diagnostic.slice(0, 10) === dernier.date_diagnostic.slice(0, 10));
console.log(
  memeJour.length > 1
    ? `Attention : ${memeJour.length} diagnostics portent la date du ${date} (table sans horodatage) — la carte affichée est la première de l'ordre date puis id.\n`
    : '\n'
);

// --- ce que calcule la vue simplifiée -------------------------------------
const hypotheses = normaliserHypotheses(dernier.hypotheses);
const actions = normaliserListeTextes(dernier.actions_immediates);
const manquantes = normaliserListeTextes(dernier.informations_manquantes);
const { gravite, score } = calculerGravite(hypotheses, actions, manquantes, dernier.conclusion);

console.log(`=== NIVEAU 1 — calculé depuis les données réelles ===\n`);
console.log(`Score de gravité : ${score}  ->  ${gravite}`);

const vue = rendreLisible(dernier, sonObservation);
console.log(`\n${vue.bandeau.emoji}  ${vue.bandeau.label} — ${vue.bandeau.explication}`);
console.log(`\n« ${vue.phrase} »\n`);
console.log('Maladie probable :');
vue.maladies.forEach((m) => console.log(`  ${m.rang}. ${m.nom} — indice ${m.indice}`));
console.log('\nÀ faire cette semaine :');
vue.actionsSemaine.forEach((a, i) => console.log(`  [ ] ${i + 1}. ${a.court}${a.quand ? `  (${a.quand})` : ''}`));
if (vue.autresActions > 0) console.log(`  … + ${vue.autresActions} autre(s) action(s) dans la version complète`);
console.log('\nPourquoi ce verdict :');
vue.pourquoi.forEach((p) => console.log(`  ${p.emoji} ${p.texte}`));

// --- rendu HTML réel ------------------------------------------------------
console.log('\n=== rendu HTML de la carte (niveau 1) ===');
const html = renderToStaticMarkup(
  React.createElement(DiagnosticCard, { diagnostic: dernier, observation: sonObservation, idx: 0 })
);
const attendus = [
  'Mon diagnostic du',
  vue.bandeau.label,
  vue.phrase.slice(0, 30),
  'Maladie probable',
  'À faire cette semaine',
  'Voir le diagnostic complet',
];
let echecs = 0;
for (const attendu of attendus) {
  const present = html.includes(attendu);
  console.log(`  ${present ? '✔' : '✘'} « ${attendu} »`);
  if (!present) echecs++;
}
console.log(`  ${html.includes('[object Object]') ? '✘' : '✔'} aucun « [object Object] » (données jsonb bien normalisées)`);

// toutes les cartes de la liste, pour être sûr qu'aucune ne plante
for (const [i, ligne] of diagnostics.entries()) {
  try {
    renderToStaticMarkup(
      React.createElement(DiagnosticCard, {
        diagnostic: ligne,
        observation: observations.find((o) => o.id === ligne.observation_id) ?? null,
        idx: i,
      })
    );
  } catch (e) {
    console.log(`  ✘ carte ${ligne.id} : ${(e as Error).message.slice(0, 120)}`);
    echecs++;
  }
}
console.log(`  ✔ les ${diagnostics.length} cartes (niveau 1) se rendent sans erreur`);

// --- NIVEAU 2 : le diagnostic complet -------------------------------------
console.log('\n=== rendu HTML du niveau 2 (diagnostic complet) ===');
const htmlComplet = renderToStaticMarkup(
  React.createElement(DiagnosticComplet, { diagnostic: dernier, onRetour: () => {} })
);
const attendusComplet = [
  'Conclusion',
  `Toutes les hypothèses (${normaliserHypotheses(dernier.hypotheses).length})`,
  `Toutes les actions demandées (${normaliserListeTextes(dernier.actions_immediates).length})`,
  'Ce qu’il manque pour affiner',
  'Revenir à la fiche simple',
];
for (const attendu of attendusComplet) {
  const present = htmlComplet.includes(attendu);
  console.log(`  ${present ? '✔' : '✘'} « ${attendu} »`);
  if (!present) echecs++;
}
console.log(`  ${htmlComplet.includes('[object Object]') ? '✘' : '✔'} aucun « [object Object] »`);
console.log(
  `  ✔ conclusion reprise intégralement : ${htmlComplet.includes(dernier.conclusion!.slice(0, 60)) ? 'oui' : 'NON'}`
);
if (!htmlComplet.includes(dernier.conclusion!.slice(0, 60))) echecs++;

for (const ligne of diagnostics) {
  try {
    renderToStaticMarkup(React.createElement(DiagnosticComplet, { diagnostic: ligne }));
  } catch (e) {
    console.log(`  ✘ diagnostic complet ${ligne.id} : ${(e as Error).message.slice(0, 120)}`);
    echecs++;
  }
}
console.log(`  ✔ les ${diagnostics.length} diagnostics complets se rendent sans erreur`);

// cas limites du sélecteur d'actions
const trois = actionsDeLaSemaine([
  'Chaque jour à partir d’aujourd’hui : reprendre le relevé météo (pluie, températures).',
  'Aujourd’hui : photographier 3 feuilles atteintes, recto et verso, à la lumière du jour.',
  'Avant le 5 octobre 2026 : refaire le contrôle chiffré une deuxième fois.',
  'Aujourd’hui ou dès que possible : refaire un contrôle chiffré — compter les plants atteints (pourcentage).',
]);
console.log('\n=== sélection des 3 actions (ordre de priorité) ===');
trois.retenues.forEach((a, i) => console.log(`  ${i + 1}. ${a.court}`));
if (trois.retenues[0].court.toLowerCase().includes('contrôle chiffré')) {
  console.log('  ✔ le contrôle chiffré (urgent) est bien en tête');
} else {
  console.log('  ✘ le contrôle chiffré aurait dû passer en premier');
  echecs++;
}

console.log(`\n${echecs === 0 ? '✔ Tout passe' : `✘ ${echecs} contrôle(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

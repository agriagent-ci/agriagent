/**
 * Vérification météo en continu, avec le VRAI code du frontend.
 *
 *   1. interroge l'API AgriAgent (parcelle démo avec GPS, puis parcelle test1 sans GPS) ;
 *   2. passe les données aux fonctions de traduction du frontend ;
 *   3. rend réellement les composants <PrevisionsMeteo> et <MeteoDuJour> hors navigateur
 *      (react-dom/server) et relit le texte produit ;
 *   4. vérifie les règles demandées : 5 cartes, message « ne traitez pas aujourd'hui »
 *      quand il pleut et que la maladie est active, repli clair sans coordonnées GPS.
 *
 * Usage : npx tsx --tsconfig tsconfig.json scripts/test-meteo-previsions.ts [base]
 */
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx (esbuild) compile le JSX en React.createElement même si le projet utilise le runtime
// automatique : on expose React globalement pour que le rendu des composants fonctionne ici.
(globalThis as unknown as { React: typeof React }).React = React;

import { PrevisionsMeteo } from '../src/screens/culture/PrevisionsMeteo';
import { MeteoDuJour } from '../src/screens/dashboard/MeteoDuJour';
import {
  chargerPrevisions,
  conseilDuMoment,
  conseilPrevision,
  emojiDuCode,
  libelleJour,
  nomDuJour,
  type PrevisionsMeteo as DonneesMeteo,
} from '../src/lib/meteo-previsions';

// Base de l'API : le préfixe /api est celui du proxy du serveur statique (et du déploiement).
const BASE = process.argv[2] ?? 'http://127.0.0.1:8080/api';
const PARCELLE_ANYAMA = '00000000-0000-4000-a000-000000000002';
const PARCELLE_SANS_GPS = 'd0c3e682-4ed2-4db0-8d48-5f6206a89e76';

let echecs = 0;
function verifier(condition: boolean, libelle: string, detail = '') {
  console.log(`  ${condition ? '✔' : '✘'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!condition) echecs += 1;
}

/** Retire les balises pour ne garder que le texte visible, tel qu'il apparaît à l'écran. */
function texteVisible(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(`API : ${BASE}\n`);

  // ── 1. Parcelle avec GPS ───────────────────────────────────────────────────────────────
  console.log('══ 1. Parcelle d\'Anyama (coordonnées GPS présentes) ══');
  const donnees: DonneesMeteo = await chargerPrevisions(PARCELLE_ANYAMA, 5, BASE);
  verifier(donnees.disponible === true, 'l\'API répond avec des prévisions', donnees.message ?? '');
  verifier((donnees.previsions ?? []).length === 5, '5 jours de prévisions', `${(donnees.previsions ?? []).length} reçus`);
  verifier(donnees.maladie?.active === true, 'maladie active détectée par le serveur',
    `diagnostic ${donnees.maladie?.diagnostic_recent?.date_diagnostic?.slice(0, 10) ?? 'aucun'}, ` +
    `${donnees.maladie?.observations_recentes_21j} symptôme(s) sur 21 jours`);

  console.log('\n  ── ce que le producteur lit dans les 5 cartes (rendu des fonctions du frontend) ──');
  const aujourdhui = new Date(`${donnees.actuel ? new Date().toISOString().slice(0, 10) : ''}T12:00:00Z`);
  (donnees.previsions ?? []).forEach((p, i) => {
    const c = conseilPrevision(p, i, donnees.maladie?.active ?? false, aujourdhui);
    const pluie = Number(p.pluie_mm) > 0 ? `${p.pluie_mm} mm` : 'pas de pluie';
    console.log(`  ${emojiDuCode(p.code_meteo)} ${libelleJour(p.jour, i, aujourdhui)} (${nomDuJour(p.jour)} ` +
      `${p.jour.slice(8, 10)}/${p.jour.slice(5, 7)})  ${Number(p.temp_min_c).toFixed(0)}/${Number(p.temp_max_c).toFixed(0)} °C · ${pluie}`);
    console.log(`     → ${c.phrase}`);
  });

  const conseilSousPluie = (donnees.previsions ?? [])[0];
  const pluieAujourdhui = Number(conseilSousPluie?.pluie_mm ?? 0);
  console.log('');
  verifier(
    pluieAujourdhui < 5 || texteDeLaCarte(donnees, 0).includes('Ne traitez pas'),
    'règle « pluie > 5 mm + maladie active → ne pas traiter »',
    `pluie du jour ${pluieAujourdhui} mm`
  );

  function texteDeLaCarte(d: DonneesMeteo, position: number): string {
    const p = (d.previsions ?? [])[position];
    return conseilPrevision(p, position, d.maladie?.active ?? false, aujourdhui).phrase;
  }

  // ── 2. Rendu réel des composants ───────────────────────────────────────────────────────
  console.log('\n══ 2. Rendu réel des composants (react-dom/server) ══');
  const htmlCartes = renderToStaticMarkup(
    createElement(PrevisionsMeteo, { parcelleId: PARCELLE_ANYAMA, jours: 5, donneesInitiales: donnees })
  );
  const texteCartes = texteVisible(htmlCartes);
  verifier(htmlCartes.includes('Les 5 prochains jours'), 'le titre « Les 5 prochains jours » est rendu');
  verifier(texteCartes.includes('Demain'), 'la carte de demain est rendue');
  verifier(/Dans \d jours/.test(texteCartes), 'les jours d\'après sont nommés « Dans N jours »');
  verifier((htmlCartes.match(/mm/g) ?? []).length >= 3, 'les cumuls de pluie apparaissent dans les cartes');
  verifier(!/g\/L|kg\/ha|ml\/L|mg\/L/i.test(texteCartes), 'aucune dose chiffrée dans les conseils');
  console.log('\n  ── texte du composant des 5 cartes ──');
  console.log(`  ${texteCartes}`);

  const htmlMini = renderToStaticMarkup(
    createElement(MeteoDuJour, { parcelleId: PARCELLE_ANYAMA, donneesInitiales: donnees, onOuvrirMeteo: () => {} })
  );
  const texteMini = texteVisible(htmlMini);
  const attenduMini = conseilDuMoment(donnees.actuel, donnees.maladie?.active ?? false);
  verifier(htmlMini.includes(emojiDuCode(donnees.actuel?.code_meteo)), 'la mini-carte affiche l\'icône du temps');
  verifier(texteMini.includes('°C'), 'la mini-carte affiche la température');
  verifier(texteMini.includes(attenduMini.phrase.slice(0, 30)), 'la mini-carte reprend la phrase du moment');
  verifier(texteMini.includes('Météo'), 'la mini-carte propose le lien vers l\'onglet Météo');
  const miniSansLien = renderToStaticMarkup(
    createElement(MeteoDuJour, { parcelleId: PARCELLE_ANYAMA, donneesInitiales: donnees })
  );
  verifier(!texteVisible(miniSansLien).includes('Météo'), 'sans action branchée, aucun faux lien n\'est affiché');
  console.log('\n  ── mini-carte d\'accueil ──');
  console.log(`  ${texteMini}`);

  // ── 3. Repli sans coordonnées GPS ──────────────────────────────────────────────────────
  console.log('\n══ 3. Parcelle sans coordonnées GPS (compte test1) ══');
  const sansGps = await chargerPrevisions(PARCELLE_SANS_GPS, 5, BASE);
  verifier(sansGps.disponible === false, 'l\'API répond disponible:false');
  verifier(sansGps.raison === 'coordonnees_absentes', 'la raison est explicite', String(sansGps.raison));
  const htmlSansGps = renderToStaticMarkup(
    createElement(PrevisionsMeteo, { parcelleId: PARCELLE_SANS_GPS, jours: 5, donneesInitiales: sansGps })
  );
  const miniSansGps = renderToStaticMarkup(
    createElement(MeteoDuJour, { parcelleId: PARCELLE_SANS_GPS, donneesInitiales: sansGps })
  );
  verifier(texteVisible(htmlSansGps).includes('Prévisions indisponibles'), 'l\'onglet Météo explique l\'absence');
  verifier(texteVisible(htmlSansGps).includes('GPS'), 'le message parle bien des coordonnées GPS');
  verifier(texteVisible(miniSansGps).includes('Météo indisponible'), 'la mini-carte le signale aussi');
  console.log('\n  ── message affiché au producteur ──');
  console.log(`  ${texteVisible(htmlSansGps)}`);

  // ── 4. Règle de pluie, cas forcé (indépendant de la météo du jour) ─────────────────────
  console.log('\n══ 4. Règle « ne traitez pas aujourd\'hui » (cas forcé) ══');
  const jourPluvieux = {
    jour: new Date().toISOString().slice(0, 10),
    code_meteo: 63,
    temp_min_c: 23,
    temp_max_c: 29,
    pluie_mm: 8,
    proba_pluie_pct: 95,
    vent_max_kmh: 12,
    et0_mm: 3.5,
  };
  const avecMaladie = conseilPrevision(jourPluvieux, 0, true);
  const sansMaladie = conseilPrevision(jourPluvieux, 0, false);
  verifier(avecMaladie.bloqueTraitement === true, 'pluie 8 mm + maladie → traitement bloqué');
  verifier(avecMaladie.phrase.includes('Ne traitez pas aujourd\'hui'), 'la phrase est bien celle demandée', avecMaladie.phrase);
  verifier(sansMaladie.bloqueTraitement !== true, 'sans maladie active, pas de blocage');
  console.log(`  maladie active → ${avecMaladie.phrase}`);
  console.log(`  sans maladie  → ${sansMaladie.phrase}`);

  console.log(`\n══ Résultat : ${echecs === 0 ? 'toutes les vérifications passent' : `${echecs} échec(s)`} ══`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});

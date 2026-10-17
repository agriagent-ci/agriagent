/**
 * Vérifie le moteur de « Conseil du jour » sur des cas réels et limites.
 *
 * Usage : node scripts/test-meteo-conseil.mjs
 *
 * Le script compile src/lib/meteo-conseil.ts (TypeScript) vers scripts/.build,
 * puis rejoue le moteur sur les 8 relevés réels de la parcelle d'Anyama et sur
 * quatre cas limites. Aucun accès réseau : aucune donnée n'est envoyée nulle part.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..');
const sortie = resolve(ici, '.build');

rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

execFileSync(
  process.execPath,
  [
    resolve(racine, 'node_modules/typescript/bin/tsc'),
    resolve(racine, 'src/lib/meteo-conseil.ts'),
    '--outDir', sortie,
    '--module', 'esnext',
    '--target', 'es2020',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' }
);

const { getConseilDuJour, describeJour, pluieSur } = await import(
  resolve(sortie, 'lib/meteo-conseil.js')
);

/** Les 8 relevés réellement en base pour la parcelle d'Anyama (20 -> 27 sept. 2026). */
const REELS = [
  { jour: '2026-09-20', pluie_mm: 0.9, temp_max_c: 28.9, temp_moyenne_c: 25.6, rh_moyenne_pct: 82, heures_rh_90: 2 },
  { jour: '2026-09-21', pluie_mm: 1.7, temp_max_c: 27.9, temp_moyenne_c: 25.2, rh_moyenne_pct: 86, heures_rh_90: 7 },
  { jour: '2026-09-22', pluie_mm: 1.8, temp_max_c: 28.1, temp_moyenne_c: 25.3, rh_moyenne_pct: 86, heures_rh_90: 12 },
  { jour: '2026-09-23', pluie_mm: 1.1, temp_max_c: 28.6, temp_moyenne_c: 25.2, rh_moyenne_pct: 85, heures_rh_90: 10 },
  { jour: '2026-09-24', pluie_mm: 1.3, temp_max_c: 28.5, temp_moyenne_c: 25.3, rh_moyenne_pct: 84, heures_rh_90: 10 },
  { jour: '2026-09-25', pluie_mm: 2.1, temp_max_c: 28.3, temp_moyenne_c: 25.3, rh_moyenne_pct: 83, heures_rh_90: 8 },
  { jour: '2026-09-26', pluie_mm: 0.7, temp_max_c: 28.4, temp_moyenne_c: 25.2, rh_moyenne_pct: 83, heures_rh_90: 7 },
  { jour: '2026-09-27', pluie_mm: 2.6, temp_max_c: 28.0, temp_moyenne_c: 25.1, rh_moyenne_pct: 82, heures_rh_90: 6 },
];

const jour = (j, pluie, tempMax, tempMoy, rh, heures) => ({
  jour: j, pluie_mm: pluie, temp_max_c: tempMax, temp_moyenne_c: tempMoy, rh_moyenne_pct: rh, heures_rh_90: heures,
});

const CAS = [
  ['RÉEL — 8 relevés Anyama du 20 au 27/09/2026', REELS],
  ['SEC — 3 jours sans pluie, 27 °C, air sec', [
    jour('2026-10-13', 0, 27.0, 24.0, 60, 0),
    jour('2026-10-14', 0, 28.0, 25.0, 58, 0),
    jour('2026-10-15', 0, 29.0, 26.0, 61, 0),
  ]],
  ['AIR TRÈS HUMIDE — RH 88 %, 26 °C', [jour('2026-10-15', 1.0, 28.0, 26.0, 88, 9)]],
  ['CANICULE — pic à 33 °C', [jour('2026-10-15', 0.4, 33.2, 29.5, 62, 1)]],
  ['GROSSE PLUIE — 25 mm sur 24 h', [jour('2026-10-15', 25.4, 26.0, 24.0, 90, 11)]],
  ['AUCUN RELEVÉ', []],
];

const maintenant = new Date('2026-10-16T02:00:00Z'); // date réelle de la vérification
let echecs = 0;

for (const [titre, meteo] of CAS) {
  console.log(`\n=== ${titre} ===`);
  const conseil = getConseilDuJour(meteo, maintenant);

  if (!conseil) {
    console.log('  → aucun conseil (comportement attendu si la liste est vide)');
    if (meteo.length > 0) { console.log('  ✘ ÉCHEC : un conseil était attendu'); echecs++; }
    continue;
  }

  console.log(`  ${conseil.emoji}  ${conseil.phrase}`);
  console.log(`     ton : ${conseil.ton} · relevé du ${conseil.dateReleve} (${conseil.ageJours} j)`);
  conseil.secondaires.forEach((s) => console.log(`     · ${s}`));
  if (conseil.note) console.log(`     ⚠ ${conseil.note}`);
  if (meteo.length > 1) {
    console.log(`     (pluie 3 derniers jours : ${pluieSur(meteo, 3).toFixed(1)} mm)`);
    console.log(`     résumés : ${meteo.slice(-3).map((m) => `${m.jour.slice(5)} → ${describeJour(m)}`).join(' | ')}`);
  }

  if (!conseil.phrase || /undefined|NaN|\[object/.test(conseil.phrase)) {
    console.log('  ✘ ÉCHEC : phrase invalide'); echecs++;
  }
}

console.log(`\n${echecs === 0 ? '✔ Tous les cas passent' : `✘ ${echecs} cas en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

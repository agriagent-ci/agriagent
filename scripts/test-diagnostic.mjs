/**
 * Vérifie que les colonnes jsonb de `diagnostics` sont bien normalisées avant
 * affichage — c'était la cause de l'onglet « Diag. » vide (React refuse de rendre
 * un objet ; « Objects are not valid as a React child »).
 *
 * Usage : node scripts/test-diagnostic.mjs
 *
 * Les formes testées sont celles réellement trouvées en base (9 lignes du 28/09
 * au 02/10/2026) : hypotheses = objets, sources = objets OU chaînes OU vides,
 * informations_manquantes / actions_immediates = chaînes.
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
    resolve(racine, 'src/lib/diagnostic.ts'),
    '--outDir', sortie,
    '--module', 'esnext',
    '--target', 'es2020',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' }
);

const { normaliserHypotheses, normaliserSources, normaliserListeTextes } = await import(
  resolve(sortie, 'diagnostic.js') // fichier sans import : tsc l'émet à la racine de outDir
);

/** Formes réelles relevées en base. */
const CAS = [
  ['hypotheses (objet, rang numérique)', 'hypotheses',
    [{ rang: 1, motif: 'halo jaunâtre, départ sur feuilles âgées', indice: 'eleve', hypothese: 'cercosporiose (Pseudocercospora fuligena)' }, { rang: 2, hypothese: 'alternariose', indice: 'moyen' }],
    normaliserHypotheses],
  ['hypotheses (rang en texte, clé "nom")', 'hypotheses',
    [{ rang: '1', nom: 'mildiou', motif: 'feutrage blanc au revers', indice: 'eleve' }],
    normaliserHypotheses],
  ['hypotheses (chaîne simple)', 'hypotheses', 'tache foliaire fongique', normaliserHypotheses],
  ['hypotheses (tableau vide)', 'hypotheses', [], normaliserHypotheses],
  ['sources (objets url/titre/apport)', 'sources',
    [{ url: 'https://ephytia.inrae.fr/fr/C/11075/Tomate-Corynesporiose', titre: 'Ephytia INRAE - Corynesporiose', apport: 'Gravité en zones tropicales' }],
    normaliserSources],
  ['sources (URL en chaîne seule)', 'sources',
    ['https://ephytia.inra.fr/fr/C/11076/Tomate-Cercosporiose'],
    normaliserSources],
  ['sources (clés inattendues : "lu")', 'sources',
    [{ lu: 'Lue pendant ce run: petites lesions humides a croissance radiale' }],
    normaliserSources],
  ['sources (tableau vide)', 'sources', [], normaliserSources],
  ['actions_immediates (chaînes)', 'actions_immediates',
    ['Aujourd’hui : compter les plants atteints sur au moins 10 plants', 'Photographier 3 feuilles, recto et verso'],
    normaliserListeTextes],
  ['informations_manquantes (chaînes)', 'informations_manquantes',
    ['photo rapprochée recto et verso des feuilles atteintes'],
    normaliserListeTextes],
  ['valeur nulle', 'actions_immediates', null, normaliserListeTextes],
];

let echecs = 0;
const interdit = /\[object Object\]/;

for (const [titre, champ, brut, normaliser] of CAS) {
  const resultat = normaliser(brut);
  const rendu = JSON.stringify(resultat);
  console.log(`\n=== ${titre} ===`);
  console.log(`  ${champ} brut : ${JSON.stringify(brut)?.slice(0, 90) ?? 'null'}`);
  console.log(`  normalisé   : ${rendu.slice(0, 200)}`);

  const ok =
    Array.isArray(resultat) &&
    !interdit.test(rendu) &&
    resultat.every((e) => typeof e === 'string' || (typeof e === 'object' && e !== null && typeof e.nom === 'string' || typeof e?.titre === 'string'));
  console.log(ok ? '  ✔ rendu sûr pour React' : '  ✘ ÉCHEC : rendu non sûr');
  if (!ok) echecs++;
  if (Array.isArray(brut) && brut.length > 0 && resultat.length === 0) {
    console.log('  ✘ ÉCHEC : données perdues (0 élément normalisé)');
    echecs++;
  }
}

console.log(`\n${echecs === 0 ? '✔ Tous les cas passent' : `✘ ${echecs} cas en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

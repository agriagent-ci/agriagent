/**
 * Test du client de chat de l'app, hors navigateur.
 *
 * Utilise le VRAI code du frontend (`src/lib/chat.ts`, celui qui part dans le bundle) :
 * envoi du message, lecture du flux SSE, reconstruction du texte, métadonnées.
 * Seule la compression d'image n'est pas testable ici (elle utilise canvas/DOM).
 *
 * Usage : npx tsx scripts/test-chat-client.ts
 */
import { readFileSync } from 'node:fs';

const { envoyerMessage } = await import('../src/lib/chat');

const API = process.env.AGRIAGENT_API ?? 'http://127.0.0.1:8080/api';
const CULTURE = '00000000-0000-4000-a000-000000000003';
const PARCELLE = '00000000-0000-4000-a000-000000000002';

let echecs = 0;
const verifier = (ok: boolean, texte: string) => {
  console.log(`  ${ok ? '✔' : '✘'} ${texte}`);
  if (!ok) echecs++;
};

console.log(`API : ${API}\n`);

// ── 1. message simple, en flux ──────────────────────────────────────────────
console.log('=== 1. message texte, réponse en flux ===');
const morceaux: string[] = [];
const debut = Date.now();
let premierMorceau = 0;

const meta = await envoyerMessage({
  message: 'Bonjour, que dois-je surveiller cette semaine sur ma tomate ?',
  parcelleId: PARCELLE,
  cultureId: CULTURE,
  baseApi: API,
  onMorceau: (texte) => {
    if (!premierMorceau) premierMorceau = Date.now() - debut;
    morceaux.push(texte);
  },
});

const texte = morceaux.join('');
console.log(`  durée totale      : ${((Date.now() - debut) / 1000).toFixed(1)} s`);
console.log(`  1er morceau après : ${(premierMorceau / 1000).toFixed(1)} s`);
console.log(`  morceaux reçus    : ${morceaux.length}`);
console.log(`  métadonnées       : confiance=${meta.confiance} vision=${meta.vision} symptôme=${meta.symptome_detecte}`);
console.log(`  coût              : ${JSON.stringify(meta.cout)}`);
console.log(`  texte (200 c.)    : ${texte.slice(0, 200).replace(/\n/g, ' ')}`);

verifier(morceaux.length > 1, 'la réponse arrive bien en plusieurs morceaux (flux)');
verifier(texte.length > 80, 'le texte reconstitué est complet');
verifier(!texte.includes('META'), 'le bloc de métadonnées ne s’affiche pas au producteur');
verifier(['faible', 'moyen', 'eleve'].includes(meta.confiance), `confiance valide (${meta.confiance})`);

// ── 2. message décrivant un symptôme ────────────────────────────────────────
console.log('\n=== 2. symptôme décrit → observation attendue ===');
const morceaux2: string[] = [];
const meta2 = await envoyerMessage({
  message:
    "J'ai remarqué aujourd'hui des taches brunes avec un liseré jaune sur plusieurs feuilles du haut, " +
    "et deux fruits ont une tache noire. Est-ce que je dois traiter ?",
  parcelleId: PARCELLE,
  cultureId: CULTURE,
  baseApi: API,
  onMorceau: (t) => morceaux2.push(t),
});
console.log(`  symptôme détecté  : ${meta2.symptome_detecte}`);
console.log(`  observation_id    : ${meta2.observation_id}`);
console.log(`  réponse (200 c.)  : ${morceaux2.join('').slice(0, 200).replace(/\n/g, ' ')}`);
verifier(meta2.symptome_detecte === true, 'le symptôme est bien détecté');
verifier(Boolean(meta2.observation_id), 'une ligne observations a été créée');

// ── 3. photo sans modèle de vision ─────────────────────────────────────────
console.log('\n=== 3. photo (vision) ===');
const photo = readFileSync('/home/hermes/.hermes/cache/images/img_b932ff16c35b.jpg').toString('base64');
const morceaux3: string[] = [];
const meta3 = await envoyerMessage({
  message: 'Voici une photo de mes plants, qu’en pensez-vous ?',
  photo: {
    base64: photo,
    mediaType: 'image/jpeg',
    octets: photo.length,
    largeur: 0,
    hauteur: 0,
    apercu: `data:image/jpeg;base64,${photo}`,
  },
  parcelleId: PARCELLE,
  cultureId: CULTURE,
  baseApi: API,
  onMorceau: (t) => morceaux3.push(t),
});
const texte3 = morceaux3.join('');
console.log(`  vision utilisée   : ${meta3.vision}`);
console.log(`  message d'avertissement présent : ${texte3.includes('Je ne peux pas encore regarder les photos')}`);
console.log(`  observation_id    : ${meta3.observation_id}`);
console.log(`  réponse (300 c.)  : ${texte3.slice(0, 300).replace(/\n/g, ' ')}`);

verifier(typeof meta3.vision === 'boolean', 'la réponse dit si la vision a servi');
verifier(!texte3.includes('<thought>') && !texte3.includes('META'), 'aucun bloc technique visible');
if (meta3.vision) {
  // Cas normal dès qu'un modèle multimodal est configuré : la photo est lue.
  verifier(
    !texte3.includes('Je ne peux pas encore regarder les photos'),
    'plus aucun avertissement « je ne vois pas la photo »'
  );
  verifier(
    /photo|image|feuille|tache|tomate|plant/i.test(texte3),
    'la réponse parle de ce qui est visible sur la photo'
  );
} else {
  // Repli honnête quand aucun modèle de vision n'est configuré.
  verifier(
    texte3.includes('Je ne peux pas encore regarder les photos'),
    'le producteur est prévenu honnêtement'
  );
  verifier(meta3.observation_id === null, 'aucune observation inventée sans image analysable');
}

console.log(`\n${echecs === 0 ? '✔ Client de chat : tout est bon' : `✘ ${echecs} contrôle(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

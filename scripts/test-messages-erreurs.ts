/**
 * Vérifie la traduction des erreurs d'inscription.
 *
 * Partie 1 (hors ligne) : les charges utiles exactes renvoyées par Postgres/Supabase
 *   doivent donner les phrases demandées.
 * Partie 2 (en vrai, sur la base) : on rejoue l'inscription de l'app avec `supabase-js`
 *   pour provoquer les vraies erreurs (email déjà pris, téléphone déjà pris) et
 *   vérifier le message obtenu par l'utilisateur.
 *
 * Usage : npx tsx scripts/test-messages-erreurs.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { messageErreur, messageErreurInscription, MESSAGE_COMPTE_EXISTANT } from '../src/lib/messages-erreurs';

let echecs = 0;
const verifier = (ok: boolean, texte: string) => {
  console.log(`  ${ok ? '✔' : '✘'} ${texte}`);
  if (!ok) echecs++;
};

const env: Record<string, string> = {};
for (const ligne of readFileSync('/home/hermes/agriagent-backend/.env', 'utf8').split('\n')) {
  if (ligne.includes('=') && !ligne.trim().startsWith('#')) {
    const i = ligne.indexOf('=');
    env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
}

// ── Partie 1 : charges utiles réelles ───────────────────────────────────────
console.log('=== Partie 1 : charges utiles Postgres réelles ===');
const cas: { nom: string; erreur: { code: string; message: string; details?: string }; attendu: string }[] = [
  {
    nom: '23505 telephone',
    erreur: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "agriculteurs_telephone_key"',
      details: 'Key (telephone)=(+225 07 00 00 00 00) already exists.',
    },
    attendu: 'Ce numéro de téléphone est déjà utilisé. Essayez de vous connecter ou utilisez un autre numéro.',
  },
  {
    nom: '23505 email',
    erreur: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "agriculteurs_email_key"',
      details: 'Key (email)=(a@b.com) already exists.',
    },
    attendu: 'Cet email est déjà utilisé. Essayez de vous connecter.',
  },
  {
    nom: '23505 telegram',
    erreur: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "agriculteurs_telegram_user_id_key"',
      details: 'Key (telegram_user_id)=(12345) already exists.',
    },
    attendu: 'Ce compte Telegram est déjà relié à un autre producteur.',
  },
  {
    nom: '23505 sans nom de contrainte',
    erreur: { code: '23505', message: 'duplicate key value violates unique constraint', details: 'Key (telephone)=(+225 07) already exists.' },
    attendu: 'Ce numéro de téléphone est déjà utilisé. Essayez de vous connecter ou utilisez un autre numéro.',
  },
  {
    nom: '23503 (email existant -> uid bouchon)',
    erreur: {
      code: '23503',
      message: 'insert or update on table "agriculteurs" violates foreign key constraint "agriculteurs_auth_user_id_fkey"',
      details: 'Key (auth_user_id)=(00000000-0000-0000-0000-000000000000) is not present in table "users".',
    },
    attendu: 'Cet email est déjà utilisé. Essayez de vous connecter.',
  },
  {
    nom: '42501 (RLS)',
    erreur: {
      code: '42501',
      message: 'new row violates row-level security policy for table "agriculteurs"',
    },
    attendu: "La base de données a refusé l'enregistrement du profil. Signalez-le : la policy RLS de la table agriculteurs est en cause.",
  },
  {
    nom: 'mot de passe trop court',
    erreur: { code: '422', message: 'Password should be at least 6 characters.' },
    attendu: 'Le mot de passe doit contenir au moins 6 caractères.',
  },
  {
    nom: 'connexion refusée',
    erreur: { code: '400', message: 'Invalid login credentials' },
    attendu: 'Email ou mot de passe incorrect.',
  },
];
for (const c of cas) {
  const obtenu = messageErreur(c.erreur);
  verifier(obtenu === c.attendu, `${c.nom} → « ${obtenu} »`);
}
verifier(messageErreur(null) === null, 'aucune erreur → aucun message');

// ── Partie 2 : sur la vraie base ────────────────────────────────────────────
console.log('\n=== Partie 2 : inscriptions réelles avec la bibliothèque de l’app ===');
const navigateur = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Copie fidèle de AuthContext.signUp (mêmes appels, mêmes messages). */
async function inscrire(email: string, telephone: string) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signUp({ email, password: 'Test123456!' });
  if (error) return { erreur: messageErreurInscription(error), uid: null as string | null };

  const uid = data.user?.id ?? null;
  if (data.user) {
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { erreur: MESSAGE_COMPTE_EXISTANT, uid: null };
    }
    const { error: profileError } = await client.from('agriculteurs').insert({
      auth_user_id: data.user.id,
      nom: 'Test messages',
      telephone,
      email,
      localite: 'Anyama',
      pays: "Côte d'Ivoire",
    });
    if (profileError) return { erreur: messageErreurInscription(profileError), uid };
  }
  return { erreur: null, uid };
}

const marque = Date.now();
const jetables: string[] = [];

// a. email déjà utilisé
const a = await inscrire('test1@agriagent.com', `+225 07 ${String(marque).slice(-8)}`);
console.log(`  a. email déjà pris        → « ${a.erreur} »`);
verifier(a.erreur === MESSAGE_COMPTE_EXISTANT, 'message « email déjà utilisé »');

// b. email neuf mais téléphone déjà pris
const b = await inscrire(`test-msg-${marque}@agriagent.com`, '+225 07 00 00 00 00');
if (b.uid) jetables.push(b.uid);
console.log(`  b. téléphone déjà pris    → « ${b.erreur} »`);
verifier(
  b.erreur === 'Ce numéro de téléphone est déjà utilisé. Essayez de vous connecter ou utilisez un autre numéro.',
  'message « téléphone déjà utilisé »'
);

// c. cas normal : tout est neuf
const c = await inscrire(`test-ok-${marque}@agriagent.com`, `+225 07 ${String(marque + 1).slice(-8)}`);
if (c.uid) jetables.push(c.uid);
console.log(`  c. inscription normale    → « ${c.erreur ?? 'aucune erreur'} »`);
verifier(c.erreur === null, 'inscription réussie sans message d’erreur');

// d. téléphone invalide pour l'index ? (chaîne vide tolérée si NULL) — on teste le doublon d'email
const d = await inscrire(`test-ok-${marque}@agriagent.com`, `+225 07 ${String(marque + 2).slice(-8)}`);
if (d.uid) jetables.push(d.uid);
console.log(`  d. même email, 2e fois    → « ${d.erreur} »`);
verifier(d.erreur === MESSAGE_COMPTE_EXISTANT, '2e inscription du même email : message clair');

// ── Nettoyage ──────────────────────────────────────────────────────────────
console.log('\n=== nettoyage des comptes de test ===');
for (const uid of new Set(jetables)) {
  await admin.from('agriculteurs').delete().eq('auth_user_id', uid);
  const { error } = await admin.auth.admin.deleteUser(uid);
  console.log(`  compte ${uid} supprimé ${error ? `(échec : ${error.message})` : ''}`);
}

console.log(`\n${echecs === 0 ? '✔ Tous les messages sont corrects' : `✘ ${echecs} contrôle(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

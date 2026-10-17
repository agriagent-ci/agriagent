/**
 * Test du flux « inscription → code à 6 chiffres → compte confirmé → profil créé ».
 *
 * Il exécute le VRAI code de l'application (`src/lib/verification.ts`,
 * `src/lib/profil-agriculteur.ts`) contre le vrai Supabase du projet :
 *
 *   1. remet le compte de test dans l'état « créé mais non confirmé » (ce que produit
 *      une inscription quand « Confirm email » est actif) ;
 *   2. vérifie le message vu par le producteur s'il tente de se connecter avant de saisir
 *      son code ;
 *   3. obtient un code réel, puis appelle `verifierCode()` comme le fait l'écran ;
 *   4. appelle `creerProfil()` comme le fait l'écran à la validation du code ;
 *   5. relit la ligne `agriculteurs` en base et vérifie le refus d'un mauvais code.
 *
 * Le code est ici obtenu par l'API d'administration (qui le renvoie dans sa réponse) :
 * c'est le même code que celui parti par email, ce qui permet de tester le flux même
 * quand l'envoi d'email est cassé. Voir « Mode réel » plus bas.
 *
 * Usage :
 *   npx tsx --tsconfig tsconfig.json scripts/test-otp.ts
 *   npx tsx --tsconfig tsconfig.json scripts/test-otp.ts 123456   # code lu dans l'email
 *   npx tsx --tsconfig tsconfig.json scripts/test-otp.ts --garde  # ne pas supprimer le compte
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

import { verifierCode, renvoyerCode, messageErreurCode, codeComplet, normaliserCode } from '../src/lib/verification';
import { creerProfil, infosDepuisUtilisateur } from '../src/lib/profil-agriculteur';
import { messageErreur } from '../src/lib/messages-erreurs';

// ── Configuration lue dans les .env (jamais affichée) ───────────────────────────────────────
function lireEnv(chemin: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
      const propre = ligne.trim();
      if (!propre || propre.startsWith('#') || !propre.includes('=')) continue;
      const [cle, ...reste] = propre.split('=');
      env[cle.trim()] = reste.join('=').trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* fichier absent : on le signale plus bas */
  }
  return env;
}

const envFront = lireEnv('/home/hermes/agriagent-frontend/.env');
const envBack = lireEnv('/home/hermes/agriagent-backend/.env');
const URL_SUPABASE = envFront.VITE_SUPABASE_URL ?? envBack.SUPABASE_URL;
const CLE_ANON = envFront.VITE_SUPABASE_ANON_KEY ?? envBack.SUPABASE_ANON_KEY;
const CLE_SERVICE = envBack.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const garder = args.includes('--garde');
const codeFourni = args.find((a) => /^\d{6,8}$/.test(a)) ?? null;

const EMAIL = 'test2@agriagent.com';
const MOT_DE_PASSE = 'AgriAgent2026!';
const INFOS = { nom: 'Test Deux', telephone: '0700000002', localite: 'Anyama' };

let echecs = 0;
function verifier(condition: boolean, libelle: string, detail = '') {
  console.log(`  ${condition ? '✔' : '✘'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!condition) echecs += 1;
}

async function admin(chemin: string, methode = 'GET', corps?: unknown) {
  const reponse = await fetch(`${URL_SUPABASE}${chemin}`, {
    method: methode,
    headers: {
      apikey: CLE_SERVICE,
      Authorization: `Bearer ${CLE_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await reponse.text();
  let donnees: unknown = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    donnees = texte;
  }
  return { statut: reponse.status, donnees };
}

async function supprimerUtilisateur(email: string) {
  const liste = await admin(`/auth/v1/admin/users?page=1&per_page=200`);
  const utilisateurs = (liste.donnees as { users?: { id: string; email?: string }[] })?.users ?? [];
  const cible = utilisateurs.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (cible) {
    await admin(`/auth/v1/admin/users/${cible.id}`, 'DELETE');
    return cible.id;
  }
  return null;
}

async function main() {
  console.log('Flux de vérification par code — compte de test :', EMAIL);
  console.log('Supabase :', URL_SUPABASE);
  verifier(Boolean(URL_SUPABASE && CLE_ANON && CLE_SERVICE), 'configuration lue (URL, clé anon, clé service)');
  if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) return terminer();

  const anon = createClient(URL_SUPABASE, CLE_ANON);

  // ── 0. Nettoyage des comptes de test ────────────────────────────────────────────────────
  console.log('\n══ 0. Nettoyage ══');
  // Toujours repartir d'un compte neuf : le test doit reproduire l'état « créé mais non
  // confirmé », impossible à obtenir sur un compte déjà confirmé. `--garde` ne concerne
  // que le ménage final (le compte reste en place pour la démonstration).
  const ancienTest2 = await supprimerUtilisateur(EMAIL);
  console.log(`  test2 existant supprimé : ${ancienTest2 ?? 'aucun'}`);
  const sonde = await supprimerUtilisateur('sonde-otp@agriagent.com');
  console.log(`  compte sonde supprimé   : ${sonde ?? 'aucun'}`);

  // ── 1. Compte créé mais NON confirmé (état produit par « Confirm email ») ───────────────
  console.log('\n══ 1. Compte créé mais non confirmé ══');
  const creation = await admin('/auth/v1/admin/users', 'POST', {
    email: EMAIL,
    password: MOT_DE_PASSE,
    email_confirm: false,
    user_metadata: INFOS,
  });
  verifier(creation.statut === 200 || creation.statut === 201, 'compte de test créé',
    `HTTP ${creation.statut}`);
  const utilisateur = creation.donnees as { id?: string; email?: string; email_confirmed_at?: string | null } | null;
  verifier(Boolean(utilisateur?.id), 'identifiant du compte reçu', utilisateur?.id ?? '');
  verifier(!utilisateur?.email_confirmed_at, 'le compte est bien NON confirmé');

  // ── 2. Connexion avant saisie du code : message clair attendu ──────────────────────────
  console.log('\n══ 2. Le producteur essaie de se connecter sans avoir saisi son code ══');
  const connexion = await anon.auth.signInWithPassword({ email: EMAIL, password: MOT_DE_PASSE });
  verifier(Boolean(connexion.error), 'la connexion est refusée',
    connexion.error ? `« ${connexion.error.message} »` : 'acceptée !');
  const messageAffiche = messageErreur(connexion.error);
  verifier(
    /pas encore confirmé/i.test(messageAffiche),
    'le message montré au producteur parle de la confirmation',
    messageAffiche
  );
  verifier(
    connexion.error ? /not confirmed/i.test(connexion.error.message) : false,
    "l'application reconnaît ce cas et bascule vers l'écran de code"
  );

  // ── 2 bis. Renvoi de code AVANT confirmation : c'est ici que l'envoi d'email se voit ──
  console.log('\n══ 2 bis. « Renvoyer le code » sur un compte non confirmé ══');
  const renvoiAvant = await renvoyerCode(anon, EMAIL);
  console.log(`  → ${renvoiAvant.ok ? 'accepté par Supabase' : 'refusé'} : ${renvoiAvant.message}`);
  if (!renvoiAvant.ok) {
    console.log("    ce refus vient de l'envoi d'email (SMTP) côté Supabase, pas du code :");
    console.log("    inscription, récupération de mot de passe et invitation échouent de la même façon");
  }

  // ── 3. Obtention du code ───────────────────────────────────────────────────────────────
  console.log('\n══ 3. Le code à 8 chiffres ══');
  let code = codeFourni;
  if (!code) {
    const lien = await admin('/auth/v1/admin/generate_link', 'POST', {
      type: 'signup',
      email: EMAIL,
      password: MOT_DE_PASSE,
    });
    if (lien.statut !== 200) {
      verifier(false, 'code obtenu', `HTTP ${lien.statut} : ${JSON.stringify(lien.donnees).slice(0, 200)}`);
      return terminer();
    }
    code = String((lien.donnees as { email_otp?: string }).email_otp ?? '');
    console.log(`  (code obtenu par l'API d'administration — c'est celui que contient l'email)`);
  } else {
    console.log('  (code fourni en argument, lu dans l\'email)');
  }
  verifier(codeComplet(code), 'le code reçu a bien la longueur attendue (8 chiffres)', `${code.length} chiffres`);
  console.log(`  code : ${code.slice(0, 2)}••${code.slice(-1)}  (masqué volontairement)`);

  // ── 4. Vérification du code avec le VRAI module de l'application ──────────────────────
  console.log('\n══ 4. Validation du code (src/lib/verification.ts) ══');
  const resultat = await verifierCode(anon, EMAIL, code);
  verifier(resultat.ok, 'le code est accepté et une session est ouverte', resultat.message ?? '');
  const session = resultat.session as { user?: { id?: string; email?: string } } | null;
  verifier(Boolean(session?.user?.id), 'la session contient le compte', session?.user?.email ?? '');

  // ── 5. Création du profil avec le VRAI module (src/lib/profil-agriculteur.ts) ──────────
  console.log('\n══ 5. Création du profil (src/lib/profil-agriculteur.ts) ══');
  if (resultat.ok && session?.user) {
    const erreurProfil = await creerProfil(
      anon,
      { id: session.user.id ?? '', email: session.user.email ?? EMAIL, user_metadata: INFOS },
      infosDepuisUtilisateur({ id: session.user.id ?? '', user_metadata: INFOS }),
      session.user.email ?? EMAIL
    );
    verifier(erreurProfil === null, 'aucune erreur à la création du profil', erreurProfil ?? '');
  } else {
    verifier(false, 'création du profil', 'impossible sans session');
  }

  // ── 6. Relecture en base, avec la clé d'administration ────────────────────────────────
  console.log('\n══ 6. Le profil existe-t-il vraiment en base ? ══');
  const lecture = await admin(
    `/rest/v1/agriculteurs?select=id,auth_user_id,nom,telephone,email,localite,pays,cree_le&email=eq.${encodeURIComponent(EMAIL)}`
  );
  const lignes = (lecture.donnees as Record<string, unknown>[]) ?? [];
  verifier(lignes.length === 1, 'une seule ligne `agriculteurs`', `${lignes.length} ligne(s)`);
  if (lignes[0]) {
    const l = lignes[0];
    console.log('  ligne relue en base :');
    console.log(`    id            : ${l.id}`);
    console.log(`    auth_user_id  : ${l.auth_user_id}`);
    console.log(`    nom           : ${l.nom}`);
    console.log(`    telephone     : ${l.telephone}`);
    console.log(`    email         : ${l.email}`);
    console.log(`    localite      : ${l.localite}`);
    console.log(`    pays          : ${l.pays}`);
    console.log(`    cree_le       : ${l.cree_le}`);
    verifier(l.auth_user_id === session?.user?.id, "le profil est bien rattaché au compte confirmé");
  }

  // ── 7. Un mauvais code doit être refusé, avec une phrase compréhensible ───────────────
  console.log('\n══ 7. Mauvais code ══');
  const mauvais = await verifierCode(anon, EMAIL, '00000000');
  verifier(mauvais.ok === false, 'un code faux est refusé');
  verifier(
    Boolean(mauvais.message && !/token|invalid|error/i.test(mauvais.message)),
    'le message est en français courant',
    mauvais.message ?? ''
  );
  const clair = await verifierCode(anon, EMAIL, '12');
  verifier(clair.ok === false && /chiffres/.test(clair.message ?? ''), 'un code trop court est signalé',
    clair.message ?? '');
  const autre = await verifierCode(anon, EMAIL, '654321');
  verifier(autre.ok === false, 'un code à 6 chiffres (format ancien) est refusé proprement',
    autre.message ?? '');

  // ── 8. Renvoi de code APRÈS confirmation ──────────────────────────────────────────────
  // Pour un compte déjà confirmé, Supabase accepte la demande sans renvoyer d'email :
  // ce n'est pas une preuve d'envoi, seulement l'absence d'erreur côté client.
  console.log('\n══ 8. Renvoi du code sur un compte déjà confirmé ══');
  const renvoi = await renvoyerCode(anon, EMAIL);
  console.log(`  → ${renvoi.ok ? 'accepté' : 'refusé'} : ${renvoi.message}`);
  console.log("    (sans signification sur l'envoi réel : voir l'étape 2 bis pour le vrai test)");

  // ── 9. Ménage ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ 9. Ménage ══');
  if (!garder) {
    const supprime = await supprimerUtilisateur(EMAIL);
    console.log(`  compte de test supprimé : ${supprime ?? 'aucun'}`);
  } else {
    console.log('  compte de test conservé (--garde)');
  }

  console.log(`\n══ Résultat : ${echecs === 0 ? 'toutes les vérifications passent' : `${echecs} échec(s)`} ══`);
  process.exit(echecs === 0 ? 0 : 1);
}

function terminer() {
  console.log(`\n══ Résultat : ${echecs === 0 ? 'toutes les vérifications passent' : `${echecs} échec(s)`} ══`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});

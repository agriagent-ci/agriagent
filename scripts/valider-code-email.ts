/**
 * Valide un code reçu par email sur un compte DÉJÀ créé par l'inscription publique.
 *
 * Différence avec `test-otp.ts` : ici, aucune création de compte par l'API
 * d'administration (elle n'envoie aucun email). Le compte vient d'une vraie
 * inscription (`POST /auth/v1/signup`), donc le code validé est celui que Supabase
 * a réellement expédié et qui a été relu dans la boîte de réception. C'est le test
 * qui prouve la chaîne entière : inscription → email → code → compte confirmé → profil.
 *
 * Usage :
 *   npx tsx --tsconfig tsconfig.json scripts/valider-code-email.ts <email> <code>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { verifierCode, messageErreurCode } from '../src/lib/verification';
import { creerProfil, infosDepuisUtilisateur } from '../src/lib/profil-agriculteur';

function lireEnv(chemin: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
      const l = ligne.trim();
      if (l && !l.startsWith('#') && l.includes('=')) {
        const i = l.indexOf('=');
        env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      }
    }
  } catch {
    /* absent */
  }
  return env;
}

const envFront = lireEnv('/home/hermes/agriagent-frontend/.env');
const envBack = lireEnv('/home/hermes/agriagent-backend/.env');
const URL_SUPABASE = envFront.VITE_SUPABASE_URL ?? envBack.SUPABASE_URL;
const CLE_ANON = envFront.VITE_SUPABASE_ANON_KEY ?? envBack.SUPABASE_ANON_KEY;
const CLE_SERVICE = envBack.SUPABASE_SERVICE_ROLE_KEY;

const [EMAIL, CODE] = process.argv.slice(2);
if (!EMAIL || !CODE) {
  console.error('usage : valider-code-email.ts <email> <code>');
  process.exit(2);
}

const INFOS = { nom: 'Test Email', telephone: '0700000003', localite: 'Anyama' };
let echecs = 0;
const verifier = (ok: boolean, libelle: string, detail = '') => {
  console.log(`  ${ok ? '✔' : '✘'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs += 1;
};

async function main() {
  const anon = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false } });

  console.log(`Validation du code reçu par email — ${EMAIL}`);

  const resultat = await verifierCode(anon, EMAIL, CODE);
  if (!resultat.ok) {
    console.log(
      `  ✘ code refusé — ${messageErreurCode(resultat.erreur) || 'raison inconnue'} (${resultat.erreur ?? ''})`
    );
    process.exit(1);
  }
  verifier(true, 'code accepté par Supabase, session ouverte');
  const user = resultat.session?.user;
  verifier(!!user, 'utilisateur renvoyé par la session', user?.email ?? '');

  const creation = await creerProfil(
    anon,
    { id: user?.id ?? '', email: user?.email ?? EMAIL, user_metadata: INFOS },
    user?.email ?? EMAIL
  );
  verifier(creation.ok, 'profil agriculteur créé', creation.erreur ?? '');

  // relecture en base (clé de service : on lit la ligne réellement écrite)
  const r = await fetch(
    `${URL_SUPABASE}/rest/v1/agriculteurs?select=id,auth_user_id,nom,telephone,email,localite,pays,cree_le&email=eq.${encodeURIComponent(EMAIL)}`,
    { headers: { apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}` } }
  );
  const lignes = (await r.json()) as Record<string, unknown>[];
  verifier(lignes.length === 1, 'ligne agriculteurs relue en base', `${lignes.length} ligne(s)`);
  if (lignes[0]) {
    console.log('    ' + JSON.stringify(lignes[0]));
    verifier(
      lignes[0].auth_user_id === user?.id,
      'profil rattaché au bon compte',
      String(lignes[0].auth_user_id)
    );
  }

  // contrôle final : email marqué confirmé côté Supabase
  const admin = await fetch(`${URL_SUPABASE}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}` },
  });
  const donnees = (await admin.json()) as { users?: { email?: string; email_confirmed_at?: string }[] };
  const u = donnees.users?.find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase());
  verifier(!!u?.email_confirmed_at, 'email marqué confirmé par Supabase', u?.email_confirmed_at ?? '');

  console.log(echecs === 0 ? '\nTOUT PASSE' : `\n${echecs} contrôle(s) en échec`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('erreur inattendue :', e);
  process.exit(1);
});

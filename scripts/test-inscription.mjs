/**
 * Test d'inscription dans le navigateur, sans navigateur.
 *
 * Utilise exactement le code de l'app : `supabase-js` (la bibliothèque du bundle) et
 * la même charge utile que src/contexts/AuthContext.tsx. C'est donc le vrai chemin
 * d'inscription, pas une simulation d'appels REST.
 *
 * Usage : node scripts/test-inscription.mjs [email] [--nettoyer]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const nettoyer = args.includes('--nettoyer');
const email = args.find((a) => !a.startsWith('--')) ?? `test-${Date.now()}@agriagent.com`;
const motDePasse = 'Test123456!';
// `agriculteurs.telephone` est UNIQUE : un numéro déjà utilisé fait échouer l'insert
// avec « duplicate key value violates unique constraint ». On en génère un par test.
const telephone = `+225 07 ${String(Date.now()).slice(-8)}`;

const env = {};
for (const ligne of readFileSync('/home/hermes/agriagent-backend/.env', 'utf8').split('\n')) {
  if (ligne.includes('=') && !ligne.trim().startsWith('#')) {
    const i = ligne.indexOf('=');
    env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
}

// 1. le client du navigateur, avec la clé ANON (comme dist/ le fait)
const navigateur = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const uidFictif = '9a43e681-23d5-487b-a48f-a026800a6c85';
let echecs = 0;
const verifier = (ok, texte) => {
  console.log(`  ${ok ? '✔' : '✘'} ${texte}`);
  if (!ok) echecs++;
};

console.log(`=== Inscription de ${email} avec la bibliothèque de l’app ===`);
const { data: inscription, error: erreurInscription } = await navigateur.auth.signUp({
  email,
  password: motDePasse,
});
console.log(`  erreur signUp        : ${erreurInscription?.message ?? 'aucune'}`);
console.log(`  utilisateur          : ${inscription?.user?.id}`);
console.log(`  session ouverte      : ${inscription?.session ? 'OUI' : 'NON'}`);
if (!inscription?.user) {
  console.log('  arrêt : pas d’utilisateur créé');
  process.exit(1);
}
verifier(Boolean(inscription.session), 'le client est authentifié juste après l’inscription');

// 2. l'INSERT du profil, copié de AuthContext.tsx
const { data: profil, error: erreurProfil } = await navigateur
  .from('agriculteurs')
  .insert({
    auth_user_id: inscription.user.id,
    nom: 'Compte test inscription',
    telephone,
    email,
    localite: 'Anyama',
    pays: "Côte d'Ivoire",
  })
  .select()
  .single();

console.log(`  erreur INSERT profil : ${erreurProfil?.message ?? 'aucune'}`);
verifier(!erreurProfil, `l’insertion du profil passe (code ${erreurProfil?.code ?? 'aucun'})`);
if (profil) {
  console.log(`  profil créé          : id=${profil.id} auth_user_id=${profil.auth_user_id} créé le ${profil.cree_le}`);
}

// 3. relecture par le compte lui-même (RLS : il doit voir sa ligne)
const { data: relu, error: erreurLecture } = await navigateur
  .from('agriculteurs')
  .select('id, nom, email, localite')
  .eq('auth_user_id', inscription.user.id);
verifier(!erreurLecture && (relu?.length ?? 0) === 1, `le compte relit sa propre ligne (${relu?.length ?? 0} trouvée)`);

// 4. test négatif : insérer une ligne au nom d'un AUTRE utilisateur
const { error: erreurIntrusion } = await navigateur
  .from('agriculteurs')
  .insert({ auth_user_id: uidFictif, nom: 'Intrusion', pays: "Côte d'Ivoire" })
  .select();
verifier(
  Boolean(erreurIntrusion),
  `insérer au nom d’un autre compte est refusé (${erreurIntrusion?.code ?? 'ACCEPTÉ — faille !'})`
);

// 5. contrôle côté admin
const { data: vueAdmin } = await admin
  .from('agriculteurs')
  .select('id, nom, email, auth_user_id, cree_le')
  .eq('auth_user_id', inscription.user.id);
verifier((vueAdmin?.length ?? 0) === 1, `le profil existe bien en base (vu par service_role) : ${JSON.stringify(vueAdmin?.[0] ?? null)}`);

if (nettoyer) {
  console.log('\n=== nettoyage ===');
  const { error: e1 } = await admin.from('agriculteurs').delete().eq('auth_user_id', inscription.user.id);
  const { error: e2 } = await admin.auth.admin.deleteUser(inscription.user.id);
  console.log(`  profil supprimé      : ${e1?.message ?? 'oui'}`);
  console.log(`  compte supprimé      : ${e2?.message ?? 'oui'}`);
}

console.log(`\n${echecs === 0 ? '✔ Inscription complète : compte + profil' : `✘ ${echecs} contrôle(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

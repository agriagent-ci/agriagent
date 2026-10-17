/**
 * Vérifie qu'un producteur tout neuf (test1@agriagent.com) accède à son profil et peut
 * créer une parcelle vide — avec la bibliothèque de l'app, donc sous RLS.
 *
 * Usage : node scripts/test-parcelle-test1.mjs [--supprimer]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const supprimer = process.argv.includes('--supprimer');
const EMAIL = 'test1@agriagent.com';
const MOT_DE_PASSE = 'Test123456!';

const env = {};
for (const ligne of readFileSync('/home/hermes/agriagent-backend/.env', 'utf8').split('\n')) {
  if (ligne.includes('=') && !ligne.trim().startsWith('#')) {
    const i = ligne.indexOf('=');
    env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
}

let echecs = 0;
const verifier = (ok, texte) => {
  console.log(`  ${ok ? '✔' : '✘'} ${texte}`);
  if (!ok) echecs++;
};

const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`=== Connexion de ${EMAIL} ===`);
const { data: auth, error: erreurAuth } = await client.auth.signInWithPassword({
  email: EMAIL,
  password: MOT_DE_PASSE,
});
verifier(!erreurAuth, `connexion (${erreurAuth?.message ?? 'OK'})`);
const uid = auth?.user?.id;
console.log(`  user id : ${uid}`);

console.log('\n=== 1. Accès à son propre profil (table agriculteurs) ===');
const { data: profils, error: erreurProfil } = await client
  .from('agriculteurs')
  .select('*')
  .eq('auth_user_id', uid);
verifier(!erreurProfil, `lecture du profil (${erreurProfil?.message ?? 'OK'})`);
verifier((profils?.length ?? 0) === 1, `exactement 1 profil visible (${profils?.length ?? 0})`);
const profil = profils?.[0];
if (profil) {
  console.log(`  profil : ${profil.nom} · ${profil.email} · ${profil.localite ?? 'localité non renseignée'} · ${profil.pays}`);
}

console.log('\n=== 2. Création d’une parcelle vide de test ===');
const nomParcelle = `Parcelle test ${new Date().toISOString().slice(0, 10)}`;
const { data: parcelle, error: erreurParcelle } = await client
  .from('parcelles')
  .insert({
    agriculteur_id: profil?.id,
    nom: nomParcelle,
    commune: 'Anyama',
    localite: 'Anyama',
  })
  .select()
  .single();
verifier(!erreurParcelle, `insertion de la parcelle (${erreurParcelle?.code ?? 'OK'} ${erreurParcelle?.message ?? ''})`);
if (parcelle) {
  console.log(`  parcelle : id=${parcelle.id} nom=${parcelle.nom} commune=${parcelle.commune} créée le ${parcelle.cree_le}`);
}

console.log('\n=== 3. Relecture : ce que le tableau de bord affichera ===');
const { data: mesParcelles, error: erreurListe } = await client
  .from('parcelles')
  .select('id, nom, commune, superficie_m2, actif')
  .eq('agriculteur_id', profil?.id)
  .order('cree_le', { ascending: false });
verifier(!erreurListe, `liste des parcelles (${erreurListe?.message ?? 'OK'})`);
verifier(
  (mesParcelles ?? []).some((p) => p.id === parcelle?.id),
  `la parcelle de test apparaît dans sa liste (${mesParcelles?.length ?? 0} parcelle(s) au total)`
);
console.log(`  ${JSON.stringify(mesParcelles)}`);

console.log('\n=== 4. Cloisonnement : il ne doit voir QUE ses parcelles ===');
const { data: toutes, error: erreurToutes } = await client.from('parcelles').select('id, nom');
verifier(!erreurToutes, `lecture globale (${erreurToutes?.message ?? 'OK'})`);
const ids = new Set((toutes ?? []).map((p) => p.id));
const intrus = (toutes ?? []).filter((p) => !(mesParcelles ?? []).some((m) => m.id === p.id));
verifier(intrus.length === 0, `aucune parcelle d’un autre producteur visible (${toutes?.length ?? 0} lignes, ${intrus.length} intruse(s))`);

console.log('\n=== 5. Test négatif : créer une parcelle au nom d’un autre producteur ===');
const { error: erreurIntrusion } = await client
  .from('parcelles')
  .insert({ agriculteur_id: '00000000-0000-4000-a000-000000000001', nom: 'Parcelle volée' })
  .select();
verifier(Boolean(erreurIntrusion), `refusé (${erreurIntrusion?.code ?? 'ACCEPTÉ — faille !'})`);

console.log('\n=== 6. Contrôle côté admin ===');
const { data: vuParAdmin } = await admin
  .from('parcelles')
  .select('id, nom, agriculteur_id, cree_le')
  .eq('id', parcelle?.id);
verifier((vuParAdmin?.length ?? 0) === 1, `la parcelle existe bien en base : ${JSON.stringify(vuParAdmin?.[0] ?? null)}`);

if (supprimer && parcelle) {
  const { error } = await admin.from('parcelles').delete().eq('id', parcelle.id);
  console.log(`\nsuppression de la parcelle de test : ${error?.message ?? 'faite'}`);
}

console.log(`\n${echecs === 0 ? '✔ Profil et parcelle de test : tout est bon' : `✘ ${echecs} contrôle(s) en échec`}`);
process.exit(echecs === 0 ? 0 : 1);

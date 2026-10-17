/**
 * Création du profil producteur (`agriculteurs`) après confirmation du compte.
 *
 * Isolé ici pour deux raisons :
 *  - la même fonction sert à l'inscription confirmée (AuthContext) et au test en ligne
 *    de commande (`scripts/test-otp.ts`), donc le test exerce le vrai code ;
 *  - elle ne peut être appelée qu'avec une session ouverte : avant la validation du code,
 *    `auth.uid()` est nul et la politique RLS « chacun sa ligne » refuserait l'insertion.
 */
import { messageErreurInscription } from '@/lib/messages-erreurs';

export interface InfosInscription {
  nom: string;
  telephone: string;
  localite: string;
}

/** Client minimal nécessaire (évite de typer tout supabase-js ici). */
export interface ClientProfil {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{
      error: { code?: string; message?: string } | null;
    }>;
  };
}

/** Utilisateur minimal attendu : identifiant, email, métadonnées saisies à l'inscription. */
export interface UtilisateurProfil {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export const PAYS_DEFAUT = "Côte d'Ivoire";

/** Relit les informations saisies à l'inscription, conservées dans les métadonnées. */
export function infosDepuisUtilisateur(utilisateur: UtilisateurProfil): InfosInscription {
  const meta = (utilisateur.user_metadata ?? {}) as Partial<InfosInscription>;
  return {
    nom: meta.nom ?? '',
    telephone: meta.telephone ?? '',
    localite: meta.localite ?? '',
  };
}

/**
 * Insère la ligne `agriculteurs`. Renvoie `null` si tout va bien, sinon une phrase à montrer.
 * Un code 23505 (« déjà présent ») n'est pas une erreur : le profil existe déjà, cas normal
 * quand le producteur recharge la page ou ressaisit son code.
 */
export async function creerProfil(
  client: ClientProfil,
  utilisateur: UtilisateurProfil,
  infos: InfosInscription,
  email: string | null
): Promise<string | null> {
  const { error } = await client.from('agriculteurs').insert({
    auth_user_id: utilisateur.id,
    nom: infos.nom,
    telephone: infos.telephone,
    email,
    localite: infos.localite,
    pays: PAYS_DEFAUT,
  });

  if (error) {
    // 23505 sur `auth_user_id` = le profil de CE compte existe déjà (rechargement de page,
    // code ressaisi) : rien d'anormal, on continue. Un 23505 sur `telephone` ou `email`
    // veut dire qu'une AUTRE personne utilise déjà ces coordonnées : on le traduit.
    const detail = error.message ?? '';
    if (error.code === '23505' && detail.includes('auth_user_id')) return null;
    return messageErreurInscription(error);
  }
  return null;
}

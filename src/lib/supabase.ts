import { createClient } from '@supabase/supabase-js';

// `import.meta.env` n'existe que sous Vite. Les valeurs de repli permettent d'importer ce
// module hors navigateur (rendu serveur, tests en ligne de commande) sans faire planter
// `createClient` ; en production, Vite remplace les vraies valeurs et ces replis ne servent pas.
const env = import.meta.env;
const supabaseUrl = env?.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY ?? 'cle-absente-hors-vite';

if (!env?.VITE_SUPABASE_URL || !env?.VITE_SUPABASE_ANON_KEY) {
  if (env) console.error('Variables Supabase manquantes. Vérifiez le fichier .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

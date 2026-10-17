import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowLeft, User, Phone, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';


interface AuthScreenProps {
  mode: 'login' | 'register' | 'forgot';
  onNavigate: (mode: 'login' | 'register' | 'forgot') => void;
  /** Bascule vers l'écran de saisie du code (inscription à confirmer, ou compte non confirmé). */
  onNeedVerification: (email: string) => void;
}

export function AuthScreen({ mode, onNavigate, onNeedVerification }: AuthScreenProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [localite, setLocalite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (mode === 'login') {
      const { error, needVerification } = await signIn(email, password);
      if (error) setError(error);
      // Compte non confirmé : on l'emmène directement saisir son code plutôt que de le
      // laisser bloqué sur « Email not confirmed ».
      if (needVerification) {
        setSubmitting(false);
        onNeedVerification(email);
        return;
      }
    } else if (mode === 'register') {
      if (!nom.trim()) {
        setError('Veuillez saisir votre nom');
        setSubmitting(false);
        return;
      }
      const { error, needVerification } = await signUp(email, password, nom, telephone, localite);
      if (error) {
        setError(error);
      } else if (needVerification) {
        // Confirmation par code : on ne connecte pas automatiquement, on passe à la saisie.
        setSubmitting(false);
        onNeedVerification(email);
        return;
      } else {
        setSuccess('Compte créé avec succès. Vous pouvez maintenant vous connecter.');
        setTimeout(() => onNavigate('login'), 1500);
      }
    } else {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error);
      } else {
        setSuccess('Un email de réinitialisation a été envoyé à votre adresse.');
      }
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50/30 leaf-pattern p-4">
      <div className="w-full max-w-md">
        {/* Illustration + titre */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <Logo size={128} className="md:hidden" />
            <Logo size={152} className="hidden md:flex" />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold tracking-tight text-stone-900 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Agri<span className="text-emerald-600">Agent</span>
          </motion.h1>
          <motion.p
            className="text-sm text-stone-500 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Assistant intelligent du producteur ivoirien
          </motion.p>
        </motion.div>

        {/* Carte glassmorphism */}
        <motion.div
          className="glass rounded-2xl border border-white/40 shadow-xl p-6 md:p-8"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-bold text-stone-900 mb-1">
                {mode === 'login' && 'Connexion'}
                {mode === 'register' && 'Créer un compte'}
                {mode === 'forgot' && 'Mot de passe oublié'}
              </h2>
              <p className="text-sm text-stone-500 mb-6">
                {mode === 'login' && 'Connectez-vous pour accéder à vos cultures'}
                {mode === 'register' && 'Inscrivez-vous pour commencer à suivre vos cultures'}
                {mode === 'forgot' && 'Entrez votre email pour réinitialiser votre mot de passe'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <FormField label="Nom complet" icon={User}>
                      <Input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex: Konan Kouassi"
                        required
                        className="pl-9 bg-white/70 border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                    </FormField>
                    <FormField label="Téléphone" icon={Phone}>
                      <Input
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        placeholder="Ex: 07 00 00 00 00"
                        className="pl-9 bg-white/70 border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                    </FormField>
                    <FormField label="Localité" icon={MapPin}>
                      <Input
                        value={localite}
                        onChange={(e) => setLocalite(e.target.value)}
                        placeholder="Ex: Bouaké, Korhogo..."
                        className="pl-9 bg-white/70 border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                    </FormField>
                  </>
                )}

                <FormField label="Email" icon={Mail}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    required
                    className="pl-9 bg-white/70 border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </FormField>

                {mode !== 'forgot' && (
                  <FormField label="Mot de passe" icon={Lock}>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="pl-9 bg-white/70 border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </FormField>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, x: -10 }}
                      animate={{ opacity: 1, height: 'auto', x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
                    >
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700"
                    >
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-shadow flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Veuillez patienter...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? "S'inscrire" : 'Envoyer'}
                </motion.button>
              </form>

              <div className="mt-5 space-y-2 text-center text-sm">
                {mode === 'login' && (
                  <>
                    <button
                      onClick={() => { setError(null); if (email.trim()) onNeedVerification(email.trim()); else setError('Saisissez votre email, puis appuyez de nouveau ici.'); }}
                      className="text-stone-500 hover:text-emerald-600 transition-colors block mx-auto"
                    >
                      Je dois saisir un code de confirmation
                    </button>
                    <button
                      onClick={() => { setError(null); onNavigate('forgot'); }}
                      className="text-stone-500 hover:text-emerald-600 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                    <p className="text-stone-500">
                      Pas encore de compte ?{' '}
                      <button
                        onClick={() => { setError(null); onNavigate('register'); }}
                        className="text-emerald-600 font-semibold hover:underline"
                      >
                        S'inscrire
                      </button>
                    </p>
                  </>
                )}
                {mode === 'register' && (
                  <p className="text-stone-500">
                    Déjà un compte ?{' '}
                    <button
                      onClick={() => { setError(null); onNavigate('login'); }}
                      className="text-emerald-600 font-semibold hover:underline"
                    >
                      Se connecter
                    </button>
                  </p>
                )}
                {mode === 'forgot' && (
                  <button
                    onClick={() => { setError(null); onNavigate('login'); }}
                    className="inline-flex items-center gap-1 text-stone-500 hover:text-emerald-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function FormField({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-stone-700 text-sm font-medium">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        {children}
      </div>
    </div>
  );
}

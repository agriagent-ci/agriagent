import { memo, useEffect, useState } from 'react';
import { Sprout, Bell, User, Home, MessageCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { VerificationScreen } from '@/screens/auth/VerificationScreen';
import { Dashboard } from '@/screens/dashboard/Dashboard';
import { CultureDetail } from '@/screens/culture/CultureDetail';
import { AlertesPage } from '@/screens/alertes/AlertesPage';
import { ProfilPage } from '@/screens/profil/ProfilPage';
import { ChatScreen } from '@/screens/chat/ChatScreen';
import { AddCultureForm } from '@/screens/culture/AddCultureForm';
import { Logo, LogoWithText } from '@/components/Logo';
import { cn } from '@/lib/utils';

type Screen = 'dashboard' | 'culture' | 'alertes' | 'profil' | 'chat';
type AuthMode = 'login' | 'register' | 'forgot';

function App() {
  const { user, loading, pendingEmail, setPendingEmail } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  // Lien direct : /chat ouvre l'assistant (utile pour partager une URL).
  const [screen, setScreen] = useState<Screen>(() =>
    window.location.pathname.replace(/\/$/, '') === '/chat' ? 'chat' : 'dashboard'
  );

  useEffect(() => {
    // /verification est adressable directement (le producteur peut recharger la page
    // pendant qu'il cherche son code) : l'adresse en attente est mémorisée côté contexte.
    const chemin = pendingEmail ? '/verification' : screen === 'chat' ? '/chat' : '/';
    if (window.location.pathname !== chemin) window.history.replaceState(null, '', chemin);
  }, [screen, pendingEmail]);
  const [selectedCultureId, setSelectedCultureId] = useState<string | null>(null);
  /** Onglet à ouvrir dans le détail de culture (mis par la mini-carte météo de l'accueil). */
  const [ongletCulture, setOngletCulture] = useState<string | null>(null);
  const [showAddCulture, setShowAddCulture] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <Logo size={80} />
          <p className="text-sm text-stone-400">Chargement d'AgriAgent...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {pendingEmail ? (
          <VerificationScreen onBack={() => { setPendingEmail(null); setAuthMode('register'); }} />
        ) : (
          <AuthScreen mode={authMode} onNavigate={setAuthMode} onNeedVerification={setPendingEmail} />
        )}
        <Toaster position="top-center" />
      </>
    );
  }

  const handleSelectCulture = (cultureId: string, onglet?: string) => {
    setSelectedCultureId(cultureId);
    setOngletCulture(onglet ?? null);
    setScreen('culture');
  };

  const handleBackToDashboard = () => {
    setSelectedCultureId(null);
    setOngletCulture(null);
    setScreen('dashboard');
  };

  const handleNavigate = (s: Exclude<Screen, 'culture'>) => {
    setSelectedCultureId(null);
    setScreen(s);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header desktop */}
      <header className="hidden md:flex sticky top-0 z-40 border-b border-stone-200/60 glass">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <button onClick={handleBackToDashboard}>
            <LogoWithText size={32} />
          </button>
          <nav className="flex items-center gap-1 bg-stone-100/80 rounded-xl p-1">
            <NavButton active={screen === 'dashboard'} onClick={handleBackToDashboard} icon={Home} label="Accueil" />
            <NavButton active={screen === 'chat'} onClick={() => handleNavigate('chat')} icon={MessageCircle} label="Chat" />
            <NavButton active={screen === 'alertes'} onClick={() => handleNavigate('alertes')} icon={Bell} label="Alertes" />
            <NavButton active={screen === 'profil'} onClick={() => handleNavigate('profil')} icon={User} label="Profil" />
          </nav>
        </div>
      </header>

      {/* Contenu principal */}
      <main>
        {screen === 'dashboard' && (
          <Dashboard
            onSelectCulture={handleSelectCulture}
            onAddCulture={() => setShowAddCulture(true)}
            onNavigate={handleNavigate}
            onOpenMeteo={(cultureId) => handleSelectCulture(cultureId, 'meteo')}
          />
        )}
        {screen === 'culture' && selectedCultureId && (
          <CultureDetail
            cultureId={selectedCultureId}
            onBack={handleBackToDashboard}
            ongletInitial={ongletCulture ?? undefined}
          />
        )}
        {screen === 'chat' && <ChatScreen />}
        {screen === 'alertes' && <AlertesPage onNavigate={handleNavigate} />}
        {screen === 'profil' && <ProfilPage onNavigate={handleNavigate} />}
      </main>

      {/* Navigation mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-stone-200/60 glass">
        <div className="grid grid-cols-5 h-16">
          <MobileNavButton active={screen === 'dashboard'} onClick={handleBackToDashboard} icon={Home} label="Accueil" />
          <MobileNavButton active={screen === 'culture'} onClick={handleBackToDashboard} icon={Sprout} label="Cultures" />
          <MobileNavButton active={screen === 'chat'} onClick={() => handleNavigate('chat')} icon={MessageCircle} label="Chat" />
          <MobileNavButton active={screen === 'alertes'} onClick={() => handleNavigate('alertes')} icon={Bell} label="Alertes" />
          <MobileNavButton active={screen === 'profil'} onClick={() => handleNavigate('profil')} icon={User} label="Profil" />
        </div>
      </nav>

      <AddCultureForm
        open={showAddCulture}
        onOpenChange={setShowAddCulture}
        onSaved={() => {
          setShowAddCulture(false);
          if (screen === 'dashboard') setScreen('dashboard');
        }}
      />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            border: '1px solid #e7e5e4',
            padding: '12px 16px',
            fontSize: '14px',
            background: '#fff',
            color: '#1c1917',
          },
        }}
      />
    </div>
  );
}

const NavButton = memo(function NavButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: typeof Home;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-800'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
});

const MobileNavButton = memo(function MobileNavButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: typeof Home;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 transition-colors relative',
        active ? 'text-emerald-600' : 'text-stone-400'
      )}
    >
      {active && <div className="absolute top-0 w-8 h-0.5 rounded-full bg-emerald-500" />}
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
});

export default App;

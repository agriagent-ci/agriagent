import { memo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MapPin, Calendar, AlertTriangle, TrendingUp, Sprout } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, getStadeLabel } from '@/lib/constants';
import { staggerContainer, fadeInUp } from '@/components/animations';
import { Logo } from '@/components/Logo';
import { MeteoDuJour } from '@/screens/dashboard/MeteoDuJour';
import type { Culture, Parcelle, Alerte } from '@/types/database';

interface DashboardProps {
  onSelectCulture: (cultureId: string) => void;
  onAddCulture: () => void;
  onNavigate: (screen: 'dashboard' | 'alertes' | 'profil') => void;
  /** Ouvre la culture directement sur son onglet Météo. */
  onOpenMeteo?: (cultureId: string) => void;
}

interface CultureWithAlertes extends Culture {
  parcelle?: Parcelle;
  alertes_non_traitees: number;
}

const CACHE_KEY = 'dashboard';

export function Dashboard({ onSelectCulture, onAddCulture, onOpenMeteo }: DashboardProps) {
  const { profile } = useAuth();
  const [cultures, setCultures] = useState<CultureWithAlertes[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: parcelles } = await supabase
      .from('parcelles')
      .select('*')
      .eq('agriculteur_id', profile.id);

    const parcelleMap = new Map<string, Parcelle>();
    (parcelles ?? []).forEach((p: Parcelle) => parcelleMap.set(p.id, p));
    const parcelleIds = (parcelles ?? []).map((p: Parcelle) => p.id);

    if (parcelleIds.length === 0) {
      setCultures([]);
      setAlertes([]);
      setLoading(false);
      return;
    }

    const { data: culturesData } = await supabase
      .from('cultures')
      .select('*')
      .in('parcelle_id', parcelleIds)
      .order('cree_le', { ascending: false });

    const cultureIds = (culturesData ?? []).map((c: Culture) => c.id);

    let alertesData: Alerte[] = [];
    if (cultureIds.length > 0) {
      const { data: a } = await supabase
        .from('alertes')
        .select('*')
        .in('culture_id', cultureIds)
        .order('alerte_le', { ascending: false });
      alertesData = (a ?? []) as Alerte[];
    }

    setAlertes(alertesData);

    const enriched: CultureWithAlertes[] = (culturesData ?? []).map((c: Culture) => {
      const cultureAlertes = alertesData.filter((a) => a.culture_id === c.id && !a.traitee);
      return { ...c, parcelle: parcelleMap.get(c.parcelle_id), alertes_non_traitees: cultureAlertes.length };
    });

    setCultures(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // La base utilise 'en_cours' (contrainte cultures_statut_valide) ; 'actif' est
  // l'ancien vocabulaire du front, conservé au cas où d'anciennes lignes traînent.
  const culturesActives = cultures.filter((c) => c.statut === 'en_cours' || c.statut === 'actif');
  // Culture servant à la mini-carte météo : la première culture active (sinon la première tout court).
  const cultureActive = culturesActives[0] ?? cultures[0];
  const alertesNonTraitees = alertes.filter((a) => !a.traitee);
  const nbParcelles = new Set(cultures.map((c) => c.parcelle?.id).filter(Boolean)).size;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight mb-1">
        Bonjour, {profile?.nom?.split(' ')[0] ?? 'agriculteur'}
      </h1>
      <p className="text-stone-500 text-sm mb-4">Voici le résumé de vos cultures</p>

      {/* Météo du moment, en une phrase, avec accès direct à l'onglet Météo complet. */}
      {cultureActive?.parcelle_id && (
        <div className="mb-6">
          <MeteoDuJour
            parcelleId={cultureActive.parcelle_id}
            onOuvrirMeteo={onOpenMeteo ? () => onOpenMeteo(cultureActive.id) : undefined}
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Sprout} value={culturesActives.length} label="Cultures actives" color="emerald" />
        <StatCard icon={AlertTriangle} value={alertesNonTraitees.length} label="Alertes à traiter" color={alertesNonTraitees.length > 0 ? 'red' : 'stone'} />
        <StatCard icon={TrendingUp} value={cultures.length} label="Cultures totales" color="amber" />
        <StatCard icon={MapPin} value={nbParcelles} label="Parcelles" color="blue" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-900">Mes cultures</h2>
        <Button onClick={onAddCulture} size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-2xl shimmer" />
          ))}
        </div>
      ) : cultures.length === 0 ? (
        <Card className="border-dashed border-2 border-stone-200">
          <CardContent className="p-10 text-center">
            <Logo size={80} className="mx-auto mb-4" />
            <p className="text-stone-500 mb-4">Aucune culture enregistrée pour le moment.</p>
            <Button onClick={onAddCulture} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
              <Plus className="w-4 h-4 mr-1" /> Ajouter votre première culture
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-4 md:grid-cols-2"
        >
          {cultures.map((culture) => (
            <CultureCard key={culture.id} culture={culture} onClick={() => onSelectCulture(culture.id)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

const colorMap = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  stone: { bg: 'bg-stone-100', text: 'text-stone-500' },
};

const StatCard = memo(function StatCard({ icon: Icon, value, label, color }: {
  icon: typeof Sprout;
  value: number;
  label: string;
  color: keyof typeof colorMap;
}) {
  const c = colorMap[color];
  return (
    <Card className="border-stone-200/60 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-stone-900">{value}</p>
          <p className="text-xs text-stone-500 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
});

const CultureCard = memo(function CultureCard({ culture, onClick }: { culture: CultureWithAlertes; onClick: () => void }) {
  const stade = getStadeLabel(culture.stade);
  const jours = culture.date_repiquage
    ? Math.floor((Date.now() - new Date(culture.date_repiquage).getTime()) / 86400000)
    : null;
  const progression = jours !== null ? Math.min(100, Math.round((jours / 90) * 100)) : 0;

  return (
    <motion.div
      variants={fadeInUp}
      style={{ willChange: 'transform, opacity' }}
    >
      <Card
        className="cursor-pointer border-stone-200/60 hover:border-emerald-300 hover:shadow-lg transition-shadow overflow-hidden"
        onClick={onClick}
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Sprout className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {culture.espece}
                  {culture.variete && <span className="text-stone-400 font-normal"> · {culture.variete}</span>}
                </CardTitle>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {culture.parcelle?.nom ?? 'Parcelle inconnue'}
                </p>
              </div>
            </div>
            {culture.alertes_non_traitees > 0 && (
              <Badge variant="destructive" className="shrink-0 shadow-destructive">
                {culture.alertes_non_traitees}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 text-stone-600 font-medium">
              <Sprout className="w-3 h-3" /> {stade}
            </span>
            {jours !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 text-stone-600 font-medium">
                <Calendar className="w-3 h-3" /> {jours} j
              </span>
            )}
            {culture.parcelle?.commune && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 text-stone-600 font-medium">
                <MapPin className="w-3 h-3" /> {culture.parcelle.commune}
              </span>
            )}
          </div>

          {jours !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-stone-400">Progression cycle</span>
                <span className="font-medium text-stone-600">{progression}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                  style={{ width: `${progression}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
            <span className="text-xs text-stone-400">Repiquage: {formatDate(culture.date_repiquage)}</span>
            <span className="text-xs font-semibold text-emerald-600">Détails →</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

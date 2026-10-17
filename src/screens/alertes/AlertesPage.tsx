import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { Bell, CheckCircle2, AlertTriangle, CloudRain, Bug, Sprout, Droplets, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, getNiveauConfig, getTypeAlerteLabel } from '@/lib/constants';
import { Logo } from '@/components/Logo';
import type { Alerte, Culture, Parcelle } from '@/types/database';

interface AlertesPageProps {
  onNavigate: (screen: 'dashboard' | 'alertes' | 'profil') => void;
}

const ALERTE_ICONS: Record<string, typeof Bell> = {
  maladie: Bug, ravageur: Bug, meteo: CloudRain, croissance: Sprout,
  irrigation: Droplets, sol: Layers, autre: AlertTriangle,
};

export function AlertesPage({ onNavigate: _onNavigate }: AlertesPageProps) {
  const { profile, user } = useAuth();
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'non_traitees' | 'traitees' | 'toutes'>('non_traitees');

  const loadAlertes = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: parcelles } = await supabase
      .from('parcelles')
      .select('*')
      .eq('agriculteur_id', profile.id);
    const parcelleIds = (parcelles ?? []).map((p: Parcelle) => p.id);
    const parcelleMap = new Map((parcelles ?? []).map((p: Parcelle) => [p.id, p]));

    if (parcelleIds.length === 0) {
      setAlertes([]); setLoading(false); return;
    }

    const { data: cultures } = await supabase
      .from('cultures')
      .select('*')
      .in('parcelle_id', parcelleIds);
    const cultureIds = (cultures ?? []).map((c: Culture) => c.id);
    const cultureMap = new Map((cultures ?? []).map((c: Culture) => [c.id, c]));

    let alertesData: Alerte[] = [];
    if (cultureIds.length > 0) {
      const { data: a } = await supabase
        .from('alertes')
        .select('*')
        .in('culture_id', cultureIds)
        .order('alerte_le', { ascending: false });
      alertesData = (a ?? []) as Alerte[];
    }

    const enriched = alertesData.map((al) => {
      if (al.culture_id && cultureMap.has(al.culture_id)) {
        const c = cultureMap.get(al.culture_id)!;
        return { ...al, culture: c, parcelle: parcelleMap.get(c.parcelle_id) };
      }
      if (al.parcelle_id && parcelleMap.has(al.parcelle_id)) {
        return { ...al, parcelle: parcelleMap.get(al.parcelle_id) };
      }
      return al;
    });

    setAlertes(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadAlertes(); }, [loadAlertes]);

  const handleMark = useCallback(async (alerteId: string) => {
    const { error } = await supabase
      .from('alertes')
      .update({ traitee: true, traitee_le: new Date().toISOString(), traitee_par: user?.id })
      .eq('id', alerteId);
    if (!error) loadAlertes();
  }, [loadAlertes, user?.id]);

  const counts = useMemo(() => ({
    non_traitees: alertes.filter((a) => !a.traitee).length,
    traitees: alertes.filter((a) => a.traitee).length,
    toutes: alertes.length,
  }), [alertes]);

  const filtered = useMemo(() => alertes.filter((a) => {
    if (filter === 'non_traitees') return !a.traitee;
    if (filter === 'traitees') return a.traitee;
    return true;
  }), [alertes, filter]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Bell className="w-5 h-5 text-emerald-600" />
        </div>
        Alertes
      </h1>
      <p className="text-stone-500 text-sm mb-6">Gérez les alertes de vos cultures</p>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList className="grid grid-cols-3 w-full bg-stone-100/80 rounded-xl p-1">
          <TabsTrigger value="non_traitees" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-lg">
            Non traitées ({counts.non_traitees})
          </TabsTrigger>
          <TabsTrigger value="traitees" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-lg">
            Traitées ({counts.traitees})
          </TabsTrigger>
          <TabsTrigger value="toutes" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-lg">
            Toutes ({counts.toutes})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-stone-200">
          <CardContent className="p-10 text-center">
            <Logo size={72} className="mx-auto mb-3" />
            <p className="text-stone-500">
              {filter === 'non_traitees' && 'Aucune alerte à traiter. Tout va bien !'}
              {filter === 'traitees' && 'Aucune alerte traitée pour le moment.'}
              {filter === 'toutes' && 'Aucune alerte enregistrée.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((al) => (
            <AlerteCard key={al.id} alerte={al} onMark={handleMark} />
          ))}
        </div>
      )}
    </div>
  );
}

const AlerteCard = memo(function AlerteCard({ alerte: al, onMark }: { alerte: Alerte; onMark: (id: string) => void }) {
  const cfg = getNiveauConfig(al.niveau);
  const Icon = ALERTE_ICONS[al.type_alerte] ?? AlertTriangle;
  const isCritical = al.niveau === 'critique' && !al.traitee;

  return (
    <Card className={`${cfg.border} ${cfg.bg} relative overflow-hidden shadow-sm`}>
      {isCritical && (
        <div className="absolute inset-0 border-2 border-red-400 rounded-xl pointer-events-none animate-pulse-ring" />
      )}
      <CardContent className="p-4 relative">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs bg-white/60">{getTypeAlerteLabel(al.type_alerte)}</Badge>
              <Badge className={`text-xs ${cfg.color} ${cfg.bg} border ${cfg.border}`}>{cfg.label}</Badge>
              {al.traitee && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Traité
                </Badge>
              )}
            </div>
            <p className="text-sm mt-2 text-stone-800">{al.message}</p>
            {al.action_recommandee && (
              <div className="mt-2 rounded-lg bg-white/60 p-2 text-xs">
                <span className="font-medium text-stone-700">Action recommandée: </span>
                <span className="text-stone-600">{al.action_recommandee}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-stone-400">
                {al.culture && <span>{al.culture.espece}</span>}
                {al.parcelle && <span> · {al.parcelle.nom}</span>}
                <span className="ml-2">{formatDateTime(al.alerte_le)}</span>
              </div>
              {!al.traitee && (
                <Button size="sm" variant="outline" onClick={() => onMark(al.id)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marquer traitée
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

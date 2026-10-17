import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, MapPin, Calendar, Sprout, Stethoscope, Wrench, CloudRain, Bell, Microscope, CheckCircle2, Lightbulb, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatDate, formatDateTime, getStadeLabel, getStatutLabel,
  getCategorieLabel, getTypeInterventionLabel, getNiveauConfig, getTypeAlerteLabel,
  ORGANES_ATTEINTS,
} from '@/lib/constants';
// Les colonnes jsonb de `diagnostics` sont des tableaux hétérogènes : leur rendu est
// isolé dans DiagnosticCard, qui les normalise (sinon React plante et l'onglet reste vide).
import { DiagnosticCard } from '@/screens/culture/DiagnosticCard';
import { PrevisionsMeteo } from '@/screens/culture/PrevisionsMeteo';
import { getConseilDuJour, describeJour, fr } from '@/lib/meteo-conseil';
import type { Culture, Parcelle, Observation, Diagnostic, Intervention, MeteoReleve, Alerte } from '@/types/database';
import { ObservationForm } from '@/screens/culture/ObservationForm';
import { InterventionForm } from '@/screens/culture/InterventionForm';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface CultureDetailProps {
  cultureId: string;
  onBack: () => void;
  /** Onglet ouvert à l'arrivée (« meteo » depuis la mini-carte d'accueil). */
  ongletInitial?: string;
}

/** Habillage du « Conseil du jour » selon la gravité du message. */
const TONS = {
  risque: {
    card: 'border-red-200 bg-red-50/60',
    bar: 'bg-gradient-to-r from-red-400 to-red-600',
    titre: 'text-red-800',
  },
  vigilance: {
    card: 'border-amber-200 bg-amber-50/60',
    bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
    titre: 'text-amber-900',
  },
  ok: {
    card: 'border-emerald-200 bg-emerald-50/60',
    bar: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
    titre: 'text-emerald-900',
  },
} as const;

export function CultureDetail({ cultureId, onBack, ongletInitial }: CultureDetailProps) {
  const { user } = useAuth();
  const [culture, setCulture] = useState<Culture | null>(null);
  const [parcelle, setParcelle] = useState<Parcelle | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [meteo, setMeteo] = useState<MeteoReleve[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [showObsForm, setShowObsForm] = useState(false);
  const [showIntForm, setShowIntForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: cult } = await supabase
      .from('cultures')
      .select('*')
      .eq('id', cultureId)
      .maybeSingle();
    setCulture(cult as Culture | null);

    let parcelleId: string | null = null;
    if (cult?.parcelle_id) {
      parcelleId = cult.parcelle_id;
      const { data: parc } = await supabase
        .from('parcelles')
        .select('*')
        .eq('id', cult.parcelle_id)
        .maybeSingle();
      setParcelle(parc as Parcelle | null);
    }

    const [obsRes, diagRes, intRes, metRes, alRes] = await Promise.all([
      supabase.from('observations').select('*').eq('culture_id', cultureId).order('observe_le', { ascending: false }),
      // La table diagnostics n'a PAS de colonne d'horodatage : plusieurs diagnostics
      // peuvent porter la même date (5 le 02/10). Sans départage, l'ordre des cartes
      // changerait d'un chargement à l'autre ; on trie donc aussi par id.
      supabase.from('diagnostics').select('*').eq('culture_id', cultureId).order('date_diagnostic', { ascending: false }).order('id', { ascending: false }),
      supabase.from('interventions').select('*').eq('culture_id', cultureId).order('fait_le', { ascending: false }),
      parcelleId
        // BUG corrigé : en tri croissant + limit() on ne récupérait que les relevés les
        // PLUS ANCIENS (le dernier était ignoré). On prend les 14 derniers (la collecte
        // quotidienne alimente la table en continu), puis on remet l'ordre chronologique
        // pour le graphique (voir setMeteo).
        ? supabase.from('meteo_releves').select('*').eq('parcelle_id', parcelleId).order('jour', { ascending: false }).limit(14)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('alertes').select('*').eq('culture_id', cultureId).order('alerte_le', { ascending: false }),
    ]);

    setObservations((obsRes.data ?? []) as Observation[]);
    setDiagnostics((diagRes.data ?? []) as Diagnostic[]);
    setInterventions((intRes.data ?? []) as Intervention[]);
    // remis dans l'ordre du calendrier (croissant) pour les graphiques
    setMeteo(((metRes.data ?? []) as MeteoReleve[]).slice().reverse());
    setAlertes((alRes.data ?? []) as Alerte[]);
    setLoading(false);
  }, [cultureId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Nombre de diagnostics par date : permet de n'afficher « Plus récent » que lorsqu'il
  // n'y en a qu'un seul ce jour-là (le 02/10 en compte cinq).
  const diagnosticsParDate = useMemo(() => {
    const compte: Record<string, number> = {};
    for (const d of diagnostics) {
      const jour = d.date_diagnostic.slice(0, 10);
      compte[jour] = (compte[jour] ?? 0) + 1;
    }
    return compte;
  }, [diagnostics]);

  const handleMarkAlerte = useCallback(async (alerteId: string) => {
    const { error } = await supabase
      .from('alertes')
      .update({ traitee: true, traitee_le: new Date().toISOString(), traitee_par: user?.id })
      .eq('id', alerteId);
    if (!error) loadData();
  }, [loadData, user?.id]);

  const meteoChartData = useMemo(() => meteo.map((m) => ({
    jour: new Date(m.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    pluie: m.pluie_mm ?? 0,
    temp: m.temp_moyenne_c ?? 0,
    rh: m.rh_moyenne_pct ?? 0,
  })), [meteo]);

  const alertesNonTraitees = useMemo(() => alertes.filter(a => !a.traitee), [alertes]);

  // Conseil du jour en langage simple (une phrase + une icône)
  const conseil = useMemo(() => getConseilDuJour(meteo), [meteo]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
        <div className="h-8 w-32 shimmer rounded-lg mb-4" />
        <div className="h-32 shimmer rounded-2xl mb-4" />
        <div className="h-64 shimmer rounded-2xl" />
      </div>
    );
  }

  if (!culture) {
    return (
      <div className="p-6 text-center">
        <p className="text-stone-500">Culture introuvable</p>
        <Button onClick={onBack} className="mt-4">Retour</Button>
      </div>
    );
  }

  const joursRepiquage = culture.date_repiquage
    ? Math.floor((Date.now() - new Date(culture.date_repiquage).getTime()) / 86400000)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2 text-stone-500 hover:text-stone-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour
      </Button>

      <Card className="mb-4 border-stone-200/60 overflow-hidden shadow-md">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700" />
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
                <Sprout className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-xl">{culture.espece}</CardTitle>
                {culture.variete && <CardDescription className="text-sm">Variété: {culture.variete}</CardDescription>}
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{getStadeLabel(culture.stade)}</Badge>
                  <Badge variant={culture.statut === 'en_cours' || culture.statut === 'actif' ? 'default' : 'outline'}>{getStatutLabel(culture.statut)}</Badge>
                </div>
              </div>
            </div>
            {joursRepiquage !== null && (
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">{joursRepiquage}</p>
                <p className="text-xs text-stone-400">jours après repiquage</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <InfoItem icon={MapPin} label="Parcelle" value={parcelle?.nom ?? '—'} />
            <InfoItem icon={Calendar} label="Date semis" value={formatDate(culture.date_semis)} />
            <InfoItem icon={Calendar} label="Date repiquage" value={formatDate(culture.date_repiquage)} />
            <InfoItem icon={Calendar} label="Récolte prévue" value={formatDate(culture.date_recolte_prevue)} />
          </div>
          {parcelle?.commune && (
            <p className="text-xs text-stone-400 mt-3">
              Commune: {parcelle.commune}{parcelle.localite ? ` · ${parcelle.localite}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={ongletInitial ?? 'observations'} className="w-full">
        <TabsList className="grid grid-cols-5 w-full mb-4 h-auto bg-stone-100/80 rounded-xl p-1">
          {[
            { value: 'observations', icon: Microscope, label: 'Obs.' },
            { value: 'diagnostics', icon: Stethoscope, label: 'Diag.' },
            { value: 'interventions', icon: Wrench, label: 'Interv.' },
            { value: 'meteo', icon: CloudRain, label: 'Météo' },
            { value: 'alertes', icon: Bell, label: 'Alertes' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs md:text-sm flex flex-col gap-1 py-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
              {tab.value === 'alertes' && alertesNonTraitees.length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="observations">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-900">Observations ({observations.length})</h3>
            <Button size="sm" onClick={() => setShowObsForm(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
          {observations.length === 0 ? (
            <EmptyState text="Aucune observation enregistrée" />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-stone-200" />
              <div className="space-y-3">
                {observations.map((obs) => (
                  <div key={obs.id} className="relative">
                    <div className="absolute -left-[18px] top-4 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                    <Card className="border-stone-200/60 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs bg-stone-50">{getCategorieLabel(obs.categorie)}</Badge>
                              {obs.severite !== null && (
                                <Badge className={`text-xs ${obs.severite >= 7 ? 'bg-red-500' : obs.severite >= 4 ? 'bg-orange-500' : 'bg-yellow-500'} text-white`}>
                                  Sévérité: {obs.severite}/9
                                </Badge>
                              )}
                              {obs.organe_atteint && (
                                <span className="text-xs text-stone-400">
                                  {ORGANES_ATTEINTS.find(o => o.value === obs.organe_atteint)?.label ?? obs.organe_atteint}
                                </span>
                              )}
                            </div>
                            {obs.description && <p className="text-sm mt-2 text-stone-700">{obs.description}</p>}
                            <p className="text-xs text-stone-400 mt-2">{formatDate(obs.observe_le)}</p>
                          </div>
                          {obs.photo_url && (
                            <img src={obs.photo_url} alt="Observation" loading="lazy" className="w-16 h-16 rounded-lg object-cover shrink-0 ring-2 ring-stone-100" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="diagnostics">
          <h3 className="font-semibold text-stone-900 mb-3">Diagnostics ({diagnostics.length})</h3>
          {diagnostics.length === 0 ? (
            <EmptyState text="Aucun diagnostic enregistré" />
          ) : (
            <div className="space-y-3">
              {diagnostics.map((diag, idx) => (
                <DiagnosticCard
                  key={diag.id}
                  diagnostic={diag}
                  idx={idx}
                  observation={observations.find((o) => o.id === diag.observation_id) ?? null}
                  estLePlusRecent={idx === 0 && (diagnosticsParDate[diag.date_diagnostic.slice(0, 10)] ?? 1) === 1}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interventions">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-stone-900">Interventions ({interventions.length})</h3>
            <Button size="sm" onClick={() => setShowIntForm(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
          {interventions.length === 0 ? (
            <EmptyState text="Aucune intervention enregistrée" />
          ) : (
            <div className="space-y-3">
              {interventions.map((int) => (
                <Card key={int.id} className="border-stone-200/60 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">{getTypeInterventionLabel(int.type_intervention)}</Badge>
                      <span className="text-xs text-stone-400">{formatDate(int.fait_le)}</span>
                    </div>
                    {int.produit && <p className="text-sm font-medium mt-1 text-stone-800">{int.produit}</p>}
                    {int.matiere_active && <p className="text-xs text-stone-400">Matière active: {int.matiere_active}</p>}
                    {int.dose !== null && (
                      <p className="text-xs text-stone-400">
                        Dose: {int.dose} {int.unite_dose ?? ''}{int.surface_traitee_m2 ? ` · Surface: ${int.surface_traitee_m2} m²` : ''}
                      </p>
                    )}
                    {int.cout_fcfa !== null && <p className="text-xs text-stone-400">Coût: {int.cout_fcfa.toLocaleString('fr-FR')} FCFA</p>}
                    {int.notes && <p className="text-sm mt-2 text-stone-600">{int.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="meteo">
          {/* D'abord les jours à venir (5 cartes), ensuite l'historique mois par mois. */}
          {parcelle?.id && <PrevisionsMeteo parcelleId={parcelle.id} jours={5} />}

          <h3 className="font-semibold text-stone-900 mb-3 mt-6">Météo — 14 derniers jours</h3>
          {meteo.length === 0 ? (
            <EmptyState text="Aucune donnée météo disponible" />
          ) : (
            <div className="space-y-4">
              {conseil && (
                <Card className={`overflow-hidden shadow-md ${TONS[conseil.ton].card}`}>
                  <div className={`h-1.5 ${TONS[conseil.ton].bar}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl leading-none" aria-hidden="true">{conseil.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-stone-500 flex items-center gap-1 mb-1">
                          <Lightbulb className="w-3 h-3" /> Conseil du jour
                        </p>
                        <p className={`text-base font-semibold ${TONS[conseil.ton].titre}`}>{conseil.phrase}</p>
                        {conseil.secondaires.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {conseil.secondaires.map((info) => (
                              <li key={info} className="text-xs text-stone-600">{info}</li>
                            ))}
                          </ul>
                        )}
                        {conseil.note && (
                          <p className="mt-2 text-xs text-amber-700 flex items-start gap-1">
                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{conseil.note}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-3">
                {meteo.map((m) => (
                  <Card key={m.id} className="border-stone-200/60 shadow-sm">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-stone-400">{new Date(m.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                      <p className="text-lg font-bold text-stone-900">{fr(m.pluie_mm ?? 0)} mm</p>
                      <p className="text-xs text-stone-400">{fr(m.temp_moyenne_c, 1)} °C</p>
                      <p className="text-[11px] font-medium text-emerald-700 mt-1 leading-tight">{describeJour(m)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border-stone-200/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pluie reçue (en mm)</CardTitle>
                  <CardDescription className="text-xs">Chaque point = une journée. Plus la bosse est haute, plus il a plu.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={meteoChartData}>
                      <defs>
                        <linearGradient id="pluieGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-stone-100" />
                      <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#78716c' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="pluie" stroke="#3b82f6" fill="url(#pluieGrad)" name="Pluie (mm)" animationDuration={500} isAnimationActive={true} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-stone-200/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Chaleur et humidité de l’air</CardTitle>
                  <CardDescription className="text-xs">Ligne orange = température (°C). Ligne verte = humidité de l’air (%). Quand les deux montent ensemble, les maladies fongiques sont favorisées.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={meteoChartData}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="rhGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-stone-100" />
                      <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#78716c' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="temp" stroke="#ea580c" fill="url(#tempGrad)" name="Temp. moy (°C)" animationDuration={500} />
                      <Area type="monotone" dataKey="rh" stroke="#10b981" fill="url(#rhGrad)" name="Humidité (%)" animationDuration={500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="text-xs text-stone-400">
                Chaque jour : pluie reçue, température moyenne et résumé en une phrase.
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alertes">
          <h3 className="font-semibold text-stone-900 mb-3">Alertes ({alertes.length})</h3>
          {alertes.length === 0 ? (
            <EmptyState text="Aucune alerte pour cette culture" />
          ) : (
            <div className="space-y-3">
              {alertes.map((al) => {
                const cfg = getNiveauConfig(al.niveau);
                const isCritical = al.niveau === 'critique' && !al.traitee;
                return (
                  <Card key={al.id} className={`${cfg.border} ${cfg.bg} relative overflow-hidden`}>
                    {isCritical && (
                      <div className="absolute inset-0 border-2 border-red-400 rounded-xl pointer-events-none animate-pulse-ring" />
                    )}
                    <CardContent className="p-4 relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{getTypeAlerteLabel(al.type_alerte)}</Badge>
                            <Badge className={`text-xs ${cfg.color} ${cfg.bg} border ${cfg.border}`}>{cfg.label}</Badge>
                            {al.traitee && <Badge variant="secondary" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Traité</Badge>}
                          </div>
                          <p className="text-sm mt-2 text-stone-800">{al.message}</p>
                          {al.action_recommandee && (
                            <p className="text-xs mt-1 text-stone-500">
                              <span className="font-medium">Action:</span> {al.action_recommandee}
                            </p>
                          )}
                          <p className="text-xs text-stone-400 mt-2">{formatDateTime(al.alerte_le)}</p>
                        </div>
                        {!al.traitee && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkAlerte(al.id)}>
                            Traiter
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ObservationForm
        open={showObsForm}
        onOpenChange={setShowObsForm}
        cultureId={cultureId}
        userId={user?.id ?? null}
        onSaved={loadData}
      />
      <InterventionForm
        open={showIntForm}
        onOpenChange={setShowIntForm}
        cultureId={cultureId}
        onSaved={loadData}
      />
    </div>
  );
}

const InfoItem = memo(function InfoItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-medium text-stone-800 text-sm mt-0.5">{value}</p>
    </div>
  );
});

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed border-2 border-stone-200">
      <CardContent className="p-8 text-center text-stone-400 text-sm">{text}</CardContent>
    </Card>
  );
}

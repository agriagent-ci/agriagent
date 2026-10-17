import { memo, useEffect, useState, useCallback } from 'react';
import { User, MapPin, Phone, Mail, LogOut, Plus, MapPinned, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TYPES_SOL, MODES_IRRIGATION } from '@/lib/constants';
import type { Parcelle } from '@/types/database';

interface ProfilPageProps {
  onNavigate: (screen: 'dashboard' | 'alertes' | 'profil') => void;
}

export function ProfilPage({ onNavigate: _onNavigate }: ProfilPageProps) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [localite, setLocalite] = useState('');
  const [commune, setCommune] = useState('');
  const [saving, setSaving] = useState(false);
  const [showParcelleForm, setShowParcelleForm] = useState(false);
  const [newParcelleNom, setNewParcelleNom] = useState('');
  const [newParcelleCommune, setNewParcelleCommune] = useState('');
  const [newParcelleSuperficie, setNewParcelleSuperficie] = useState('');
  const [newParcelleTypeSol, setNewParcelleTypeSol] = useState('');
  const [newParcelleIrrigation, setNewParcelleIrrigation] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const loadParcelles = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('parcelles')
      .select('*')
      .eq('agriculteur_id', profile.id)
      .order('cree_le', { ascending: false });
    setParcelles((data ?? []) as Parcelle[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadParcelles(); }, [loadParcelles]);

  useEffect(() => {
    if (profile) {
      setNom(profile.nom); setTelephone(profile.telephone ?? '');
      setLocalite(profile.localite ?? ''); setCommune(profile.commune ?? '');
    }
  }, [profile]);

  const handleSaveProfile = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('agriculteurs')
      .update({ nom, telephone, localite, commune, maj_le: new Date().toISOString() })
      .eq('id', profile.id);
    if (!error) { await refreshProfile(); setEditing(false); }
    setSaving(false);
  }, [profile, nom, telephone, localite, commune, refreshProfile]);

  const handleAddParcelle = useCallback(async () => {
    if (!profile || !newParcelleNom.trim()) return;
    const { error } = await supabase.from('parcelles').insert({
      agriculteur_id: profile.id,
      nom: newParcelleNom,
      commune: newParcelleCommune || null,
      superficie_m2: newParcelleSuperficie ? parseFloat(newParcelleSuperficie) : null,
      // Champs facultatifs : le producteur peut les compléter plus tard, ils aident le conseil.
      type_sol: newParcelleTypeSol || null,
      mode_irrigation: newParcelleIrrigation || null,
    });
    if (!error) {
      setShowParcelleForm(false);
      setNewParcelleNom(''); setNewParcelleCommune(''); setNewParcelleSuperficie('');
      setNewParcelleTypeSol(''); setNewParcelleIrrigation('');
      loadParcelles();
    }
  }, [profile, newParcelleNom, newParcelleCommune, newParcelleSuperficie, newParcelleTypeSol, newParcelleIrrigation, loadParcelles]);

  const initials = profile?.nom?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight mb-6">Profil</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-600/25">
            {initials}
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-pulse-ring" />
        </div>
        <div>
          <p className="text-xl font-bold text-stone-900">{profile?.nom ?? '—'}</p>
          <p className="text-sm text-stone-400">{profile?.email ?? '—'}</p>
        </div>
      </div>

      <Card className="mb-4 border-stone-200/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <User className="w-4 h-4 text-emerald-600" />
              </div>
              Informations personnelles
            </CardTitle>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-emerald-600">
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} className="border-stone-200 focus:border-emerald-500" />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="border-stone-200 focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Localité</Label>
                  <Input value={localite} onChange={(e) => setLocalite(e.target.value)} className="border-stone-200 focus:border-emerald-500" />
                </div>
                <div className="space-y-2">
                  <Label>Commune</Label>
                  <Input value={commune} onChange={(e) => setCommune(e.target.value)} className="border-stone-200 focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {saving ? 'Sauvegarde...' : 'Enregistrer'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
              </div>
            </>
          ) : (
            <>
              <InfoRow icon={User} label="Nom" value={profile?.nom ?? '—'} />
              <InfoRow icon={Phone} label="Téléphone" value={profile?.telephone ?? '—'} />
              <InfoRow icon={Mail} label="Email" value={profile?.email ?? '—'} />
              <InfoRow icon={MapPin} label="Localité" value={profile?.localite ?? '—'} />
              <InfoRow icon={MapPinned} label="Commune" value={profile?.commune ?? '—'} />
              <InfoRow icon={MapPin} label="Pays" value={profile?.pays ?? '—'} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4 border-stone-200/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-600" />
              </div>
              Mes parcelles
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowParcelleForm(true)} className="text-emerald-600">
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
            </div>
          ) : parcelles.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">
              Aucune parcelle enregistrée. Ajoutez-en une pour commencer.
            </p>
          ) : (
            <div className="space-y-2">
              {parcelles.map((p) => (
                <ParcelleRow key={p.id} parcelle={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Button variant="destructive" className="w-full shadow-destructive" onClick={() => setShowLogoutConfirm(true)}>
        <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
      </Button>

      <Dialog open={showParcelleForm} onOpenChange={setShowParcelleForm}>
        <DialogContent className="border-stone-200">
          <DialogHeader>
            <DialogTitle>Nouvelle parcelle</DialogTitle>
            <DialogDescription>Ajoutez une parcelle à votre exploitation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la parcelle *</Label>
              <Input value={newParcelleNom} onChange={(e) => setNewParcelleNom(e.target.value)} placeholder="Ex: Champ nord" className="border-stone-200 focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <Label>Commune</Label>
              <Input value={newParcelleCommune} onChange={(e) => setNewParcelleCommune(e.target.value)} placeholder="Ex: Bouaké" className="border-stone-200 focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <Label>Superficie (m²)</Label>
              <Input type="number" value={newParcelleSuperficie} onChange={(e) => setNewParcelleSuperficie(e.target.value)} placeholder="Ex: 500" className="border-stone-200 focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <Label>Type de sol <span className="text-stone-400 font-normal">(facultatif)</span></Label>
              <Select value={newParcelleTypeSol} onValueChange={setNewParcelleTypeSol}>
                <SelectTrigger className="border-stone-200 focus:border-emerald-500">
                  <SelectValue placeholder="Si vous ne savez pas, laissez vide" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_SOL.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-stone-400">
                Aide l'assistant à adapter les conseils d'arrosage et de fertilisation.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Arrosage <span className="text-stone-400 font-normal">(facultatif)</span></Label>
              <Select value={newParcelleIrrigation} onValueChange={setNewParcelleIrrigation}>
                <SelectTrigger className="border-stone-200 focus:border-emerald-500">
                  <SelectValue placeholder="Comment arrosez-vous ?" />
                </SelectTrigger>
                <SelectContent>
                  {MODES_IRRIGATION.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParcelleForm(false)}>Annuler</Button>
            <Button onClick={handleAddParcelle} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="border-stone-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Confirmer la déconnexion</DialogTitle>
            <DialogDescription>Voulez-vous vraiment vous déconnecter ?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Annuler</Button>
            <Button variant="destructive" onClick={signOut}>Se déconnecter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ParcelleRow = memo(function ParcelleRow({ parcelle: p }: { parcelle: Parcelle }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-stone-200/60 hover:border-emerald-200 hover:bg-emerald-50/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-stone-400" />
        </div>
        <div>
          <p className="font-medium text-sm text-stone-800">{p.nom}</p>
          <p className="text-xs text-stone-400">
            {p.commune ?? 'Commune non précisée'}
            {p.superficie_m2 ? ` · ${p.superficie_m2} m²` : ''}
            {p.type_sol ? ` · sol ${p.type_sol}` : ''}
          </p>
        </div>
      </div>
      <Badge variant={p.actif ? 'default' : 'secondary'} className={p.actif ? 'bg-emerald-600' : ''}>
        {p.actif ? 'Actif' : 'Inactif'}
      </Badge>
    </div>
  );
});

const InfoRow = memo(function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-stone-400" />
      </div>
      <span className="text-sm text-stone-400 w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium text-stone-800">{value}</span>
    </div>
  );
});

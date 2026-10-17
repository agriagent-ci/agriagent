import { useEffect, useState, useCallback } from 'react';
import { Sprout, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ESPECES_CULTURE, STADES_CULTURE, STATUTS_CULTURE } from '@/lib/constants';
import { messageErreur } from '@/lib/messages-erreurs';
import type { Parcelle } from '@/types/database';

interface AddCultureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AddCultureForm({ open, onOpenChange, onSaved }: AddCultureFormProps) {
  const { profile } = useAuth();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parcelleId, setParcelleId] = useState('');
  const [espece, setEspece] = useState('');
  const [variete, setVariete] = useState('');
  const [dateSemis, setDateSemis] = useState('');
  const [dateRepiquage, setDateRepiquage] = useState('');
  const [dateRecolte, setDateRecolte] = useState('');
  const [stade, setStade] = useState('pepiniere');
  const [nombrePlants, setNombrePlants] = useState('');
  const [notes, setNotes] = useState('');

  const loadParcelles = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('parcelles')
      .select('*')
      .eq('agriculteur_id', profile.id)
      .eq('actif', true)
      .order('nom');
    setParcelles((data ?? []) as Parcelle[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (open) loadParcelles();
  }, [open, loadParcelles]);

  const handleSave = async () => {
    if (!parcelleId) {
      setError('Veuillez sélectionner une parcelle');
      return;
    }
    if (!espece) {
      setError("Veuillez sélectionner une espèce");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from('cultures').insert({
      parcelle_id: parcelleId,
      espece,
      variete: variete || null,
      date_semis: dateSemis || null,
      date_repiquage: dateRepiquage || null,
      date_recolte_prevue: dateRecolte || null,
      stade,
      nombre_plants: nombrePlants ? parseInt(nombrePlants) : null,
      statut: 'en_cours',
      notes: notes || null,
    });

    if (insErr) {
      setError(messageErreur(insErr) ?? insErr.message);
      setSaving(false);
      return;
    }

    resetForm();
    onSaved();
    onOpenChange(false);
    setSaving(false);
  };

  const resetForm = () => {
    setParcelleId(''); setEspece(''); setVariete(''); setDateSemis(''); setDateRepiquage('');
    setDateRecolte(''); setStade('pepiniere'); setNombrePlants(''); setNotes(''); setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle culture</DialogTitle>
          <DialogDescription>Ajoutez une culture à votre suivi</DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-40" />
        ) : parcelles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Sprout className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Vous devez d'abord créer une parcelle dans votre profil avant d'ajouter une culture.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Parcelle *</Label>
              <Select value={parcelleId} onValueChange={setParcelleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez une parcelle..." /></SelectTrigger>
                <SelectContent>
                  {parcelles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}{p.commune ? ` · ${p.commune}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Espèce *</Label>
                <Select value={espece} onValueChange={setEspece}>
                  <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
                  <SelectContent>
                    {ESPECES_CULTURE.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Variété</Label>
                <Input value={variete} onChange={(e) => setVariete(e.target.value)} placeholder="Ex: Roma VF" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date semis</Label>
                <Input type="date" value={dateSemis} onChange={(e) => setDateSemis(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date repiquage</Label>
                <Input type="date" value={dateRepiquage} onChange={(e) => setDateRepiquage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Récolte prévue</Label>
                <Input type="date" value={dateRecolte} onChange={(e) => setDateRecolte(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stade</Label>
                <Select value={stade} onValueChange={setStade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STADES_CULTURE.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre de plants</Label>
                <Input type="number" value={nombrePlants} onChange={(e) => setNombrePlants(e.target.value)} placeholder="Ex: 200" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes sur cette culture..." rows={2} />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || parcelles.length === 0}>
            {saving ? 'Enregistrement...' : 'Créer la culture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

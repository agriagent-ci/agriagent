import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TYPES_INTERVENTION } from '@/lib/constants';

interface InterventionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultureId: string;
  onSaved: () => void;
}

export function InterventionForm({ open, onOpenChange, cultureId, onSaved }: InterventionFormProps) {
  const [type, setType] = useState('');
  const [produit, setProduit] = useState('');
  const [matiereActive, setMatiereActive] = useState('');
  const [dose, setDose] = useState('');
  const [uniteDose, setUniteDose] = useState('');
  const [surface, setSurface] = useState('');
  const [delai, setDelai] = useState('');
  const [cout, setCout] = useState('');
  const [operateur, setOperateur] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!type) {
      setError("Veuillez sélectionner un type d'intervention");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from('interventions').insert({
      culture_id: cultureId,
      type_intervention: type,
      produit: produit || null,
      matiere_active: matiereActive || null,
      dose: dose ? parseFloat(dose) : null,
      unite_dose: uniteDose || null,
      surface_traitee_m2: surface ? parseFloat(surface) : null,
      delai_avant_recolte_j: delai ? parseInt(delai) : null,
      cout_fcfa: cout ? parseInt(cout) : null,
      operateur: operateur || null,
      notes: notes || null,
    });

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    resetForm();
    onSaved();
    onOpenChange(false);
    setSaving(false);
  };

  const resetForm = () => {
    setType(''); setProduit(''); setMatiereActive(''); setDose(''); setUniteDose('');
    setSurface(''); setDelai(''); setCout(''); setOperateur(''); setNotes(''); setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle intervention</DialogTitle>
          <DialogDescription>Enregistrez une intervention sur cette culture</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type d'intervention *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
              <SelectContent>
                {TYPES_INTERVENTION.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Produit</Label>
              <Input value={produit} onChange={(e) => setProduit(e.target.value)} placeholder="Ex: Manèbe 80%" />
            </div>
            <div className="space-y-2">
              <Label>Matière active</Label>
              <Input value={matiereActive} onChange={(e) => setMatiereActive(e.target.value)} placeholder="Ex: Mancozebe" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Dose</Label>
              <Input type="number" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex: 2.5" />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={uniteDose} onValueChange={setUniteDose}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g/L">g/L</SelectItem>
                  <SelectItem value="kg/ha">kg/ha</SelectItem>
                  <SelectItem value="L/ha">L/ha</SelectItem>
                  <SelectItem value="ml/L">ml/L</SelectItem>
                  <SelectItem value="g/m²">g/m²</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Surface (m²)</Label>
              <Input type="number" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="Ex: 500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Délai avant récolte (j)</Label>
              <Input type="number" value={delai} onChange={(e) => setDelai(e.target.value)} placeholder="Ex: 14" />
            </div>
            <div className="space-y-2">
              <Label>Coût (FCFA)</Label>
              <Input type="number" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="Ex: 5000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Opérateur</Label>
            <Input value={operateur} onChange={(e) => setOperateur(e.target.value)} placeholder="Ex: Konan Kouassi" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes supplémentaires..." rows={2} />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

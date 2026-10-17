import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { CATEGORIES_OBSERVATION, ORGANES_ATTEINTS, FACES_FEUILLE } from '@/lib/constants';

interface ObservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultureId: string;
  userId: string | null;
  onSaved: () => void;
}

export function ObservationForm({ open, onOpenChange, cultureId, userId, onSaved }: ObservationFormProps) {
  const [categorie, setCategorie] = useState('');
  const [description, setDescription] = useState('');
  const [organe, setOrgane] = useState('');
  const [face, setFace] = useState('');
  const [severite, setSeverite] = useState(1);
  const [incidence, setIncidence] = useState('');
  const [hauteurFront, setHauteurFront] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${cultureId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('observations')
        .upload(fileName, file);

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('observations')
        .getPublicUrl(fileName);

      setPhotoUrl(urlData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement de la photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!categorie) {
      setError('Veuillez sélectionner une catégorie');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from('observations').insert({
      culture_id: cultureId,
      categorie,
      description: description || null,
      organe_atteint: organe || null,
      face_feuille: face || null,
      severite: categorie !== 'visite' ? severite : null,
      incidence_pct: incidence ? parseFloat(incidence) : null,
      hauteur_front_cm: hauteurFront ? parseFloat(hauteurFront) : null,
      photo_url: photoUrl,
      saisi_par: userId,
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
    setCategorie(''); setDescription(''); setOrgane(''); setFace('');
    setSeverite(1); setIncidence(''); setHauteurFront(''); setPhotoUrl(null); setError(null);
  };

  const severiteColor = severite >= 7 ? 'from-red-500 to-red-600' : severite >= 4 ? 'from-orange-500 to-orange-600' : 'from-yellow-400 to-yellow-500';

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-stone-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nouvelle observation</DialogTitle>
          <DialogDescription>Enregistrez une observation sur cette culture</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-stone-700">Catégorie *</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger className="border-stone-200 focus:border-emerald-500"><SelectValue placeholder="Sélectionnez..." /></SelectTrigger>
              <SelectContent>
                {CATEGORIES_OBSERVATION.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-stone-700">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce que vous observez..."
              rows={3}
              className="border-stone-200 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-stone-700">Organe atteint</Label>
              <Select value={organe} onValueChange={setOrgane}>
                <SelectTrigger className="border-stone-200"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {ORGANES_ATTEINTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-stone-700">Face feuille</Label>
              <Select value={face} onValueChange={setFace}>
                <SelectTrigger className="border-stone-200"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {FACES_FEUILLE.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {categorie !== 'visite' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <Label className="text-stone-700">Sévérité</Label>
                <motion.span
                  key={severite}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className={`text-lg font-bold bg-gradient-to-r ${severiteColor} bg-clip-text text-transparent`}
                >
                  {severite}/9
                </motion.span>
              </div>
              <div className="relative">
                <Slider
                  value={[severite]}
                  onValueChange={(v) => setSeverite(v[0])}
                  min={1}
                  max={9}
                  step={1}
                />
                <motion.div
                  className="absolute -top-1 h-5 rounded-full pointer-events-none"
                  initial={false}
                  animate={{ width: `${((severite - 1) / 8) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    background: 'linear-gradient(90deg, #fbbf24 0%, #f97316 50%, #dc2626 100%)',
                    opacity: 0.15,
                    left: 0,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-stone-400">
                <span>1 = négligeable</span><span>9 = très grave</span>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-stone-700">Incidence (%)</Label>
              <Input type="number" value={incidence} onChange={(e) => setIncidence(e.target.value)} placeholder="Ex: 25" className="border-stone-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-stone-700">Hauteur front (cm)</Label>
              <Input type="number" value={hauteurFront} onChange={(e) => setHauteurFront(e.target.value)} placeholder="Ex: 30" className="border-stone-200" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-stone-700">Photo</Label>
            <AnimatePresence mode="wait">
              {photoUrl ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative inline-block"
                >
                  <img src={photoUrl} alt="Observation" className="w-32 h-32 rounded-xl object-cover ring-2 ring-emerald-200" />
                  <button
                    onClick={() => setPhotoUrl(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ) : (
                <motion.label
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-xl p-6 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-emerald-500 mb-2 animate-spin" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-stone-400" />
                    </div>
                  )}
                  <span className="text-sm text-stone-500">
                    {uploading ? 'Téléchargement...' : 'Cliquer pour ajouter une photo'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </motion.label>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 shadow-primary">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

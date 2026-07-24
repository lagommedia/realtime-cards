'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, ChevronRight, ChevronLeft, Check, Search, Sparkles, Loader2 } from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import { getSetsForYear } from '@/lib/card-sets';
import CropSheet from '@/components/CropSheet';
import type { CardAnalysis } from '@/app/api/card/analyze/route';

const GRADES = ['Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'SGC 10', 'SGC 9'];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid #e2e8f0', fontSize: 14,
  background: '#fff', color: '#0f172a', outline: 'none',
};

interface PlayerResult {
  id: number;
  fullName: string;
  currentTeam?: { id: number; name: string };
  primaryPosition?: { name: string; abbreviation: string };
}

async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function searchPlayers(q: string): Promise<PlayerResult[]> {
  if (q.length < 2) return [];
  try {
    const r = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
    const d = await r.json() as { people: PlayerResult[] };
    return d.people ?? [];
  } catch { return []; }
}

interface Props { onClose: () => void; }

export default function AddCardSheet({ onClose }: Props) {
  const { addCard } = useCollection();
  const [step, setStep]     = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — front + back photos
  const [frontPhoto, setFrontPhoto]   = useState<string | null>(null);
  const [backPhoto, setBackPhoto]     = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [cropTarget, setCropTarget]   = useState<'front' | 'back' | null>(null);
  const captureTargetRef              = useRef<'front' | 'back'>('front');
  const [analyzing, setAnalyzing]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — card details
  const [playerQuery,    setPlayerQuery]    = useState('');
  const [playerResults,  setPlayerResults]  = useState<PlayerResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [year,           setYear]           = useState<string>(String(new Date().getFullYear()));
  const [cardSet,        setCardSet]        = useState('');
  const [cardSetCustom,  setCardSetCustom]  = useState(false); // "Other / Custom" selected
  const [grade,          setGrade]          = useState('Raw');
  const [searching,      setSearching]      = useState(false);
  const [aiPopulated,    setAiPopulated]    = useState(false);

  // Step 3 — purchase
  const [price,        setPrice]        = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes,        setNotes]        = useState('');

  // Sets available for current year
  const yearNum   = parseInt(year) || new Date().getFullYear();
  const yearSets  = getSetsForYear(yearNum);

  // When year changes: if current set is gone from list, switch to custom mode
  useEffect(() => {
    if (!cardSet || cardSetCustom) return;
    if (!getSetsForYear(parseInt(year) || new Date().getFullYear()).includes(cardSet)) {
      setCardSetCustom(true);
    }
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced manual player search
  useEffect(() => {
    if (playerQuery.length < 2 || selectedPlayer) { setPlayerResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlayers(playerQuery)
        .then(p => setPlayerResults(p))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [playerQuery, selectedPlayer]);

  // ── AI analysis (runs in background after front photo, does NOT auto-advance) ──
  const analyzeInBackground = useCallback(async (dataUrl: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/card/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const analysis = await res.json() as CardAnalysis;

      if (analysis.year) setYear(analysis.year);
      if (analysis.set) {
        const sets = getSetsForYear(parseInt(analysis.year ?? year) || yearNum);
        if (sets.includes(analysis.set)) {
          setCardSet(analysis.set);
          setCardSetCustom(false);
        } else {
          setCardSet(analysis.set);
          setCardSetCustom(true);
        }
      }
      if (analysis.grade && GRADES.includes(analysis.grade)) setGrade(analysis.grade);

      if (analysis.playerName) {
        setPlayerQuery(analysis.playerName);
        const people = await searchPlayers(analysis.playerName);
        if (people.length > 0) {
          const exact = people.find(p => p.fullName.toLowerCase() === analysis.playerName!.toLowerCase());
          const best  = exact ?? people[0];
          setSelectedPlayer(best);
          setPlayerQuery(best.fullName);
          setPlayerResults([]);
        }
      }
      setAiPopulated(true);
    } catch {
      // AI failed silently — user fills in details manually
    } finally {
      setAnalyzing(false);
    }
  }, [year, yearNum]);

  // ── Photo flow ────────────────────────────────────────────────
  const capturePhoto = useCallback((side: 'front' | 'back') => {
    captureTargetRef.current = side;
    fileInputRef.current?.click();
  }, []);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressed = await compressPhoto(file);
      setPendingPhoto(compressed);
      setCropTarget(captureTargetRef.current);
    } catch {}
  }, []);

  const handleCropDone = useCallback(async (croppedUrl: string) => {
    const side = cropTarget;
    setCropTarget(null);
    setPendingPhoto(null);
    if (side === 'front') {
      setFrontPhoto(croppedUrl);
      setAiPopulated(false);
      analyzeInBackground(croppedUrl); // non-blocking
    } else {
      setBackPhoto(croppedUrl);
    }
  }, [cropTarget, analyzeInBackground]);

  const handleCropSkip = useCallback(() => {
    const side = cropTarget;
    const raw = pendingPhoto;
    setCropTarget(null);
    setPendingPhoto(null);
    if (!raw) return;
    if (side === 'front') {
      setFrontPhoto(raw);
      setAiPopulated(false);
      analyzeInBackground(raw);
    } else {
      setBackPhoto(raw);
    }
  }, [cropTarget, pendingPhoto, analyzeInBackground]);

  // ── Validation ────────────────────────────────────────────────
  const canAdvanceStep1 = !analyzing; // can proceed even without photos (skip path)
  const canAdvanceStep2 = !!selectedPlayer && !!cardSet;
  const canSave = canAdvanceStep2 && price !== '' && !isNaN(parseFloat(price)) && parseFloat(price) >= 0;

  const handleSave = async () => {
    if (!selectedPlayer || !canSave) return;
    setSaving(true);
    try {
      await addCard({
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.fullName,
        teamId: selectedPlayer.currentTeam?.id ?? 0,
        position: selectedPlayer.primaryPosition?.abbreviation ?? '',
        year: year ? parseInt(year) : null,
        set: cardSet || null,
        grade,
        purchasePrice: parseFloat(price),
        purchaseDate,
        photoDataUrl: frontPhoto,
        photoBackDataUrl: backPhoto,
        notes: notes || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Crop overlay (full-screen, above sheet) */}
      {cropTarget !== null && pendingPhoto && (
        <CropSheet
          imageDataUrl={pendingPhoto}
          hint={cropTarget === 'front' ? 'Front of card' : 'Back of card'}
          onApply={handleCropDone}
          onSkip={handleCropSkip}
        />
      )}

      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        />

        {/* Sheet */}
        <div className="glass-card" style={{ position: 'relative', borderRadius: '24px 24px 0 0', padding: '0 0 max(24px, env(safe-area-inset-bottom))', maxHeight: '92dvh', overflowY: 'auto' }}>
          {/* Handle + header */}
          <div style={{ padding: '12px 20px 0', textAlign: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#0000001a', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Add Card</p>
              <button onClick={onClose} style={{ padding: 6, color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
              {([1, 2, 3] as const).map(s => (
                <div key={s} style={{ width: s === step ? 20 : 6, height: 6, borderRadius: 3, background: s === step ? '#1e40af' : s < step ? '#60a5fa' : '#e2e8f0', transition: 'all 0.25s' }} />
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px' }}>

            {/* ── Step 1: Front + Back Photos ── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />

                {/* AI hint */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 99, background: '#eff6ff', border: '1px solid #bfdbfe', alignSelf: 'center' }}>
                  <Sparkles size={13} color="#3b82f6" />
                  <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                    {analyzing ? 'AI analyzing front…' : 'AI auto-fills card details from the front photo'}
                  </span>
                  {analyzing && <Loader2 size={12} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                </div>

                {/* Side-by-side photo slots */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  {/* Front */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Front</span>
                    {frontPhoto ? (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={frontPhoto}
                          alt="Front"
                          style={{ width: 140, height: 196, objectFit: 'cover', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', filter: analyzing ? 'brightness(0.65)' : undefined, transition: 'filter 0.2s' }}
                        />
                        {analyzing && (
                          <div style={{ position: 'absolute', inset: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={22} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                          </div>
                        )}
                        <button
                          onClick={() => { setFrontPhoto(null); setAiPopulated(false); }}
                          style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', borderRadius: 999, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={12} />
                        </button>
                        <div style={{ position: 'absolute', bottom: 6, left: 6, background: '#16a34a', borderRadius: 99, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => capturePhoto('front')}
                        style={{ width: 140, height: 196, borderRadius: 10, border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b', cursor: 'pointer' }}
                      >
                        <Camera size={30} strokeWidth={1.5} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Add Front</span>
                      </button>
                    )}
                  </div>

                  {/* Back */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: frontPhoto ? '#64748b' : '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Back</span>
                    {backPhoto ? (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={backPhoto}
                          alt="Back"
                          style={{ width: 140, height: 196, objectFit: 'cover', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                        />
                        <button
                          onClick={() => setBackPhoto(null)}
                          style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', borderRadius: 999, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={12} />
                        </button>
                        <div style={{ position: 'absolute', bottom: 6, left: 6, background: '#16a34a', borderRadius: 99, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => capturePhoto('back')}
                        disabled={!frontPhoto}
                        style={{ width: 140, height: 196, borderRadius: 10, border: '2px dashed #cbd5e1', background: frontPhoto ? '#f8fafc' : '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: frontPhoto ? '#64748b' : '#cbd5e1', cursor: frontPhoto ? 'pointer' : 'not-allowed' }}
                      >
                        <Camera size={30} strokeWidth={1.5} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{frontPhoto ? 'Add Back' : 'Add Front first'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Both captured nudge / status */}
                {frontPhoto && backPhoto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #bbf7d0', alignSelf: 'center' }}>
                    <Check size={13} color="#16a34a" strokeWidth={3} />
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Both sides captured — great for eBay listings!</span>
                  </div>
                )}
                {frontPhoto && !backPhoto && (
                  <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    Back photo recommended for eBay listings
                  </p>
                )}

                <div style={{ width: '100%', display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setStep(2)}
                    disabled={analyzing}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f1f5f9', color: analyzing ? '#cbd5e1' : '#64748b', fontWeight: 600, fontSize: 14 }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => frontPhoto ? setStep(2) : capturePhoto('front')}
                    disabled={!canAdvanceStep1}
                    style={{ flex: 2, padding: '12px', borderRadius: 12, background: canAdvanceStep1 ? '#1e40af' : '#e2e8f0', color: canAdvanceStep1 ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {analyzing ? (
                      <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
                    ) : frontPhoto ? (
                      <>Next <ChevronRight size={16} /></>
                    ) : (
                      <>Take Front Photo <Camera size={15} /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Card details ── */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>

                {aiPopulated && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <Sparkles size={13} color="#16a34a" />
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Card details auto-filled — review and confirm</span>
                  </div>
                )}

                {/* Player */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Player *</label>
                  {selectedPlayer ? (
                    <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{selectedPlayer.fullName}</p>
                        <p style={{ fontSize: 12, color: '#3b82f6' }}>{selectedPlayer.currentTeam?.name ?? 'Free Agent'} · {selectedPlayer.primaryPosition?.abbreviation}</p>
                      </div>
                      <button onClick={() => { setSelectedPlayer(null); setPlayerQuery(''); }}><X size={16} color="#3b82f6" /></button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', marginTop: 6 }}>
                      <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        autoFocus
                        value={playerQuery}
                        onChange={e => setPlayerQuery(e.target.value)}
                        placeholder="Search player name…"
                        style={{ ...INPUT_STYLE, paddingLeft: 36 }}
                      />
                      {playerResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: 4 }}>
                          {playerResults.slice(0, 6).map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedPlayer(p); setPlayerQuery(p.fullName); setPlayerResults([]); }}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 1 }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{p.fullName}</span>
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.currentTeam?.name ?? 'Free Agent'} · {p.primaryPosition?.abbreviation ?? '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searching && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Searching…</p>}
                    </div>
                  )}
                </div>

                {/* Year */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    placeholder="2021"
                    min={1900} max={2099}
                    style={{ ...INPUT_STYLE, marginTop: 6 }}
                  />
                </div>

                {/* Set — dropdown based on year */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Set *</label>
                  {cardSetCustom ? (
                    <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                      <input
                        autoFocus
                        value={cardSet}
                        onChange={e => setCardSet(e.target.value)}
                        placeholder="Enter set name…"
                        style={{ ...INPUT_STYLE, flex: 1 }}
                      />
                      <button
                        onClick={() => { setCardSetCustom(false); setCardSet(''); }}
                        style={{ padding: '10px 12px', borderRadius: 10, background: '#f1f5f9', color: '#64748b', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        List
                      </button>
                    </div>
                  ) : (
                    <select
                      value={cardSet}
                      onChange={e => {
                        if (e.target.value === '__other__') { setCardSetCustom(true); setCardSet(''); }
                        else setCardSet(e.target.value);
                      }}
                      style={{ ...INPUT_STYLE, marginTop: 6, appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}
                    >
                      <option value="" style={{ color: '#94a3b8' }}>Select a set…</option>
                      {yearSets.map(s => (
                        <option key={s} value={s} style={{ color: '#0f172a' }}>{s}</option>
                      ))}
                      <option value="__other__" style={{ color: '#3b82f6' }}>Other / Custom…</option>
                    </select>
                  )}
                </div>

                {/* Grade */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grade / Condition</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {GRADES.map(g => (
                      <button
                        key={g}
                        onClick={() => setGrade(g)}
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: grade === g ? '#1e40af' : '#f1f5f9', color: grade === g ? '#fff' : '#475569', border: grade === g ? '1px solid #1e40af' : '1px solid transparent', transition: 'all 0.15s' }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canAdvanceStep2}
                    style={{ flex: 2, padding: '12px', borderRadius: 12, background: canAdvanceStep2 ? '#1e40af' : '#e2e8f0', color: canAdvanceStep2 ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Purchase info ── */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>I paid *</label>
                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>$</span>
                    <input
                      autoFocus
                      type="number" step="0.01" min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      style={{ ...INPUT_STYLE, paddingLeft: 32, fontSize: 22, fontWeight: 700, padding: '14px 14px 14px 32px', borderWidth: 1.5, borderRadius: 12 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date purchased</label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={{ ...INPUT_STYLE, marginTop: 6 }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Where you bought it, condition notes…"
                    rows={2}
                    style={{ ...INPUT_STYLE, marginTop: 6, resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Summary</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedPlayer?.fullName}</p>
                  <p style={{ fontSize: 12, color: '#64748b' }}>{[year, cardSet, grade].filter(Boolean).join(' · ')}</p>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    style={{ flex: 2, padding: '12px', borderRadius: 12, background: canSave ? '#1e40af' : '#e2e8f0', color: canSave ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {saving ? 'Saving…' : <><Check size={16} /> Add to Collection</>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

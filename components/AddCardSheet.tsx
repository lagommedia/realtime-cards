'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, ChevronRight, ChevronLeft, Check, Search, Sparkles, Loader2 } from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import type { CardAnalysis } from '@/app/api/card/analyze/route';

const GRADES = ['Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'SGC 10', 'SGC 9'];

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
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function searchPlayers(q: string): Promise<PlayerResult[]> {
  if (q.length < 2) return [];
  try {
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
    const d = await res.json() as { people: PlayerResult[] };
    return d.people ?? [];
  } catch { return []; }
}

interface Props {
  onClose: () => void;
}

export default function AddCardSheet({ onClose }: Props) {
  const { addCard } = useCollection();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: photo + AI analysis
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: card details
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [cardSet, setCardSet] = useState('');
  const [grade, setGrade] = useState('Raw');
  const [searching, setSearching] = useState(false);
  const [aiPopulated, setAiPopulated] = useState(false);

  // Step 3: purchase
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Debounced player search (manual typing only)
  useEffect(() => {
    if (playerQuery.length < 2 || selectedPlayer) {
      setPlayerResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlayers(playerQuery)
        .then(people => setPlayerResults(people))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [playerQuery, selectedPlayer]);

  const analyzeAndAdvance = useCallback(async (dataUrl: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/card/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const analysis = await res.json() as CardAnalysis;

      // Pre-populate whatever Claude found
      if (analysis.year) setYear(analysis.year);
      if (analysis.set) setCardSet(analysis.set);
      if (analysis.grade && GRADES.includes(analysis.grade)) setGrade(analysis.grade);

      // Auto-resolve player: search and auto-select if name found
      if (analysis.playerName) {
        setPlayerQuery(analysis.playerName);
        const people = await searchPlayers(analysis.playerName);
        if (people.length > 0) {
          // Pick the best match — exact name match wins, else first result
          const exact = people.find(
            p => p.fullName.toLowerCase() === analysis.playerName!.toLowerCase()
          );
          const best = exact ?? people[0];
          setSelectedPlayer(best);
          setPlayerQuery(best.fullName);
          setPlayerResults([]);
        } else {
          setPlayerResults([]);
        }
      }

      setAiPopulated(true);
    } catch {
      // Analysis failed — just advance to step 2 with empty fields
    } finally {
      setAnalyzing(false);
      setStep(2);
    }
  }, []);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so the same file can be re-selected
    e.target.value = '';
    try {
      const compressed = await compressPhoto(file);
      setPhoto(compressed);
      setAiPopulated(false);
      await analyzeAndAdvance(compressed);
    } catch {}
  }, [analyzeAndAdvance]);

  const canAdvanceStep2 = !!selectedPlayer;
  const canSave = !!selectedPlayer && price !== '' && !isNaN(parseFloat(price)) && parseFloat(price) >= 0;

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
        photoDataUrl: photo,
        notes: notes || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div
        className="glass-card"
        style={{
          position: 'relative',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 max(24px, env(safe-area-inset-bottom))',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        {/* Handle + header */}
        <div style={{ padding: '12px 20px 0', textAlign: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#0000001a', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Add Card</p>
            <button onClick={onClose} style={{ padding: 6, color: '#64748b' }}><X size={20} /></button>
          </div>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
            {([1, 2, 3] as const).map(s => (
              <div key={s} style={{
                width: s === step ? 20 : 6, height: 6, borderRadius: 3,
                background: s === step ? '#1e40af' : s < step ? '#60a5fa' : '#e2e8f0',
                transition: 'all 0.25s',
              }} />
            ))}
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>

          {/* ── Step 1: Photo ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />

              {/* Photo preview / placeholder */}
              {photo ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={photo}
                    alt="Card photo"
                    style={{
                      width: 200, height: 280, objectFit: 'cover', borderRadius: 12,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                      filter: analyzing ? 'brightness(0.55)' : undefined,
                      transition: 'filter 0.2s',
                    }}
                  />
                  {analyzing && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8,
                    }}>
                      <Loader2 size={28} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>
                        Analyzing<br />card…
                      </span>
                    </div>
                  )}
                  {!analyzing && (
                    <button
                      onClick={() => { setPhoto(null); setAiPopulated(false); }}
                      style={{
                        position: 'absolute', top: -8, right: -8,
                        background: '#ef4444', color: '#fff', borderRadius: 999,
                        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 200, height: 280, borderRadius: 12,
                    border: '2px dashed #cbd5e1', background: '#f8fafc',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 12, color: '#64748b', cursor: 'pointer',
                  }}
                >
                  <Camera size={40} strokeWidth={1.5} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Scan Card</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Camera or photo library</span>
                </button>
              )}

              {/* AI hint */}
              {!photo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 99, background: '#eff6ff', border: '1px solid #bfdbfe',
                }}>
                  <Sparkles size={13} color="#3b82f6" />
                  <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                    AI will auto-fill card details from your photo
                  </span>
                </div>
              )}

              {photo && !analyzing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}
                >
                  Retake photo
                </button>
              )}

              <div style={{ width: '100%', display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setStep(2)}
                  disabled={analyzing}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: '#f1f5f9', color: analyzing ? '#cbd5e1' : '#64748b',
                    fontWeight: 600, fontSize: 14,
                  }}
                >
                  Skip
                </button>
                <button
                  onClick={() => photo ? setStep(2) : fileInputRef.current?.click()}
                  disabled={analyzing}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12,
                    background: analyzing ? '#e2e8f0' : '#1e40af',
                    color: analyzing ? '#94a3b8' : '#fff',
                    fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {analyzing ? (
                    <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
                  ) : photo ? (
                    <>Next <ChevronRight size={16} /></>
                  ) : (
                    <>Take Photo <Camera size={15} /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Card details ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>

              {/* AI populated badge */}
              {aiPopulated && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 10,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                }}>
                  <Sparkles size={13} color="#16a34a" />
                  <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                    Card details auto-filled from your photo — review and confirm
                  </span>
                </div>
              )}

              {/* Player search */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Player *
                </label>
                {selectedPlayer ? (
                  <div
                    style={{
                      marginTop: 6, padding: '10px 14px', borderRadius: 10,
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{selectedPlayer.fullName}</p>
                      <p style={{ fontSize: 12, color: '#3b82f6' }}>
                        {selectedPlayer.currentTeam?.name ?? 'Free Agent'} · {selectedPlayer.primaryPosition?.abbreviation}
                      </p>
                    </div>
                    <button onClick={() => { setSelectedPlayer(null); setPlayerQuery(''); }}>
                      <X size={16} color="#3b82f6" />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        autoFocus
                        value={playerQuery}
                        onChange={e => setPlayerQuery(e.target.value)}
                        placeholder="Search player name…"
                        style={{
                          width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
                          border: '1px solid #e2e8f0', fontSize: 14, background: '#fff',
                          outline: 'none',
                        }}
                      />
                    </div>
                    {playerResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: 4,
                      }}>
                        {playerResults.slice(0, 6).map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPlayer(p); setPlayerQuery(p.fullName); setPlayerResults([]); }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '10px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex', flexDirection: 'column', gap: 1,
                            }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{p.fullName}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              {p.currentTeam?.name ?? 'Free Agent'} · {p.primaryPosition?.abbreviation ?? '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searching && (
                      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Searching…</p>
                    )}
                  </div>
                )}
              </div>

              {/* Year */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="2021"
                  min={1900} max={2099}
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff', outline: 'none',
                  }}
                />
              </div>

              {/* Set */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Set <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
                </label>
                <input
                  value={cardSet}
                  onChange={e => setCardSet(e.target.value)}
                  placeholder="Topps Chrome, Prizm, Bowman…"
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff', outline: 'none',
                  }}
                />
              </div>

              {/* Grade */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Grade / Condition
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {GRADES.map(g => (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: grade === g ? '#1e40af' : '#f1f5f9',
                        color: grade === g ? '#fff' : '#475569',
                        border: grade === g ? '1px solid #1e40af' : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canAdvanceStep2}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12,
                    background: canAdvanceStep2 ? '#1e40af' : '#e2e8f0',
                    color: canAdvanceStep2 ? '#fff' : '#94a3b8',
                    fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Purchase info ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
              {/* Price */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  I paid *
                </label>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 18, fontWeight: 700, color: '#0f172a',
                  }}>$</span>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%', padding: '14px 14px 14px 32px', borderRadius: 12,
                      border: '1.5px solid #e2e8f0', fontSize: 22, fontWeight: 700,
                      background: '#fff', outline: 'none', color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Date purchased
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff', outline: 'none',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Notes <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Where you bought it, condition notes…"
                  rows={2}
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #e2e8f0', fontSize: 14, background: '#fff', outline: 'none',
                    resize: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Summary */}
              <div style={{
                padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Summary
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedPlayer?.fullName}</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>
                  {[year, cardSet, grade].filter(Boolean).join(' · ')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12,
                    background: canSave ? '#1e40af' : '#e2e8f0',
                    color: canSave ? '#fff' : '#94a3b8',
                    fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {saving ? 'Saving…' : <><Check size={16} /> Add to Collection</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

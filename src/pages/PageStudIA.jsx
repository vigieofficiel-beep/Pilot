import { useState, useEffect, useRef } from 'react'

const STUDIA_COLOR = '#7F77DD'
const AGENTS_API_URL = 'https://agents.vigie-officiel.com'

const TABS = [
  { id: 'voix',    label: 'Clone IA voix',       emoji: '🎙️', subtitle: 'Cloner ta voix et générer des audios' },
  { id: 'images',  label: 'Photos & Images IA',  emoji: '🖼️', subtitle: 'Générer des images par lot' },
  { id: 'cinema',  label: 'Studio Cinéma',       emoji: '🎬', subtitle: 'Vidéos longues 3-12 min, montage auto' },
  { id: 'shorts',  label: 'Tutos vidéo courts',  emoji: '⚡', subtitle: 'Shorts 30s-2min vertical 9:16' },
]

const TON_OPTIONS = [
  { val: 'neutre',       label: '😐 Neutre' },
  { val: 'enthousiaste', label: '😄 Enthousiaste' },
  { val: 'serieux',      label: '🧐 Sérieux' },
  { val: 'inquiet',      label: '😟 Inquiet' },
  { val: 'ironique',     label: '😏 Ironique' },
]

const STYLES_IMG = [
  { val: 'photo',     label: 'Photoréaliste', emoji: '📷', palette: ['#3a4d5c', '#5a6d7c', '#8a9dac'] },
  { val: 'illu',      label: 'Illustration',  emoji: '🎨', palette: ['#e8a87c', '#c38d9e', '#85dcb8'] },
  { val: 'aquarelle', label: 'Aquarelle',     emoji: '🖌️', palette: ['#a8d8ea', '#aa96da', '#fcbad3'] },
  { val: '3d',        label: '3D',            emoji: '🧊', palette: ['#7f77dd', '#5d4e6d', '#3a2e44'] },
  { val: 'cinema',    label: 'Cinématique',   emoji: '🎞️', palette: ['#1a1a2e', '#c9b037', '#16213e'] },
  { val: 'cartoon',   label: 'Cartoon',       emoji: '✏️', palette: ['#ff6b6b', '#feca57', '#48dbfb'] },
]

const FORMATS_IMG = [
  { val: '1:1',  label: 'Carré',      emoji: '⬛', dims: '1024×1024', ratio: 1 },
  { val: '9:16', label: 'Vertical',   emoji: '📱', dims: '768×1344',  ratio: 9/16 },
  { val: '16:9', label: 'Horizontal', emoji: '🖥️', dims: '1344×768',  ratio: 16/9 },
  { val: '4:5',  label: 'Insta',      emoji: '📸', dims: '896×1120',  ratio: 4/5 },
]

const STYLES_VIDEO = [
  { val: 'documentaire', label: 'Documentaire',  emoji: '📚' },
  { val: 'cinema',       label: 'Cinématique',    emoji: '🎞️' },
  { val: 'vlog',         label: 'Vlog',           emoji: '📹' },
  { val: 'investigation', label: 'Investigation', emoji: '🔍' },
]

const STYLES_SHORT = [
  { val: 'demo',     label: 'Démo écran',         emoji: '🖥️' },
  { val: 'anime',    label: 'Animé',              emoji: '✨' },
  { val: 'slides',   label: 'Voix-off + slides',  emoji: '🎯' },
  { val: 'texte',    label: 'Texte animé',        emoji: '🔤' },
]

const PHASES_VIDEO = [
  { id: 'script',  label: 'Génération du script',     emoji: '✍️', mockMs: 0,    real: true  },
  { id: 'voice',   label: 'Synthèse de la voix-off',  emoji: '🎙️', mockMs: 2000, real: false },
  { id: 'visuals', label: 'Création des visuels',     emoji: '🎨', mockMs: 2500, real: false },
  { id: 'edit',    label: 'Assemblage et montage',    emoji: '✂️', mockMs: 1800, real: false },
  { id: 'render',  label: 'Finalisation',             emoji: '🎬', mockMs: 1200, real: false },
]

const iS = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDE8DB', fontSize: 13, outline: 'none',
  fontFamily: "'Nunito Sans',sans-serif", boxSizing: 'border-box', lineHeight: 1.6,
}

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ============================================
// HELPERS API AGENTS DOPPLER (Stud'IA)
// ============================================

/**
 * Récupère la clé X-API-Key Agents Doppler depuis le Coffre-fort Pilot.
 * Identique au pattern utilisé dans PageProspects.
 */
function getAgentsApiKey() {
  try {
    const vault = JSON.parse(localStorage.getItem('pilotage_vault') || '[]')
    const compte = vault.find(c =>
      c.nom && c.nom.toLowerCase().includes('agents doppler') && c.api_key
    )
    return compte?.api_key || null
  } catch {
    return null
  }
}

/**
 * Génère un script vidéo via Claude API.
 */
async function genererScriptIA({ projectId, titre, sujet, dureeCibleMin, style, bRoll, voixName }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) {
    throw new Error('Clé Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  }

  const res = await fetch(`${AGENTS_API_URL}/studia/script/generer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      project_id: projectId,
      titre,
      sujet,
      duree_cible_min: dureeCibleMin,
      style,
      b_roll: bRoll,
      voix_name: voixName || null,
    }),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const errJson = await res.json()
      detail = errJson.detail || detail
    } catch {}
    throw new Error(detail)
  }

  return res.json()
}

/**
 * Liste les scripts existants pour un projet.
 */
async function listScriptsIA(projectId) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) return { scripts: [], count: 0 }

  try {
    const res = await fetch(
      `${AGENTS_API_URL}/studia/script/list?project_id=${encodeURIComponent(projectId)}`,
      { headers: { 'X-API-Key': apiKey } }
    )
    if (!res.ok) return { scripts: [], count: 0 }
    return res.json()
  } catch {
    return { scripts: [], count: 0 }
  }
}

/**
 * Supprime un script du backend.
 */
async function deleteScriptIA(scriptId) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable')

  const res = await fetch(`${AGENTS_API_URL}/studia/script/${scriptId}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const errJson = await res.json()
      detail = errJson.detail || detail
    } catch {}
    throw new Error(detail)
  }
  return res.json()
}

// ============================================
// HELPERS GÉNÉRATION MOCKS (audio/image/vidéo)
// ============================================

function generateSilentWav(durationSec) {
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, numSamples * 2, true)
  const blob = new Blob([buffer], { type: 'audio/wav' })
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

function generateMockImageSvg(style, format, prompt, seed) {
  const fmt = FORMATS_IMG.find(f => f.val === format) || FORMATS_IMG[0]
  const sty = STYLES_IMG.find(s => s.val === style) || STYLES_IMG[0]
  const w = 600
  const h = Math.round(w / fmt.ratio)
  const rng = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  const c1 = sty.palette[Math.floor(rng(1) * sty.palette.length)]
  const c2 = sty.palette[Math.floor(rng(2) * sty.palette.length)]
  const c3 = sty.palette[Math.floor(rng(3) * sty.palette.length)]
  const angle = Math.floor(rng(4) * 360)
  const shapes = []
  for (let i = 0; i < 5; i++) {
    const cx = rng(10 + i) * w; const cy = rng(20 + i) * h
    const r = 30 + rng(30 + i) * 80; const opacity = 0.15 + rng(40 + i) * 0.25
    const fill = sty.palette[Math.floor(rng(50 + i) * sty.palette.length)]
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs><linearGradient id="g${seed}" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g${seed})"/>${shapes.join('')}
    <text x="${w/2}" y="${h/2 + 20}" font-size="80" text-anchor="middle" opacity="0.6">${sty.emoji}</text>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

async function generateMockVideo(durationSec, ratio, label, projectColor, seed = 1) {
  return new Promise((resolve, reject) => {
    const w = ratio >= 1 ? 640 : 360
    const h = ratio >= 1 ? Math.round(w / ratio) : Math.round(w / ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      resolve(URL.createObjectURL(blob))
    }
    recorder.onerror = reject
    const startTime = performance.now()
    const totalMs = durationSec * 1000
    const draw = () => {
      const elapsed = performance.now() - startTime
      const t = elapsed / totalMs
      if (elapsed >= totalMs) { recorder.stop(); return }
      const grad = ctx.createLinearGradient(0, 0, w, h)
      const phase = (elapsed / 1000) + seed
      const r1 = Math.floor(40 + 30 * Math.sin(phase * 0.5))
      const g1 = Math.floor(30 + 20 * Math.sin(phase * 0.7))
      const b1 = Math.floor(80 + 40 * Math.sin(phase * 0.3))
      grad.addColorStop(0, `rgb(${r1},${g1},${b1})`)
      grad.addColorStop(1, projectColor)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 6; i++) {
        const cx = (Math.sin(phase * 0.3 + i) * 0.5 + 0.5) * w
        const cy = (Math.cos(phase * 0.4 + i * 1.3) * 0.5 + 0.5) * h
        const r = 30 + 20 * Math.sin(phase + i)
        ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(phase + i * 2)})`
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = 'rgba(237,232,219,0.9)'
      ctx.font = `bold ${Math.floor(h/14)}px Georgia`
      ctx.textAlign = 'center'
      ctx.fillText(label, w / 2, h / 2)
      ctx.fillStyle = 'rgba(237,232,219,0.5)'
      ctx.font = `${Math.floor(h/30)}px monospace`
      ctx.fillText(`${fmtTime(elapsed/1000)} / ${fmtTime(durationSec)}`, w / 2, h / 2 + Math.floor(h/12))
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, h - 30, w - 40, 4)
      ctx.fillStyle = '#7F77DD'; ctx.fillRect(20, h - 30, (w - 40) * t, 4)
      requestAnimationFrame(draw)
    }
    recorder.start(); draw()
  })
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

function slugify(s) {
  return (s || 'fichier').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'fichier'
}

// ── MODAL ENREGISTREMENT VOIX ─────────────────────────────────────
function RecordingModal({ onClose, onValidate }) {
  const [step, setStep] = useState('idle')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [error, setError] = useState(null)
  const [levels, setLevels] = useState([0,0,0,0,0,0,0,0,0,0,0,0])
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)
  const timerRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevels = () => {
        analyser.getByteFrequencyData(dataArray)
        const newLevels = []
        const step = Math.floor(dataArray.length / 12)
        for (let i = 0; i < 12; i++) newLevels.push(dataArray[i * step] / 255)
        setLevels(newLevels)
        animFrameRef.current = requestAnimationFrame(updateLevels)
      }
      updateLevels()
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob); setAudioUrl(url); setStep('recorded')
      }
      mediaRecorderRef.current = mr
      mr.start()
      const startTime = Date.now()
      timerRef.current = setInterval(() => setDuration((Date.now() - startTime) / 1000), 100)
      setStep('recording')
    } catch (err) {
      setError("Impossible d'acceder au micro. Autorise l'acces dans les parametres de l'OS.")
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setLevels([0,0,0,0,0,0,0,0,0,0,0,0])
  }

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null); setAudioBlob(null); setDuration(0); setStep('idle')
  }

  const validate = async () => {
    if (!name.trim() || !audioBlob) return
    const reader = new FileReader()
    reader.onloadend = () => onValidate({ name: name.trim(), audioData: reader.result, duration })
    reader.readAsDataURL(audioBlob)
  }

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [])

  const tooShort = duration < 10

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget && step !== 'recording') onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🎙️ Cloner une voix</h3>
          {step !== 'recording' && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Nom de la voix *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lucien posé, Lucien colère..." disabled={step === 'recording'} style={{ ...iS, opacity: step === 'recording' ? 0.5 : 1 }} />
        </div>
        <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.7)', lineHeight: 1.6 }}>
          💡 <strong>Conseil :</strong> Lis un texte naturel pendant <strong>au moins 30 secondes</strong>.
        </div>
        {error && <div style={{ background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: '#C75B4E' }}>⚠️ {error}</div>}
        {step === 'idle' && (
          <button onClick={startRecording} disabled={!name.trim()} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: name.trim() ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 14, fontWeight: 800, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>● Démarrer l'enregistrement</button>
        )}
        {step === 'recording' && (
          <div>
            <div style={{ background: 'rgba(199,91,78,0.08)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#C75B4E', animation: 'studia-pulse 1s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#C75B4E' }}>ENREGISTREMENT EN COURS</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#EDE8DB', fontFamily: "'Georgia',serif", marginBottom: 14 }}>{fmtTime(duration)}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 50 }}>
                {levels.map((lvl, i) => <div key={i} style={{ width: 6, height: `${Math.max(8, lvl * 50)}px`, background: lvl > 0.5 ? '#C75B4E' : STUDIA_COLOR, borderRadius: 3, transition: 'height 0.05s, background 0.1s' }} />)}
              </div>
            </div>
            <button onClick={stopRecording} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#C75B4E', color: '#EDE8DB', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>⏹ Arrêter l'enregistrement</button>
          </div>
        )}
        {step === 'recorded' && (
          <div>
            <div style={{ background: 'rgba(91,199,138,0.08)', border: '1px solid rgba(91,199,138,0.3)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5BC78A' }}>✅ Enregistrement capturé</span>
                <span style={{ fontSize: 11, color: 'rgba(237,232,219,0.5)' }}>{fmtTime(duration)}</span>
              </div>
              {audioUrl && <audio src={audioUrl} controls style={{ width: '100%', height: 36 }} />}
            </div>
            {tooShort && <div style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: '#D4A853' }}>⚠️ Enregistrement court ({fmtTime(duration)}). Vise au moins 30s.</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔄 Recommencer</button>
              <button onClick={validate} disabled={!name.trim()} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: name.trim() ? '#5BC78A' : 'rgba(91,199,138,0.3)', color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>✅ Valider et cloner</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes studia-pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.5;transform:scale(1.2);} }`}</style>
    </div>
  )
}

// ── MENU EXPORT ───────────────────────────────────────────────────
function ExportMenu({ onLocal, onClose, anchorRight = true }) {
  const items = [
    { label: '📁 Vers dossier local', enabled: true,  action: onLocal,  badge: null },
    { label: '🟢 Vers Google Drive',  enabled: false, action: null,     badge: 'Phase 4' },
    { label: '🟦 Vers Dropbox',       enabled: false, action: null,     badge: 'Phase 4' },
    { label: '🟪 Vers OneDrive',      enabled: false, action: null,     badge: 'Phase 4' },
  ]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      <div style={{ position: 'absolute', top: '100%', [anchorRight ? 'right' : 'left']: 0, marginTop: 6, zIndex: 101, background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
        {items.map((it, i) => (
          <button key={i} onClick={() => { if (it.enabled && it.action) { it.action(); onClose() } }} disabled={!it.enabled}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: it.enabled ? '#EDE8DB' : 'rgba(237,232,219,0.3)', fontSize: 12, fontWeight: 500, cursor: it.enabled ? 'pointer' : 'not-allowed', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'Nunito Sans',sans-serif" }}
                  onMouseEnter={e => { if (it.enabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span>{it.label}</span>
            {it.badge && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: `${STUDIA_COLOR}20`, color: STUDIA_COLOR, fontWeight: 700 }}>{it.badge}</span>}
          </button>
        ))}
      </div>
    </>
  )
}

// ── ONGLET 1 : VOIX ──────────────────────────────────────────────
function TabVoix({ project }) {
  const storageKey = `pilotage_studia_voix_${project.id}`
  const audiosKey = `pilotage_studia_audios_${project.id}`
  const [voix, setVoix] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [audios, setAudios] = useState(() => { try { const s = localStorage.getItem(audiosKey); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [showRecModal, setShowRecModal] = useState(false)
  const [selectedVoix, setSelectedVoix] = useState('')
  const [ton, setTon] = useState('neutre')
  const [vitesse, setVitesse] = useState(1.0)
  const [texte, setTexte] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    try { setVoix(JSON.parse(localStorage.getItem(storageKey)) || []) } catch { setVoix([]) }
    try { setAudios(JSON.parse(localStorage.getItem(audiosKey)) || []) } catch { setAudios([]) }
    setSelectedVoix('')
  }, [project.id])

  const persistVoix = (v) => { localStorage.setItem(storageKey, JSON.stringify(v)); setVoix(v) }
  const persistAudios = (a) => { localStorage.setItem(audiosKey, JSON.stringify(a)); setAudios(a) }

  const handleNewVoix = ({ name, audioData, duration }) => {
    const newVoix = { id: Date.now().toString(), name, audioData, duration, status: 'cloning', createdAt: new Date().toISOString() }
    persistVoix([newVoix, ...voix])
    setShowRecModal(false)
    setTimeout(() => setVoix(prev => {
      const final = prev.map(v => v.id === newVoix.id ? { ...v, status: 'ready' } : v)
      localStorage.setItem(storageKey, JSON.stringify(final))
      return final
    }), 3000)
  }

  const supprimerVoix = (id) => {
    if (!confirm('Supprimer cette voix ?')) return
    persistVoix(voix.filter(v => v.id !== id))
    if (selectedVoix === id) setSelectedVoix('')
  }

  const genererAudio = async () => {
    if (!selectedVoix || !texte.trim() || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    const v = voix.find(x => x.id === selectedVoix)
    const dur = Math.max(3, texte.split(/\s+/).length * 0.4)
    const mockAudio = await generateSilentWav(dur)
    const newAudio = { id: Date.now().toString(), voixId: selectedVoix, voixName: v?.name || 'Voix supprimée', ton, vitesse, texte: texte.slice(0, 200), audioData: mockAudio, duration: dur, createdAt: new Date().toISOString() }
    persistAudios([newAudio, ...audios].slice(0, 20))
    setTexte('')
    setGenerating(false)
  }

  const supprimerAudio = (id) => persistAudios(audios.filter(a => a.id !== id))
  const voixPretes = voix.filter(v => v.status === 'ready')
  const charCount = texte.length
  const tooLong = charCount > 2000

  return (
    <>
      {showRecModal && <RecordingModal onClose={() => setShowRecModal(false)} onValidate={handleNewVoix} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🎤 Mes voix clonées {voix.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({voix.length})</span>}</h3>
              <button onClick={() => setShowRecModal(true)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>🎙️ Cloner ma voix</button>
            </div>
            {voix.length === 0 ? (
              <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 6 }}>Aucune voix clonée pour ce projet</p>
                <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Clique sur "Cloner ma voix" pour démarrer.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {voix.map(v => (
                  <div key={v.id} style={{ background: selectedVoix === v.id ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedVoix === v.id ? STUDIA_COLOR : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${STUDIA_COLOR}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎤</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>
                          {v.status === 'cloning' ? <span style={{ color: '#D4A853' }}>⏳ Clonage en cours...</span> : <span style={{ color: '#5BC78A' }}>✅ Prête</span>}
                          {' · '}{fmtTime(v.duration || 0)} d'échantillon
                        </div>
                      </div>
                      <button onClick={() => supprimerVoix(v.id)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(199,91,78,0.2)', background: 'transparent', color: '#C75B4E', fontSize: 11, cursor: 'pointer', flexShrink: 0 }} title="Supprimer">🗑️</button>
                    </div>
                    {v.audioData && v.status === 'ready' && <audio src={v.audioData} controls style={{ width: '100%', height: 32 }} />}
                    {v.status === 'ready' && (
                      <button onClick={() => setSelectedVoix(v.id)} style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 8, border: `1px solid ${selectedVoix === v.id ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: selectedVoix === v.id ? STUDIA_COLOR : 'transparent', color: selectedVoix === v.id ? '#0D1B2A' : 'rgba(237,232,219,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {selectedVoix === v.id ? '✓ Voix sélectionnée' : 'Sélectionner pour génération →'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>✨ Générer un audio</h3>
            {voixPretes.length === 0 ? (
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 16, fontSize: 12, color: '#D4A853', textAlign: 'center' }}>⚠️ Aucune voix prête. Clone d'abord une voix.</div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Voix</label>
                  <select value={selectedVoix} onChange={e => setSelectedVoix(e.target.value)} style={{ ...iS, cursor: 'pointer' }}>
                    <option value="">— Choisir une voix —</option>
                    {voixPretes.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Ton / Émotion</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TON_OPTIONS.map(t => <button key={t.val} onClick={() => setTon(t.val)} style={{ padding: '6px 12px', borderRadius: 18, border: `1px solid ${ton === t.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: ton === t.val ? `${STUDIA_COLOR}20` : 'transparent', color: ton === t.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: ton === t.val ? 700 : 400, cursor: 'pointer' }}>{t.label}</button>)}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Texte à synthétiser</label>
                    <span style={{ fontSize: 10, color: tooLong ? '#C75B4E' : 'rgba(237,232,219,0.4)', fontWeight: tooLong ? 700 : 400 }}>{charCount} / 2000</span>
                  </div>
                  <textarea value={texte} onChange={e => setTexte(e.target.value)} placeholder="Tape ou colle le texte à faire prononcer..." rows={6} style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Vitesse</label>
                    <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{vitesse.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.8" max="1.2" step="0.1" value={vitesse} onChange={e => setVitesse(parseFloat(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} />
                </div>
                <button onClick={genererAudio} disabled={!selectedVoix || !texte.trim() || tooLong || generating} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: (!selectedVoix || !texte.trim() || tooLong || generating) ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: (!selectedVoix || !texte.trim() || tooLong || generating) ? 'not-allowed' : 'pointer' }}>{generating ? '⏳ Génération en cours...' : "🎙️ Générer l'audio"}</button>
              </>
            )}
          </div>
          {audios.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Audios générés ({audios.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {audios.slice(0, 5).map(a => (
                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: STUDIA_COLOR }}>🎤 {a.voixName}</div>
                        <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>{TON_OPTIONS.find(t => t.val === a.ton)?.label || a.ton} · {a.vitesse}x · {fmtTime(a.duration)}</div>
                      </div>
                      <button onClick={() => supprimerAudio(a.id)} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.6)', margin: '0 0 8px', lineHeight: 1.5, fontStyle: 'italic' }}>"{a.texte}{a.texte.length >= 200 ? '...' : ''}"</p>
                    <audio src={a.audioData} controls style={{ width: '100%', height: 30 }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── ONGLET 2 : IMAGES ────────────────────────────────────────────
function TabImages({ project }) {
  const storageKey = `pilotage_studia_images_${project.id}`
  const [images, setImages] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photo')
  const [format, setFormat] = useState('1:1')
  const [batchSize, setBatchSize] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { try { setImages(JSON.parse(localStorage.getItem(storageKey)) || []) } catch { setImages([]) } }, [project.id])
  const persist = (arr) => { localStorage.setItem(storageKey, JSON.stringify(arr)); setImages(arr) }

  const generer = async () => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 3000))
    const newImages = []
    for (let i = 0; i < batchSize; i++) {
      const seed = Date.now() + i
      newImages.push({ id: seed.toString() + Math.random().toString(36).slice(2, 6), prompt: prompt.trim(), style, format, dataUrl: generateMockImageSvg(style, format, prompt, seed), createdAt: new Date().toISOString() })
    }
    persist([...newImages, ...images].slice(0, 100))
    setGenerating(false)
  }

  const supprimer = (id) => persist(images.filter(i => i.id !== id))
  const copierPrompt = (img) => { navigator.clipboard.writeText(img.prompt); setCopiedId(img.id); setTimeout(() => setCopiedId(null), 1500) }
  const telecharger = (img) => { const ext = img.dataUrl.startsWith('data:image/svg') ? 'svg' : 'png'; downloadDataUrl(img.dataUrl, `${slugify(img.prompt)}-${img.id}.${ext}`) }
  const exporterLot = () => {
    const filtered = images.filter(i => filter === 'all' || i.style === filter)
    if (filtered.length === 0) { alert('Aucune image à exporter.'); return }
    filtered.forEach((img, idx) => setTimeout(() => telecharger(img), idx * 150))
  }

  const filtered = filter === 'all' ? images : images.filter(i => i.style === filter)
  const charCount = prompt.length
  const tooLong = charCount > 500

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎨 Générer des images</h3>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Prompt</label>
            <span style={{ fontSize: 10, color: tooLong ? '#C75B4E' : 'rgba(237,232,219,0.4)', fontWeight: tooLong ? 700 : 400 }}>{charCount} / 500</span>
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: Un homme au bureau face à une fenêtre, lumière dorée du matin..." rows={3} style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Style</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STYLES_IMG.map(s => <button key={s.val} onClick={() => setStyle(s.val)} style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${style === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: style === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: style === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: style === s.val ? 700 : 400, cursor: 'pointer' }}>{s.emoji} {s.label}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Format</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FORMATS_IMG.map(f => <button key={f.val} onClick={() => setFormat(f.val)} style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${format === f.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: format === f.val ? `${STUDIA_COLOR}20` : 'transparent', color: format === f.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: format === f.val ? 700 : 400, cursor: 'pointer' }}>{f.emoji} {f.label} <span style={{ opacity: 0.6, fontSize: 10 }}>({f.dims})</span></button>)}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Nombre d'images par lot</label>
            <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{batchSize}</span>
          </div>
          <input type="range" min="1" max="8" step="1" value={batchSize} onChange={e => setBatchSize(parseInt(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} />
        </div>
        <button onClick={generer} disabled={!prompt.trim() || tooLong || generating} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: (!prompt.trim() || tooLong || generating) ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: (!prompt.trim() || tooLong || generating) ? 'not-allowed' : 'pointer' }}>{generating ? `⏳ Génération de ${batchSize} image${batchSize > 1 ? 's' : ''}...` : `🎨 Générer ${batchSize} image${batchSize > 1 ? 's' : ''}`}</button>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🖼️ Galerie {images.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({filtered.length}{filter !== 'all' ? `/${images.length}` : ''})</span>}</h3>
          {images.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#EDE8DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>☁️ Exporter le lot ▾</button>
              {showExportMenu && <ExportMenu onLocal={exporterLot} onClose={() => setShowExportMenu(false)} />}
            </div>
          )}
        </div>
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilter('all')} style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === 'all' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === 'all' ? `${STUDIA_COLOR}20` : 'transparent', color: filter === 'all' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === 'all' ? 700 : 400, cursor: 'pointer' }}>Tous ({images.length})</button>
            {STYLES_IMG.map(s => { const count = images.filter(i => i.style === s.val).length; if (count === 0) return null; return <button key={s.val} onClick={() => setFilter(s.val)} style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: filter === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === s.val ? 700 : 400, cursor: 'pointer' }}>{s.emoji} {s.label} ({count})</button> })}
          </div>
        )}
        {filtered.length === 0 ? (
          <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
            <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 4 }}>{images.length === 0 ? 'Aucune image générée' : 'Aucune image avec ce filtre'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {filtered.map(img => {
              const sty = STYLES_IMG.find(s => s.val === img.style)
              const fmt = FORMATS_IMG.find(f => f.val === img.format)
              const isHover = hoverId === img.id
              return (
                <div key={img.id} onMouseEnter={() => setHoverId(img.id)} onMouseLeave={() => setHoverId(null)} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', aspectRatio: fmt?.ratio || 1, cursor: 'pointer' }}>
                  <img src={img.dataUrl} alt={img.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{sty?.emoji} {sty?.label}</div>
                  {isHover && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, gap: 8 }}>
                      <p style={{ fontSize: 10, color: '#EDE8DB', margin: 0, lineHeight: 1.4, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.prompt}</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => telecharger(img)} title="Télécharger" style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>📥</button>
                        <button onClick={() => copierPrompt(img)} title="Copier prompt" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: copiedId === img.id ? '#5BC78A' : 'rgba(255,255,255,0.1)', color: copiedId === img.id ? '#0D1B2A' : '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{copiedId === img.id ? '✓' : '📋'}</button>
                        <button onClick={() => supprimer(img.id)} title="Supprimer" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.4)', background: 'rgba(199,91,78,0.2)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL ANNOTATION VIDÉO ────────────────────────────────────────
function AnnotationModal({ timestamp, onSave, onClose }) {
  const [comment, setComment] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>📌 Annoter à {fmtTime(timestamp)}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.5)', marginBottom: 14 }}>Décris ce que tu veux changer à ce moment précis. L'agent re-générera uniquement cette scène.</p>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex: La voix sonne trop monotone ici. Donne plus d'émotion. Et change l'image, on dirait pas le bon contexte." rows={5} style={{ ...iS, resize: 'vertical', marginBottom: 14 }} autoFocus />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (comment.trim()) onSave(comment.trim()) }} disabled={!comment.trim()} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: comment.trim() ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: comment.trim() ? 'pointer' : 'not-allowed' }}>📌 Enregistrer l'annotation</button>
        </div>
      </div>
    </div>
  )
}

// ── ONGLET 3 : STUDIO CINÉMA (BACKEND-CONNECTED) ─────────────────
function TabCinema({ project }) {
  const annotationsKey = `pilotage_studia_annotations_${project.id}`
  const sceneEditsKey = `pilotage_studia_scene_edits_${project.id}`
  const voixKey = `pilotage_studia_voix_${project.id}`

  const [scripts, setScripts] = useState([])  // Liste des scripts du projet (depuis backend)
  const [loadingList, setLoadingList] = useState(false)
  const [annotations, setAnnotations] = useState(() => { try { return JSON.parse(localStorage.getItem(annotationsKey)) || {} } catch { return {} } })
  const [sceneEdits, setSceneEdits] = useState(() => { try { return JSON.parse(localStorage.getItem(sceneEditsKey)) || {} } catch { return {} } })
  const [voixDispo, setVoixDispo] = useState([])
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Form
  const [titre, setTitre] = useState('')
  const [sujet, setSujet] = useState('')
  const [duree, setDuree] = useState(5)
  const [voixId, setVoixId] = useState('')
  const [styleVid, setStyleVid] = useState('documentaire')
  const [bRoll, setBRoll] = useState(true)

  // Génération
  const [generating, setGenerating] = useState(false)
  const [genPhase, setGenPhase] = useState(0)

  // Lecture / annotations
  const [activeScript, setActiveScript] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [showAnnotModal, setShowAnnotModal] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const videoRef = useRef(null)

  // Charger la liste des scripts depuis backend au changement de projet
  const refreshScripts = async () => {
    setLoadingList(true)
    try {
      const result = await listScriptsIA(project.id)
      setScripts(result.scripts || [])
    } catch (err) {
      console.error('Erreur chargement scripts:', err)
      setScripts([])
    }
    setLoadingList(false)
  }

  useEffect(() => {
    refreshScripts()
    try { setAnnotations(JSON.parse(localStorage.getItem(annotationsKey)) || {}) } catch { setAnnotations({}) }
    try { setSceneEdits(JSON.parse(localStorage.getItem(sceneEditsKey)) || {}) } catch { setSceneEdits({}) }
    try {
      const v = JSON.parse(localStorage.getItem(voixKey)) || []
      setVoixDispo(v.filter(x => x.status === 'ready'))
    } catch { setVoixDispo([]) }
    setActiveScript(null); setVideoUrl(null)
  }, [project.id])

  // Régénère la vidéo mockée quand on change de script actif
  useEffect(() => {
    let cancelled = false
    if (activeScript) {
      setVideoUrl(null)
      const seed = parseInt(activeScript.id.replace(/-/g, '').slice(-6), 16) || 1
      generateMockVideo(Math.min(activeScript.duree_cible_min * 60, 30), 16/9, activeScript.titre, project.color || STUDIA_COLOR, seed)
        .then(url => { if (!cancelled) setVideoUrl(url) })
        .catch(err => console.error('Erreur génération vidéo mock:', err))
    }
    return () => { cancelled = true; if (videoUrl) URL.revokeObjectURL(videoUrl) }
  }, [activeScript?.id])

  const persistAnnotations = (a) => { localStorage.setItem(annotationsKey, JSON.stringify(a)); setAnnotations(a) }
  const persistSceneEdits = (e) => { localStorage.setItem(sceneEditsKey, JSON.stringify(e)); setSceneEdits(e) }

  const showError = (msg, dur = 6000) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), dur) }
  const showSuccess = (msg, dur = 4000) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), dur) }

  const generer = async () => {
    if (!titre.trim() || !sujet.trim() || !voixId || generating) return

    const apiKey = getAgentsApiKey()
    if (!apiKey) {
      showError('Clé Agents Doppler introuvable dans le Coffre-fort. Ajoute un compte nommé "Agents Doppler API" avec ta clé.')
      return
    }

    if (sujet.trim().length < 10) {
      showError('Le sujet doit faire au moins 10 caractères.')
      return
    }

    setGenerating(true); setGenPhase(0); setErrorMsg(null); setSuccessMsg(null)

    try {
      // Phase 1 (réelle) — Génération du script via Claude API
      setGenPhase(0)
      const v = voixDispo.find(x => x.id === voixId)
      const result = await genererScriptIA({
        projectId: project.id,
        titre: titre.trim(),
        sujet: sujet.trim(),
        dureeCibleMin: duree,
        style: styleVid,
        bRoll,
        voixName: v?.name || null,
      })

      // Phases 2-5 (mockées en attendant agents voix/image/montage)
      for (let i = 1; i < PHASES_VIDEO.length; i++) {
        setGenPhase(i)
        await new Promise(r => setTimeout(r, PHASES_VIDEO[i].mockMs))
      }

      // Recharger la liste depuis backend pour voir le nouveau script
      await refreshScripts()

      // Activer automatiquement le script fraîchement généré
      setActiveScript(result)
      setTitre(''); setSujet('')
      showSuccess(`✨ Script généré (${result.scenes?.length || 0} scènes)`)
    } catch (err) {
      showError(`❌ Erreur génération : ${err.message}`)
      console.error('Generate error:', err)
    }

    setGenerating(false); setGenPhase(0)
  }

  const supprimerScript = async (scriptId) => {
    if (!confirm('Supprimer ce script et ses annotations ?')) return
    try {
      await deleteScriptIA(scriptId)
      setScripts(prev => prev.filter(s => s.id !== scriptId))
      const newAnnots = { ...annotations }
      delete newAnnots[scriptId]
      persistAnnotations(newAnnots)
      const newEdits = { ...sceneEdits }
      delete newEdits[scriptId]
      persistSceneEdits(newEdits)
      if (activeScript?.id === scriptId) { setActiveScript(null); setVideoUrl(null) }
      showSuccess('🗑️ Script supprimé')
    } catch (err) {
      showError(`❌ Erreur suppression : ${err.message}`)
    }
  }

  const ouvrirAnnotation = () => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setPausedAt(videoRef.current.currentTime)
    setShowAnnotModal(true)
  }

  const sauvegarderAnnotation = (comment) => {
    if (!activeScript) return
    const newAnnot = { id: Date.now().toString(), timestamp: pausedAt, comment, status: 'pending', createdAt: new Date().toISOString() }
    const updated = { ...annotations, [activeScript.id]: [...(annotations[activeScript.id] || []), newAnnot].sort((a, b) => a.timestamp - b.timestamp) }
    persistAnnotations(updated)
    setShowAnnotModal(false)
  }

  const supprimerAnnotation = (annotId) => {
    if (!activeScript) return
    const updated = { ...annotations, [activeScript.id]: (annotations[activeScript.id] || []).filter(a => a.id !== annotId) }
    persistAnnotations(updated)
  }

  const renvoyerEnCorrection = (annotId) => {
    if (!activeScript) return
    const updated = { ...annotations, [activeScript.id]: (annotations[activeScript.id] || []).map(a => a.id === annotId ? { ...a, status: 'pending_fix' } : a) }
    persistAnnotations(updated)
    setTimeout(() => {
      setAnnotations(prev => {
        const final = { ...prev, [activeScript.id]: (prev[activeScript.id] || []).map(a => a.id === annotId ? { ...a, status: 'fixed' } : a) }
        localStorage.setItem(annotationsKey, JSON.stringify(final))
        return final
      })
    }, 2500)
  }

  const seekTo = (sec) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec
      videoRef.current.play().catch(() => {})
    }
  }

  // Récupère les scènes du script actif, en fusionnant avec les éditions locales
  const getScenesFromScript = (script) => {
    if (!script || !script.scenes_json?.scenes) return script?.scenes || []
    const baseScenes = script.scenes_json.scenes
    const edits = sceneEdits[script.id] || {}
    return baseScenes.map(s => ({ ...s, ...(edits[s.id] || {}) }))
  }

  const updateSceneVoixOff = (scriptId, sceneId, newText) => {
    const newEdits = {
      ...sceneEdits,
      [scriptId]: { ...(sceneEdits[scriptId] || {}), [sceneId]: { ...(sceneEdits[scriptId]?.[sceneId] || {}), voix_off: newText } }
    }
    persistSceneEdits(newEdits)
  }

  const currentAnnots = activeScript ? (annotations[activeScript.id] || []) : []
  const currentScenes = activeScript ? getScenesFromScript(activeScript) : []
  const peutGenerer = titre.trim() && sujet.trim() && voixId && !generating

  return (
    <>
      {showAnnotModal && <AnnotationModal timestamp={pausedAt} onSave={sauvegarderAnnotation} onClose={() => setShowAnnotModal(false)} />}

      {/* Messages */}
      {errorMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', fontSize: 12, color: '#C75B4E', marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', fontSize: 12, color: '#5BC78A', marginBottom: 14 }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Form Brief */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📝 Brief vidéo</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Titre de la vidéo *</label>
                <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Pourquoi Pierucci a été emprisonné..." style={iS} disabled={generating} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Voix narrative *</label>
                <select value={voixId} onChange={e => setVoixId(e.target.value)} style={{ ...iS, cursor: voixDispo.length > 0 ? 'pointer' : 'not-allowed' }} disabled={generating || voixDispo.length === 0}>
                  <option value="">{voixDispo.length === 0 ? '— Aucune voix dispo —' : '— Choisir une voix —'}</option>
                  {voixDispo.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Sujet / Pitch * <span style={{ color: 'rgba(237,232,219,0.3)' }}>(min 10 caractères)</span></label>
              <textarea value={sujet} onChange={e => setSujet(e.target.value)} placeholder="Décris en 2-3 phrases le sujet de ta vidéo. L'agent script en fera une narration structurée." rows={3} style={{ ...iS, resize: 'vertical' }} disabled={generating} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Style visuel</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STYLES_VIDEO.map(s => <button key={s.val} onClick={() => setStyleVid(s.val)} disabled={generating} style={{ padding: '6px 12px', borderRadius: 18, border: `1px solid ${styleVid === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: styleVid === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: styleVid === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: styleVid === s.val ? 700 : 400, cursor: generating ? 'not-allowed' : 'pointer' }}>{s.emoji} {s.label}</button>)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Durée cible</label>
                  <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{duree} min</span>
                </div>
                <input type="range" min="3" max="12" step="1" value={duree} onChange={e => setDuree(parseInt(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: generating ? 'not-allowed' : 'pointer', padding: '10px 14px', background: bRoll ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${bRoll ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, borderRadius: 10 }}>
                <input type="checkbox" checked={bRoll} onChange={e => setBRoll(e.target.checked)} disabled={generating} style={{ accentColor: STUDIA_COLOR }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: bRoll ? STUDIA_COLOR : 'rgba(237,232,219,0.5)' }}>🎞️ B-roll auto</span>
              </label>
            </div>

            {voixDispo.length === 0 && (
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: '#D4A853' }}>
                ⚠️ Aucune voix prête. Va dans l'onglet "Clone IA voix" pour cloner ta voix d'abord.
              </div>
            )}

            <button onClick={generer} disabled={!peutGenerer} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: peutGenerer ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 14, fontWeight: 800, cursor: peutGenerer ? 'pointer' : 'not-allowed' }}>
              {generating ? `${PHASES_VIDEO[genPhase]?.emoji} ${PHASES_VIDEO[genPhase]?.label}...` : '🎬 Générer la vidéo'}
            </button>

            {generating && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  {PHASES_VIDEO.map((p, i) => (
                    <div key={p.id} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: i <= genPhase ? STUDIA_COLOR : 'rgba(237,232,219,0.3)', fontWeight: i === genPhase ? 700 : 400 }}>
                      {i < genPhase ? '✓' : i === genPhase ? (p.real ? '⏳' : '⚙️') : '·'} {p.label.split(' ')[0]}
                    </div>
                  ))}
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${((genPhase + 1) / PHASES_VIDEO.length) * 100}%`, background: STUDIA_COLOR, transition: 'width 0.3s' }} />
                </div>
                {genPhase === 0 && (
                  <p style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
                    Claude rédige ton script structuré (15-30 secondes)...
                  </p>
                )}
                {genPhase > 0 && (
                  <p style={{ fontSize: 10, color: 'rgba(212,168,83,0.7)', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
                    💡 Phases 2-5 simulées en attendant les agents voix/image/montage (Phases 3-7 backend)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Lecteur vidéo */}
          <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            {!activeScript ? (
              <div style={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', gap: 8 }}>
                <div style={{ fontSize: 36, opacity: 0.4 }}>🎬</div>
                <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', margin: 0 }}>Sélectionne un script dans la liste à droite ou génère-en un nouveau</p>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000' }}>
                  {videoUrl ? (
                    <video ref={videoRef} src={videoUrl} controls style={{ width: '100%', height: '100%', display: 'block' }}>
                      Ton navigateur ne supporte pas la balise vidéo.
                    </video>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 24, animation: 'studia-pulse 1.5s infinite' }}>⏳</div>
                      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.5)', margin: 0 }}>Préparation de la vidéo...</p>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeScript.titre}</div>
                    <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>
                      {STYLES_VIDEO.find(s => s.val === activeScript.style)?.label} · 🎤 {activeScript.voix_name || '?'} · {activeScript.duree_cible_min} min cible · {currentScenes.length} scènes
                    </div>
                  </div>
                  <button onClick={ouvrirAnnotation} disabled={!videoUrl} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: videoUrl ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 11, fontWeight: 800, cursor: videoUrl ? 'pointer' : 'not-allowed', flexShrink: 0 }}>📌 Annoter ici</button>
                </div>
              </>
            )}
          </div>

          {/* Script structuré (scènes) */}
          {activeScript && currentScenes.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>📜 Script structuré</h3>
                <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)' }}>
                  {currentScenes.length} scènes · {fmtTime(currentScenes.reduce((acc, s) => acc + (s.duree_sec || 0), 0))} total
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentScenes.map(scene => {
                  const typeColor = scene.type === 'intro' ? '#5BC78A' : scene.type === 'conclusion' ? '#D4A853' : STUDIA_COLOR
                  const typeLabel = scene.type === 'intro' ? '🎬 Intro' : scene.type === 'conclusion' ? '🏁 Conclusion' : `📍 Scène ${scene.id}`
                  return (
                    <div key={scene.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: typeColor, padding: '3px 8px', borderRadius: 6, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}>
                          {typeLabel}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', fontFamily: 'monospace' }}>{fmtTime(scene.duree_sec)}</span>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 4 }}>Voix-off (éditable)</label>
                        <textarea
                          value={scene.voix_off}
                          onChange={e => updateSceneVoixOff(activeScript.id, scene.id, e.target.value)}
                          rows={3}
                          style={{ ...iS, fontSize: 12, resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 10px', fontSize: 10, color: 'rgba(237,232,219,0.5)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        🎨 <strong>Visuel :</strong> {scene.visuel_prompt}
                      </div>
                    </div>
                  )
                })}
              </div>

              {activeScript.scenes_json?.metadata && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(127,119,221,0.05)', border: '1px solid rgba(127,119,221,0.15)', borderRadius: 8, fontSize: 11, color: 'rgba(237,232,219,0.6)' }}>
                  <div style={{ marginBottom: 4 }}><strong style={{ color: STUDIA_COLOR }}>Ton :</strong> {activeScript.scenes_json.metadata.ton}</div>
                  {activeScript.scenes_json.metadata.mots_cles?.length > 0 && (
                    <div><strong style={{ color: STUDIA_COLOR }}>Mots-clés :</strong> {activeScript.scenes_json.metadata.mots_cles.join(', ')}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLONNE DROITE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Liste scripts (depuis backend) */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Scripts générés {scripts.length > 0 && `(${scripts.length})`}</h3>
              <button onClick={refreshScripts} disabled={loadingList} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 10, cursor: loadingList ? 'not-allowed' : 'pointer' }}>
                {loadingList ? '⏳' : '🔄'}
              </button>
            </div>
            {loadingList && scripts.length === 0 ? (
              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: 14 }}>⏳ Chargement...</p>
            ) : scripts.length === 0 ? (
              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 14 }}>Aucun script encore</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {scripts.map(s => {
                  const isActive = activeScript?.id === s.id
                  const annotCount = (annotations[s.id] || []).length
                  const sceneCount = s.scenes_json?.scenes?.length || 0
                  return (
                    <div key={s.id} onClick={() => setActiveScript(s)} style={{ background: isActive ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? STUDIA_COLOR : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? STUDIA_COLOR : '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titre}</div>
                        <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>{STYLES_VIDEO.find(x => x.val === s.style)?.emoji} {s.duree_cible_min} min · 📜 {sceneCount} scènes</div>
                        {annotCount > 0 && <div style={{ fontSize: 9, color: '#D4A853', marginTop: 3 }}>📌 {annotCount} annotation{annotCount > 1 ? 's' : ''}</div>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); supprimerScript(s.id) }} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Annotations */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📌 Annotations {currentAnnots.length > 0 && `(${currentAnnots.length})`}</h3>
            {!activeScript ? (
              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 14 }}>Sélectionne un script</p>
            ) : currentAnnots.length === 0 ? (
              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 14, lineHeight: 1.5 }}>Pause la vidéo et clique sur "📌 Annoter ici" pour ajouter une remarque.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {currentAnnots.map(a => {
                  const statusColor = a.status === 'fixed' ? '#5BC78A' : a.status === 'pending_fix' ? '#D4A853' : 'rgba(237,232,219,0.5)'
                  const statusLabel = a.status === 'fixed' ? '✅ Corrigé' : a.status === 'pending_fix' ? '⏳ Correction en cours...' : '🕒 En attente'
                  return (
                    <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <button onClick={() => seekTo(a.timestamp)} title="Aller à ce moment" style={{ background: `${STUDIA_COLOR}20`, border: 'none', borderRadius: 6, padding: '2px 8px', color: STUDIA_COLOR, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' }}>▶ {fmtTime(a.timestamp)}</button>
                        <button onClick={() => supprimerAnnotation(a.id)} style={{ padding: '2px 6px', borderRadius: 5, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.7)', margin: '0 0 8px', lineHeight: 1.4 }}>{a.comment}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
                        {a.status === 'pending' && <button onClick={() => renvoyerEnCorrection(a.id)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${STUDIA_COLOR}40`, background: 'transparent', color: STUDIA_COLOR, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>🔄 Renvoyer en correction</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── ONGLET 4 : SHORTS ─────────────────────────────────────────────
function TabShorts({ project }) {
  const shortsKey = `pilotage_studia_shorts_${project.id}`
  const voixKey = `pilotage_studia_voix_${project.id}`
  const [shorts, setShorts] = useState(() => { try { return JSON.parse(localStorage.getItem(shortsKey)) || [] } catch { return [] } })
  const [voixDispo, setVoixDispo] = useState([])

  const [sujet, setSujet] = useState('')
  const [dureeShort, setDureeShort] = useState(60)
  const [voixId, setVoixId] = useState('')
  const [styleS, setStyleS] = useState('demo')
  const [sousTitres, setSousTitres] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [shortVideoUrls, setShortVideoUrls] = useState({})

  useEffect(() => {
    try { setShorts(JSON.parse(localStorage.getItem(shortsKey)) || []) } catch { setShorts([]) }
    try {
      const v = JSON.parse(localStorage.getItem(voixKey)) || []
      setVoixDispo(v.filter(x => x.status === 'ready'))
    } catch { setVoixDispo([]) }
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    const generateAll = async () => {
      for (const s of shorts.slice(0, 6)) {
        if (cancelled) return
        const seed = parseInt(s.id.slice(-6), 36) || 1
        try {
          const url = await generateMockVideo(Math.min(s.duree, 8), 9/16, s.sujet.slice(0, 30), project.color || STUDIA_COLOR, seed)
          if (!cancelled) {
            setShortVideoUrls(prev => ({ ...prev, [s.id]: url }))
          }
        } catch (err) { console.error(err) }
      }
    }
    generateAll()
    return () => {
      cancelled = true
      Object.values(shortVideoUrls).forEach(url => { if (url) URL.revokeObjectURL(url) })
    }
  }, [shorts.length, project.id])

  const persist = (arr) => { localStorage.setItem(shortsKey, JSON.stringify(arr)); setShorts(arr) }

  const generer = async () => {
    if (!sujet.trim() || !voixId || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 2500))
    const v = voixDispo.find(x => x.id === voixId)
    const newShort = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      sujet: sujet.trim(), duree: dureeShort, voixId, voixName: v?.name || '?', styleS, sousTitres, createdAt: new Date().toISOString(),
    }
    persist([newShort, ...shorts].slice(0, 12))
    setSujet('')
    setGenerating(false)
  }

  const supprimer = (id) => {
    persist(shorts.filter(s => s.id !== id))
    if (shortVideoUrls[id]) URL.revokeObjectURL(shortVideoUrls[id])
    setShortVideoUrls(prev => { const c = { ...prev }; delete c[id]; return c })
  }

  const peutGenerer = sujet.trim() && voixId && !generating
  const charCount = sujet.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>⚡ Nouveau short (vertical 9:16)</h3>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Sujet du short *</label>
            <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)' }}>{charCount} / 300</span>
          </div>
          <textarea value={sujet} onChange={e => setSujet(e.target.value.slice(0, 300))} placeholder="Ex: Comment l'extraterritorialité du droit US fonctionne en 60 secondes" rows={3} style={{ ...iS, resize: 'vertical' }} disabled={generating} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Voix narrative *</label>
            <select value={voixId} onChange={e => setVoixId(e.target.value)} style={{ ...iS, cursor: voixDispo.length > 0 ? 'pointer' : 'not-allowed' }} disabled={generating || voixDispo.length === 0}>
              <option value="">{voixDispo.length === 0 ? '— Aucune voix dispo —' : '— Choisir une voix —'}</option>
              {voixDispo.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Durée</label>
              <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{dureeShort}s</span>
            </div>
            <input type="range" min="30" max="120" step="10" value={dureeShort} onChange={e => setDureeShort(parseInt(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Style visuel</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STYLES_SHORT.map(s => <button key={s.val} onClick={() => setStyleS(s.val)} disabled={generating} style={{ padding: '6px 12px', borderRadius: 18, border: `1px solid ${styleS === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: styleS === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: styleS === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: styleS === s.val ? 700 : 400, cursor: generating ? 'not-allowed' : 'pointer' }}>{s.emoji} {s.label}</button>)}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: generating ? 'not-allowed' : 'pointer', padding: '10px 14px', background: sousTitres ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${sousTitres ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, marginBottom: 16 }}>
          <input type="checkbox" checked={sousTitres} onChange={e => setSousTitres(e.target.checked)} disabled={generating} style={{ accentColor: STUDIA_COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: sousTitres ? STUDIA_COLOR : 'rgba(237,232,219,0.5)' }}>📝 Sous-titres automatiques (recommandé)</span>
        </label>
        {voixDispo.length === 0 && (
          <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: '#D4A853' }}>
            ⚠️ Aucune voix prête. Va cloner une voix dans l'onglet "Clone IA voix".
          </div>
        )}
        <button onClick={generer} disabled={!peutGenerer} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: peutGenerer ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: peutGenerer ? 'pointer' : 'not-allowed' }}>
          {generating ? '⏳ Génération du short...' : '⚡ Générer le short'}
        </button>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📱 Mes shorts {shorts.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({shorts.length})</span>}</h3>
        {shorts.length === 0 ? (
          <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
            <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)' }}>Aucun short généré pour ce projet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {shorts.map(s => {
              const sty = STYLES_SHORT.find(x => x.val === s.styleS)
              const url = shortVideoUrls[s.id]
              return (
                <div key={s.id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000' }}>
                    {url ? (
                      <video src={url} controls style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 20, animation: 'studia-pulse 1.5s infinite' }}>⏳</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, backdropFilter: 'blur(4px)' }}>{sty?.emoji} {sty?.label}</div>
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5 }}>{s.duree}s</div>
                    {s.sousTitres && <div style={{ position: 'absolute', bottom: 6, left: 6, background: `${STUDIA_COLOR}d0`, color: '#0D1B2A', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5 }}>📝 ST</div>}
                  </div>
                  <div style={{ padding: 10 }}>
                    <p style={{ fontSize: 11, color: '#EDE8DB', margin: '0 0 6px', lineHeight: 1.4, maxHeight: 30, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sujet}</p>
                    <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginBottom: 8 }}>🎤 {s.voixName}</div>
                    <button onClick={() => supprimer(s.id)} style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.3)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🗑️ Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────
export default function PageStudIA({ project }) {
  const [activeTab, setActiveTab] = useState('voix')
  const tab = TABS.find(t => t.id === activeTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {TABS.map(t => {
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '10px 18px', borderRadius: 0, border: 'none', background: 'transparent', color: isActive ? STUDIA_COLOR : 'rgba(237,232,219,0.45)', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer', position: 'relative', transition: 'color 0.15s', borderBottom: isActive ? `2px solid ${STUDIA_COLOR}` : '2px solid transparent', marginBottom: -1 }}>
              <span style={{ marginRight: 6 }}>{t.emoji}</span>{t.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: `${STUDIA_COLOR}15`, color: STUDIA_COLOR, border: `1px solid ${STUDIA_COLOR}30`, fontWeight: 700 }}>Stud'IA</span>
        <span style={{ fontSize: 12, color: 'rgba(237,232,219,0.5)' }}>{tab?.subtitle}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'voix'   && <TabVoix project={project} />}
        {activeTab === 'images' && <TabImages project={project} />}
        {activeTab === 'cinema' && <TabCinema project={project} />}
        {activeTab === 'shorts' && <TabShorts project={project} />}
      </div>
    </div>
  )
}

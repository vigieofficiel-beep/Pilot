import { useState, useEffect, useRef } from 'react'

const STUDIA_COLOR = '#7F77DD'

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

const iS = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDE8DB', fontSize: 13, outline: 'none',
  fontFamily: "'Nunito Sans',sans-serif", boxSizing: 'border-box', lineHeight: 1.6,
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Génère un WAV silencieux de N secondes (mock pour l'audio généré)
function generateSilentWav(durationSec) {
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)
  const blob = new Blob([buffer], { type: 'audio/wav' })
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

// Génère un SVG mocké pour image (gradient stylisé + emoji)
function generateMockImageSvg(style, format, prompt, seed) {
  const fmt = FORMATS_IMG.find(f => f.val === format) || FORMATS_IMG[0]
  const sty = STYLES_IMG.find(s => s.val === style) || STYLES_IMG[0]
  const w = 600
  const h = Math.round(w / fmt.ratio)

  // Pseudo-random basé sur seed pour cohérence visuelle
  const rng = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  const c1 = sty.palette[Math.floor(rng(1) * sty.palette.length)]
  const c2 = sty.palette[Math.floor(rng(2) * sty.palette.length)]
  const c3 = sty.palette[Math.floor(rng(3) * sty.palette.length)]
  const angle = Math.floor(rng(4) * 360)

  // Quelques formes géométriques aléatoires
  const shapes = []
  for (let i = 0; i < 5; i++) {
    const cx = rng(10 + i) * w
    const cy = rng(20 + i) * h
    const r = 30 + rng(30 + i) * 80
    const opacity = 0.15 + rng(40 + i) * 0.25
    const fill = sty.palette[Math.floor(rng(50 + i) * sty.palette.length)]
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`)
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g${seed}" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="50%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g${seed})"/>
    ${shapes.join('')}
    <text x="${w/2}" y="${h/2 + 20}" font-size="80" text-anchor="middle" opacity="0.6">${sty.emoji}</text>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

// Téléchargement local d'un fichier (data URL → fichier)
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Sanitize pour nom de fichier
function slugify(s) {
  return (s || 'image').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image'
}

// ── MODAL ENREGISTREMENT ──────────────────────────────────────────
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
  const analyserRef = useRef(null)
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
      analyserRef.current = analyser

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
        setAudioBlob(blob)
        setAudioUrl(url)
        setStep('recorded')
      }
      mediaRecorderRef.current = mr
      mr.start()

      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTime) / 1000)
      }, 100)

      setStep('recording')
    } catch (err) {
      setError("Impossible d'acceder au micro. Autorise l'acces dans les parametres de l'OS.")
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close()
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

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop()
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [])

  const tooShort = duration < 10

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget && step !== 'recording') onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🎙️ Cloner une voix</h3>
          {step !== 'recording' && (
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Nom de la voix *</label>
          <input value={name} onChange={e => setName(e.target.value)}
                 placeholder="Ex: Lucien posé, Lucien colère, Voix narrateur..."
                 disabled={step === 'recording'}
                 style={{ ...iS, opacity: step === 'recording' ? 0.5 : 1 }} />
        </div>

        <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.7)', lineHeight: 1.6 }}>
          💡 <strong>Conseil :</strong> Lis un texte naturel pendant <strong>au moins 30 secondes</strong>. Plus l'enregistrement est varié (intonations, émotions), meilleur sera le clonage.
        </div>

        {error && (
          <div style={{ background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: '#C75B4E' }}>
            ⚠️ {error}
          </div>
        )}

        {step === 'idle' && (
          <button onClick={startRecording} disabled={!name.trim()}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: name.trim() ? STUDIA_COLOR : `${STUDIA_COLOR}40`, color: '#0D1B2A', fontSize: 14, fontWeight: 800, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
            ● Démarrer l'enregistrement
          </button>
        )}

        {step === 'recording' && (
          <div>
            <div style={{ background: 'rgba(199,91,78,0.08)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#C75B4E', animation: 'studia-pulse 1s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#C75B4E' }}>ENREGISTREMENT EN COURS</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#EDE8DB', fontFamily: "'Georgia',serif", marginBottom: 14 }}>
                {fmtTime(duration)}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 50 }}>
                {levels.map((lvl, i) => (
                  <div key={i} style={{ width: 6, height: `${Math.max(8, lvl * 50)}px`, background: lvl > 0.5 ? '#C75B4E' : STUDIA_COLOR, borderRadius: 3, transition: 'height 0.05s, background 0.1s' }} />
                ))}
              </div>
            </div>
            <button onClick={stopRecording}
                    style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#C75B4E', color: '#EDE8DB', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              ⏹ Arrêter l'enregistrement
            </button>
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
            {tooShort && (
              <div style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: '#D4A853' }}>
                ⚠️ Enregistrement court ({fmtTime(duration)}). Pour un clonage de qualité, vise au moins 30s.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔄 Recommencer
              </button>
              <button onClick={validate} disabled={!name.trim()}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: name.trim() ? '#5BC78A' : 'rgba(91,199,138,0.3)', color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
                ✅ Valider et cloner
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes studia-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

// ── ONGLET 1 : CLONE IA VOIX ──────────────────────────────────────
function TabVoix({ project }) {
  const storageKey = `pilotage_studia_voix_${project.id}`
  const audiosKey = `pilotage_studia_audios_${project.id}`

  const [voix, setVoix] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })
  const [audios, setAudios] = useState(() => {
    try { const s = localStorage.getItem(audiosKey); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const [showRecModal, setShowRecModal] = useState(false)
  const [selectedVoix, setSelectedVoix] = useState('')
  const [ton, setTon] = useState('neutre')
  const [vitesse, setVitesse] = useState(1.0)
  const [texte, setTexte] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); setVoix(s ? JSON.parse(s) : []) }
    catch { setVoix([]) }
    try { const s = localStorage.getItem(audiosKey); setAudios(s ? JSON.parse(s) : []) }
    catch { setAudios([]) }
    setSelectedVoix('')
  }, [project.id])

  const persistVoix = (v) => { localStorage.setItem(storageKey, JSON.stringify(v)); setVoix(v) }
  const persistAudios = (a) => { localStorage.setItem(audiosKey, JSON.stringify(a)); setAudios(a) }

  const handleNewVoix = ({ name, audioData, duration }) => {
    const newVoix = { id: Date.now().toString(), name, audioData, duration, status: 'cloning', createdAt: new Date().toISOString() }
    const updated = [newVoix, ...voix]
    persistVoix(updated)
    setShowRecModal(false)
    setTimeout(() => {
      setVoix(prev => {
        const final = prev.map(v => v.id === newVoix.id ? { ...v, status: 'ready' } : v)
        localStorage.setItem(storageKey, JSON.stringify(final))
        return final
      })
    }, 3000)
  }

  const supprimerVoix = (id) => {
    if (!confirm('Supprimer cette voix ?')) return
    const updated = voix.filter(v => v.id !== id)
    persistVoix(updated)
    if (selectedVoix === id) setSelectedVoix('')
  }

  const genererAudio = async () => {
    if (!selectedVoix || !texte.trim() || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    const v = voix.find(x => x.id === selectedVoix)
    const dur = Math.max(3, texte.split(/\s+/).length * 0.4)
    const mockAudio = await generateSilentWav(dur)
    const newAudio = {
      id: Date.now().toString(), voixId: selectedVoix, voixName: v?.name || 'Voix supprimée',
      ton, vitesse, texte: texte.slice(0, 200), audioData: mockAudio, duration: dur, createdAt: new Date().toISOString(),
    }
    const updated = [newAudio, ...audios].slice(0, 20)
    persistAudios(updated)
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
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>
                🎤 Mes voix clonées {voix.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({voix.length})</span>}
              </h3>
              <button onClick={() => setShowRecModal(true)}
                      style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                🎙️ Cloner ma voix
              </button>
            </div>

            {voix.length === 0 ? (
              <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 6 }}>Aucune voix clonée pour ce projet</p>
                <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Clique sur "Cloner ma voix" pour démarrer un enregistrement.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {voix.map(v => (
                  <div key={v.id} style={{
                    background: selectedVoix === v.id ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedVoix === v.id ? STUDIA_COLOR : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 12, padding: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${STUDIA_COLOR}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎤</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>
                          {v.status === 'cloning' ? <span style={{ color: '#D4A853' }}>⏳ Clonage en cours...</span> : <span style={{ color: '#5BC78A' }}>✅ Prête</span>}
                          {' · '}{fmtTime(v.duration || 0)} d'échantillon
                        </div>
                      </div>
                      <button onClick={() => supprimerVoix(v.id)}
                              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(199,91,78,0.2)', background: 'transparent', color: '#C75B4E', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
                              title="Supprimer">🗑️</button>
                    </div>
                    {v.audioData && v.status === 'ready' && <audio src={v.audioData} controls style={{ width: '100%', height: 32 }} />}
                    {v.status === 'ready' && (
                      <button onClick={() => setSelectedVoix(v.id)}
                              style={{
                                marginTop: 8, width: '100%', padding: '7px', borderRadius: 8,
                                border: `1px solid ${selectedVoix === v.id ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`,
                                background: selectedVoix === v.id ? STUDIA_COLOR : 'transparent',
                                color: selectedVoix === v.id ? '#0D1B2A' : 'rgba(237,232,219,0.6)',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}>
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
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 16, fontSize: 12, color: '#D4A853', textAlign: 'center' }}>
                ⚠️ Aucune voix prête. Clone d'abord une voix dans la colonne de gauche.
              </div>
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
                    {TON_OPTIONS.map(t => (
                      <button key={t.val} onClick={() => setTon(t.val)}
                              style={{ padding: '6px 12px', borderRadius: 18, border: `1px solid ${ton === t.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: ton === t.val ? `${STUDIA_COLOR}20` : 'transparent', color: ton === t.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: ton === t.val ? 700 : 400, cursor: 'pointer' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Texte à synthétiser</label>
                    <span style={{ fontSize: 10, color: tooLong ? '#C75B4E' : 'rgba(237,232,219,0.4)', fontWeight: tooLong ? 700 : 400 }}>{charCount} / 2000</span>
                  </div>
                  <textarea value={texte} onChange={e => setTexte(e.target.value)}
                            placeholder="Tape ou colle le texte que tu veux faire prononcer par la voix sélectionnée..."
                            rows={6}
                            style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Vitesse</label>
                    <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{vitesse.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.8" max="1.2" step="0.1" value={vitesse}
                         onChange={e => setVitesse(parseFloat(e.target.value))}
                         style={{ width: '100%', accentColor: STUDIA_COLOR }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(237,232,219,0.3)', marginTop: 2 }}>
                    <span>Lent</span><span>Normal</span><span>Rapide</span>
                  </div>
                </div>

                <button onClick={genererAudio} disabled={!selectedVoix || !texte.trim() || tooLong || generating}
                        style={{
                          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                          background: (!selectedVoix || !texte.trim() || tooLong || generating) ? `${STUDIA_COLOR}40` : STUDIA_COLOR,
                          color: '#0D1B2A', fontSize: 13, fontWeight: 800,
                          cursor: (!selectedVoix || !texte.trim() || tooLong || generating) ? 'not-allowed' : 'pointer',
                        }}>
                  {generating ? '⏳ Génération en cours...' : "🎙️ Générer l'audio"}
                </button>
              </>
            )}
          </div>

          {audios.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Audios générés ({audios.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {audios.slice(0, 5).map(a => (
                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: STUDIA_COLOR }}>🎤 {a.voixName}</div>
                        <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>
                          {TON_OPTIONS.find(t => t.val === a.ton)?.label || a.ton} · {a.vitesse}x · {fmtTime(a.duration)}
                        </div>
                      </div>
                      <button onClick={() => supprimerAudio(a.id)}
                              style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
                              title="Supprimer">✕</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.6)', margin: '0 0 8px', lineHeight: 1.5, fontStyle: 'italic' }}>
                      "{a.texte}{a.texte.length >= 200 ? '...' : ''}"
                    </p>
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

// ── MENU EXPORT (popover) ─────────────────────────────────────────
function ExportMenu({ onLocal, onClose }) {
  const items = [
    { label: '📁 Vers dossier local', enabled: true,  action: onLocal,  badge: null },
    { label: '🟢 Vers Google Drive',  enabled: false, action: null,     badge: 'Phase 4' },
    { label: '🟦 Vers Dropbox',       enabled: false, action: null,     badge: 'Phase 4' },
    { label: '🟪 Vers OneDrive',      enabled: false, action: null,     badge: 'Phase 4' },
  ]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 101,
        background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
        padding: 6, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}>
        {items.map((it, i) => (
          <button key={i}
                  onClick={() => { if (it.enabled && it.action) { it.action(); onClose() } }}
                  disabled={!it.enabled}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none',
                    background: 'transparent',
                    color: it.enabled ? '#EDE8DB' : 'rgba(237,232,219,0.3)',
                    fontSize: 12, fontWeight: 500, cursor: it.enabled ? 'pointer' : 'not-allowed',
                    textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "'Nunito Sans',sans-serif",
                  }}
                  onMouseEnter={e => { if (it.enabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span>{it.label}</span>
            {it.badge && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: `${STUDIA_COLOR}20`, color: STUDIA_COLOR, fontWeight: 700 }}>
                {it.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

// ── ONGLET 2 : PHOTOS & IMAGES IA ─────────────────────────────────
function TabImages({ project }) {
  const storageKey = `pilotage_studia_images_${project.id}`

  const [images, setImages] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photo')
  const [format, setFormat] = useState('1:1')
  const [batchSize, setBatchSize] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [hoverId, setHoverId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); setImages(s ? JSON.parse(s) : []) }
    catch { setImages([]) }
  }, [project.id])

  const persist = (arr) => { localStorage.setItem(storageKey, JSON.stringify(arr)); setImages(arr) }

  const generer = async () => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 3000))
    const newImages = []
    for (let i = 0; i < batchSize; i++) {
      const seed = Date.now() + i
      newImages.push({
        id: seed.toString() + Math.random().toString(36).slice(2, 6),
        prompt: prompt.trim(),
        style, format,
        dataUrl: generateMockImageSvg(style, format, prompt, seed),
        createdAt: new Date().toISOString(),
      })
    }
    persist([...newImages, ...images].slice(0, 100))
    setGenerating(false)
  }

  const supprimer = (id) => persist(images.filter(i => i.id !== id))

  const copierPrompt = (img) => {
    navigator.clipboard.writeText(img.prompt)
    setCopiedId(img.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const telecharger = (img) => {
    const ext = img.dataUrl.startsWith('data:image/svg') ? 'svg' : 'png'
    downloadDataUrl(img.dataUrl, `${slugify(img.prompt)}-${img.id}.${ext}`)
  }

  const exporterLot = () => {
    const filtered = images.filter(i => filter === 'all' || i.style === filter)
    if (filtered.length === 0) { alert('Aucune image à exporter.'); return }
    filtered.forEach((img, idx) => {
      setTimeout(() => telecharger(img), idx * 150)
    })
  }

  const filtered = filter === 'all' ? images : images.filter(i => i.style === filter)
  const charCount = prompt.length
  const tooLong = charCount > 500

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* FORM GENERATION */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎨 Générer des images</h3>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Prompt (description de l'image)</label>
            <span style={{ fontSize: 10, color: tooLong ? '#C75B4E' : 'rgba(237,232,219,0.4)', fontWeight: tooLong ? 700 : 400 }}>{charCount} / 500</span>
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="Ex: Un homme assis à un bureau en bois face à une fenêtre, lumière dorée du matin, ambiance contemplative..."
                    rows={3}
                    style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Style</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STYLES_IMG.map(s => (
              <button key={s.val} onClick={() => setStyle(s.val)}
                      style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${style === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: style === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: style === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: style === s.val ? 700 : 400, cursor: 'pointer' }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Format</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FORMATS_IMG.map(f => (
              <button key={f.val} onClick={() => setFormat(f.val)}
                      style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${format === f.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: format === f.val ? `${STUDIA_COLOR}20` : 'transparent', color: format === f.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: format === f.val ? 700 : 400, cursor: 'pointer' }}>
                {f.emoji} {f.label} <span style={{ opacity: 0.6, fontSize: 10 }}>({f.dims})</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Nombre d'images par lot</label>
            <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{batchSize} image{batchSize > 1 ? 's' : ''}</span>
          </div>
          <input type="range" min="1" max="8" step="1" value={batchSize}
                 onChange={e => setBatchSize(parseInt(e.target.value))}
                 style={{ width: '100%', accentColor: STUDIA_COLOR }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(237,232,219,0.3)', marginTop: 2 }}>
            <span>1</span><span>4</span><span>8</span>
          </div>
        </div>

        <button onClick={generer} disabled={!prompt.trim() || tooLong || generating}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  background: (!prompt.trim() || tooLong || generating) ? `${STUDIA_COLOR}40` : STUDIA_COLOR,
                  color: '#0D1B2A', fontSize: 13, fontWeight: 800,
                  cursor: (!prompt.trim() || tooLong || generating) ? 'not-allowed' : 'pointer',
                }}>
          {generating ? `⏳ Génération de ${batchSize} image${batchSize > 1 ? 's' : ''}...` : `🎨 Générer ${batchSize} image${batchSize > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* GALERIE */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>
            🖼️ Galerie {images.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({filtered.length}{filter !== 'all' ? `/${images.length}` : ''})</span>}
          </h3>
          {images.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#EDE8DB', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ☁️ Exporter le lot ▾
              </button>
              {showExportMenu && (
                <ExportMenu onLocal={exporterLot} onClose={() => setShowExportMenu(false)} />
              )}
            </div>
          )}
        </div>

        {/* Filtres par style */}
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilter('all')}
                    style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === 'all' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === 'all' ? `${STUDIA_COLOR}20` : 'transparent', color: filter === 'all' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === 'all' ? 700 : 400, cursor: 'pointer' }}>
              Tous ({images.length})
            </button>
            {STYLES_IMG.map(s => {
              const count = images.filter(i => i.style === s.val).length
              if (count === 0) return null
              return (
                <button key={s.val} onClick={() => setFilter(s.val)}
                        style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === s.val ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === s.val ? `${STUDIA_COLOR}20` : 'transparent', color: filter === s.val ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === s.val ? 700 : 400, cursor: 'pointer' }}>
                  {s.emoji} {s.label} ({count})
                </button>
              )
            })}
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
            <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 4 }}>
              {images.length === 0 ? 'Aucune image générée pour ce projet' : 'Aucune image avec ce filtre'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>
              {images.length === 0 ? 'Lance une génération ci-dessus pour démarrer.' : 'Change de filtre pour voir les autres styles.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {filtered.map(img => {
              const sty = STYLES_IMG.find(s => s.val === img.style)
              const fmt = FORMATS_IMG.find(f => f.val === img.format)
              const isHover = hoverId === img.id
              return (
                <div key={img.id}
                     onMouseEnter={() => setHoverId(img.id)}
                     onMouseLeave={() => setHoverId(null)}
                     style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', aspectRatio: fmt?.ratio || 1, cursor: 'pointer' }}>
                  <img src={img.dataUrl} alt={img.prompt}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

                  {/* Badge style */}
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                    {sty?.emoji} {sty?.label}
                  </div>

                  {/* Overlay au survol */}
                  {isHover && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, gap: 8,
                    }}>
                      <p style={{ fontSize: 10, color: '#EDE8DB', margin: 0, lineHeight: 1.4, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {img.prompt}
                      </p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => telecharger(img)}
                                title="Télécharger"
                                style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          📥
                        </button>
                        <button onClick={() => copierPrompt(img)}
                                title={copiedId === img.id ? 'Copié !' : 'Copier le prompt'}
                                style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: copiedId === img.id ? '#5BC78A' : 'rgba(255,255,255,0.1)', color: copiedId === img.id ? '#0D1B2A' : '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          {copiedId === img.id ? '✓' : '📋'}
                        </button>
                        <button onClick={() => supprimer(img.id)}
                                title="Supprimer"
                                style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.4)', background: 'rgba(199,91,78,0.2)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          🗑️
                        </button>
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

// ── ONGLET 3 : STUDIO CINÉMA ──────────────────────────────────────
function TabCinema({ project }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📝 Brief vidéo</h3>
          <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
            (Form complet à venir — sujet, durée, voix, style visuel, B-roll auto)
          </p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{ aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
            <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.3)' }}>🎬 Lecteur vidéo HTML5 (à venir Phase 7)</p>
          </div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 8 }}>📌 Annotations</h3>
        <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', marginBottom: 16, lineHeight: 1.5 }}>
          Clique sur la vidéo à un instant T pour annoter et demander une régénération ciblée.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.3)', textAlign: 'center', padding: '40px 0', fontStyle: 'italic' }}>
          (Aucune annotation pour l'instant)
        </p>
      </div>
    </div>
  )
}

// ── ONGLET 4 : TUTOS COURTS ───────────────────────────────────────
function TabShorts({ project }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>⚡ Nouveau short (vertical 9:16)</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Form sujet + style visuel à venir — Phase 6)
        </p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📱 Mes shorts</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Aucun short généré encore)
        </p>
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
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 18px', borderRadius: 0, border: 'none', background: 'transparent',
                color: isActive ? STUDIA_COLOR : 'rgba(237,232,219,0.45)',
                fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                position: 'relative', transition: 'color 0.15s',
                borderBottom: isActive ? `2px solid ${STUDIA_COLOR}` : '2px solid transparent', marginBottom: -1,
              }}>
              <span style={{ marginRight: 6 }}>{t.emoji}</span>{t.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: `${STUDIA_COLOR}15`, color: STUDIA_COLOR, border: `1px solid ${STUDIA_COLOR}30`, fontWeight: 700 }}>
          Stud'IA
        </span>
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

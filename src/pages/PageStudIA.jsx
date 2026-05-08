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
// CONVERSION AUDIO -> WAV (n'importe quel format)
// ============================================

/**
 * Convertit un Blob audio (webm, mp3, m4a, ogg, flac, etc.) en WAV PCM 16-bit mono 44100 Hz.
 * Utilise la Web Audio API (decodeAudioData) qui sait lire tous les formats supportés
 * nativement par Chrome/Edge. Renvoie un Blob WAV.
 */
async function convertAudioBlobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  let audioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    if (audioCtx.state !== 'closed') audioCtx.close()
  }
  return audioBufferToWavBlob(audioBuffer)
}

/**
 * Encode un AudioBuffer en WAV PCM 16-bit mono.
 * Si l'AudioBuffer est stéréo, les canaux sont mixés en mono.
 */
function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const numSamples = audioBuffer.length
  // Mix down to mono si stéréo
  const monoData = new Float32Array(numSamples)
  if (numChannels === 1) {
    monoData.set(audioBuffer.getChannelData(0))
  } else {
    const ch0 = audioBuffer.getChannelData(0)
    const ch1 = audioBuffer.getChannelData(1)
    for (let i = 0; i < numSamples; i++) {
      monoData[i] = (ch0[i] + ch1[i]) / 2
    }
  }
  // Convert Float32 [-1, 1] -> Int16 PCM
  const pcm = new Int16Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, monoData[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  // Build WAV header (44 bytes) + PCM data
  const dataSize = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)            // chunk size
  view.setUint16(20, 1, true)             // PCM format
  view.setUint16(22, 1, true)             // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)             // block align
  view.setUint16(34, 16, true)            // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  // PCM data
  let offset = 44
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Convertit un Blob en string base64 pure (sans préfixe data:...).
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result
      const idx = dataUrl.indexOf(',')
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ============================================
// HELPERS API AGENTS DOPPLER (Stud'IA)
// ============================================

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
 * Helper de gestion d'erreur HTTP : extrait le détail backend dans tous les cas.
 */
async function extractApiError(res) {
  let detail = `HTTP ${res.status}`
  try {
    const e = await res.json()
    if (typeof e.detail === 'string') {
      detail = e.detail
    } else if (Array.isArray(e.detail)) {
      // Pydantic-style validation error -> rendu lisible
      detail = e.detail.map(err => {
        const loc = Array.isArray(err.loc) ? err.loc.join('.') : err.loc
        return `${loc}: ${err.msg}`
      }).join(' | ')
    } else if (e.detail) {
      detail = JSON.stringify(e.detail)
    }
  } catch {}
  return detail
}

// --- Agent SCRIPT (Phase 2 backend) ---

async function genererScriptIA({ projectId, titre, sujet, dureeCibleMin, style, bRoll, voixName }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const res = await fetch(`${AGENTS_API_URL}/studia/script/generer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
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
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

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

async function deleteScriptIA(scriptId) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable')
  const res = await fetch(`${AGENTS_API_URL}/studia/script/${scriptId}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

// --- Agent VOIX (Phase 3 backend - Fish Speech via RunPod) ---

async function clonerVoixIA({ projectId, name, audioBase64, referenceText, durationSec }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  // Champs envoyés au backend (noms exacts attendus par le schéma Pydantic)
  const payload = {
    project_id: projectId,
    name,
    reference_audio_base64: audioBase64,
    reference_text: referenceText,
    duration_sec: durationSec,
  }
  console.log('[clonerVoixIA] payload sent:', {
    ...payload,
    reference_audio_base64: `[${audioBase64.length} chars base64]`,
  })
  const res = await fetch(`${AGENTS_API_URL}/studia/voix/cloner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await extractApiError(res)
    console.error('[clonerVoixIA] backend error:', detail)
    throw new Error(detail)
  }
  return res.json()
}

async function listVoixIA(projectId) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) return { voix: [], count: 0 }
  try {
    const res = await fetch(
      `${AGENTS_API_URL}/studia/voix/list?project_id=${encodeURIComponent(projectId)}`,
      { headers: { 'X-API-Key': apiKey } }
    )
    if (!res.ok) return { voix: [], count: 0 }
    return res.json()
  } catch {
    return { voix: [], count: 0 }
  }
}

async function deleteVoixIA(voixId) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable')
  const res = await fetch(`${AGENTS_API_URL}/studia/voix/${voixId}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

async function genererAudioIA({ voixId, texte, ton, vitesse, temperature, topP, repetitionPenalty }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Clé Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const payload = {
    voix_id: voixId,
    texte,
    ton,
    vitesse,
  }
  // Sliders avancés (optionnels) -- envoyés seulement si explicitement définis
  if (temperature !== undefined && temperature !== null) payload.temperature = temperature
  if (topP !== undefined && topP !== null) payload.top_p = topP
  if (repetitionPenalty !== undefined && repetitionPenalty !== null) payload.repetition_penalty = repetitionPenalty
  console.log('[genererAudioIA] payload sent:', payload)
  const res = await fetch(`${AGENTS_API_URL}/studia/voix/generer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await extractApiError(res)
    console.error('[genererAudioIA] backend error:', detail)
    throw new Error(detail)
  }
  return res.json()
}

function base64ToAudioBlobUrl(base64) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

// ============================================
// HELPERS GÉNÉRATION MOCKS (image/vidéo placeholder)
// ============================================

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
// Convertit un File ou Blob en data URL (data:image/...;base64,...)
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
// ── MODAL CLONAGE VOIX (enregistrement micro OU upload fichier) ─────
function VoixModal({ onClose, onValidate }) {
  const [mode, setMode] = useState('choose') // 'choose' | 'recording' | 'recorded' | 'uploaded'
  const [name, setName] = useState('')
  const [referenceText, setReferenceText] = useState('')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [originalFileName, setOriginalFileName] = useState(null)
  const [recordingState, setRecordingState] = useState('idle') // 'idle' | 'recording'
  const [error, setError] = useState(null)
  const [levels, setLevels] = useState([0,0,0,0,0,0,0,0,0,0,0,0])
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)
  const timerRef = useRef(null)
  const chunksRef = useRef([])
  const fileInputRef = useRef(null)

  const resetAll = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setAudioBlob(null)
    setOriginalFileName(null)
    setDuration(0)
    setError(null)
    setMode('choose')
    setRecordingState('idle')
  }

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
        setAudioBlob(blob)
        setAudioUrl(url)
        setMode('recorded')
        setRecordingState('idle')
      }
      mediaRecorderRef.current = mr
      mr.start()
      const startTime = Date.now()
      timerRef.current = setInterval(() => setDuration((Date.now() - startTime) / 1000), 100)
      setMode('recording')
      setRecordingState('recording')
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|flac|opus|aac|webm|wma)$/i.test(file.name)) {
      setError(`Le fichier "${file.name}" ne semble pas être un fichier audio.`)
      return
    }
    try {
      const url = URL.createObjectURL(file)
      // Détecte la durée via un Audio element temporaire
      const tempAudio = new Audio()
      tempAudio.src = url
      const dur = await new Promise((resolve) => {
        tempAudio.addEventListener('loadedmetadata', () => {
          resolve(isFinite(tempAudio.duration) ? tempAudio.duration : 30)
        })
        tempAudio.addEventListener('error', () => resolve(30))
        // Fallback timeout 3s
        setTimeout(() => resolve(30), 3000)
      })
      setAudioBlob(file)
      setAudioUrl(url)
      setOriginalFileName(file.name)
      setDuration(dur)
      setMode('uploaded')
    } catch (err) {
      setError(`Erreur lors de la lecture du fichier : ${err.message}`)
      console.error(err)
    }
  }

  const validate = async () => {
    if (!name.trim() || !referenceText.trim() || !audioBlob) return
    if (referenceText.trim().length < 10) {
      setError('La transcription doit faire au moins 10 caractères.')
      return
    }
    onValidate({ name: name.trim(), audioBlob, referenceText: referenceText.trim(), duration, sourceType: mode })
  }

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [])

  const tooShort = mode === 'recorded' && duration < 10
  const refTextTooShort = referenceText.trim().length > 0 && referenceText.trim().length < 10
  const canValidate = name.trim() && referenceText.trim().length >= 10 && audioBlob

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget && recordingState !== 'recording') onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 540, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🎙️ Cloner une voix</h3>
          {recordingState !== 'recording' && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>}
        </div>

        {/* Champs nom + transcription -- toujours visibles */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Nom de la voix *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lucien posé, Lucien colère, Voix grand-père..." disabled={recordingState === 'recording'} style={{ ...iS, opacity: recordingState === 'recording' ? 0.5 : 1 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Transcription du contenu audio * <span style={{ color: 'rgba(237,232,219,0.3)' }}>(min 10 caractères)</span></label>
          <textarea
            value={referenceText}
            onChange={e => setReferenceText(e.target.value)}
            placeholder="Ex: Bonjour, je m'appelle Lucien et je teste actuellement le clonage vocal pour mon logiciel Pilot."
            rows={3}
            disabled={recordingState === 'recording'}
            style={{ ...iS, resize: 'vertical', opacity: recordingState === 'recording' ? 0.5 : 1, borderColor: refTextTooShort ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }}
          />
          {refTextTooShort && <div style={{ fontSize: 10, color: '#C75B4E', marginTop: 4 }}>Encore {10 - referenceText.trim().length} caractères minimum.</div>}
        </div>

        {error && <div style={{ background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: '#C75B4E' }}>⚠️ {error}</div>}

        {/* Choix de la source : enregistrement micro OU upload fichier */}
        {mode === 'choose' && (
          <>
            <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.7)', lineHeight: 1.6 }}>
              💡 <strong>Échantillon idéal :</strong> 10 à 30 secondes d'audio clair, sans bruit de fond. La transcription doit correspondre exactement à ce qui est dit.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={startRecording} disabled={!name.trim() || referenceText.trim().length < 10} style={{ padding: '20px 14px', borderRadius: 12, border: `1px solid ${(name.trim() && referenceText.trim().length >= 10) ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: (name.trim() && referenceText.trim().length >= 10) ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.02)', color: (name.trim() && referenceText.trim().length >= 10) ? STUDIA_COLOR : 'rgba(237,232,219,0.4)', fontSize: 12, fontWeight: 700, cursor: (name.trim() && referenceText.trim().length >= 10) ? 'pointer' : 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 28 }}>🎙️</span>
                <span>Enregistrer au micro</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={!name.trim() || referenceText.trim().length < 10} style={{ padding: '20px 14px', borderRadius: 12, border: `1px solid ${(name.trim() && referenceText.trim().length >= 10) ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: (name.trim() && referenceText.trim().length >= 10) ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.02)', color: (name.trim() && referenceText.trim().length >= 10) ? STUDIA_COLOR : 'rgba(237,232,219,0.4)', fontSize: 12, fontWeight: 700, cursor: (name.trim() && referenceText.trim().length >= 10) ? 'pointer' : 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 28 }}>📁</span>
                <span>Uploader un fichier</span>
                <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>WAV, MP3, M4A, OGG, FLAC...</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.opus,.aac,.webm,.wma" onChange={handleFileUpload} style={{ display: 'none' }} />
          </>
        )}

        {/* État : enregistrement en cours */}
        {mode === 'recording' && (
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

        {/* État : audio prêt (enregistré OU uploadé) */}
        {(mode === 'recorded' || mode === 'uploaded') && (
          <div>
            <div style={{ background: 'rgba(91,199,138,0.08)', border: '1px solid rgba(91,199,138,0.3)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5BC78A' }}>
                  {mode === 'uploaded' ? `📁 Fichier importé` : '✅ Enregistrement capturé'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(237,232,219,0.5)' }}>{fmtTime(duration)}</span>
                {originalFileName && <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{originalFileName}</span>}
              </div>
              {audioUrl && <audio src={audioUrl} controls style={{ width: '100%', height: 36 }} />}
            </div>
            {tooShort && <div style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: '#D4A853' }}>⚠️ Enregistrement court ({fmtTime(duration)}). Vise au moins 10s.</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetAll} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔄 Recommencer</button>
              <button onClick={validate} disabled={!canValidate} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: canValidate ? '#5BC78A' : 'rgba(91,199,138,0.3)', color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: canValidate ? 'pointer' : 'not-allowed' }}>✅ Valider et cloner</button>
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

// ── ONGLET 1 : VOIX (BACKEND-CONNECTED Fish Speech / RunPod) ──────
function TabVoix({ project }) {
  const audiosKey = `pilotage_studia_audios_${project.id}`

  const [voix, setVoix] = useState([])
  const [loadingVoix, setLoadingVoix] = useState(false)
  const [audios, setAudios] = useState(() => { try { const s = localStorage.getItem(audiosKey); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [showRecModal, setShowRecModal] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [cloningStep, setCloningStep] = useState('')
  const [selectedVoix, setSelectedVoix] = useState('')
  const [ton, setTon] = useState('neutre')
  const [vitesse, setVitesse] = useState(1.0)
  const [texte, setTexte] = useState('')
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  // Sliders avancés (Fish Speech)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState(0.8)
  const [topP, setTopP] = useState(0.8)
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.1)

  const showError = (msg, dur = 8000) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), dur) }
  const showSuccess = (msg, dur = 4000) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), dur) }

  const refreshVoix = async () => {
    setLoadingVoix(true)
    try {
      const res = await listVoixIA(project.id)
      setVoix(res.voix || [])
    } catch (err) {
      console.error('Erreur chargement voix:', err)
      setVoix([])
    }
    setLoadingVoix(false)
  }

  useEffect(() => {
    refreshVoix()
    try { setAudios(JSON.parse(localStorage.getItem(audiosKey)) || []) } catch { setAudios([]) }
    setSelectedVoix('')
  }, [project.id])

  const persistAudios = (a) => {
    // On stocke sans le _blobUrl (volatile)
    const cleaned = a.map(x => ({ ...x, _blobUrl: undefined }))
    localStorage.setItem(audiosKey, JSON.stringify(cleaned))
    setAudios(a)
  }

  /**
   * Soumis quand la modal valide.
   * @param {Object} args - { name, audioBlob, referenceText, duration, sourceType }
   * sourceType peut être 'recorded' (webm depuis micro) ou 'uploaded' (n'importe quel format)
   */
  const handleNewVoix = async ({ name, audioBlob, referenceText, duration, sourceType }) => {
    setShowRecModal(false)
    setCloning(true)
    setErrorMsg(null)
    try {
      // ÉTAPE 1 : Conversion en WAV (peu importe le format source)
      setCloningStep('🔄 Conversion en WAV...')
      console.log('[handleNewVoix] source blob:', { type: audioBlob.type, size: audioBlob.size, sourceType })
      const wavBlob = await convertAudioBlobToWav(audioBlob)
      console.log('[handleNewVoix] converted WAV blob:', { size: wavBlob.size })

      // ÉTAPE 2 : Encodage base64
      setCloningStep('📦 Encodage en base64...')
      const audioBase64 = await blobToBase64(wavBlob)
      console.log('[handleNewVoix] base64 length:', audioBase64.length)

      if (audioBase64.length < 100) {
        throw new Error(`Audio trop court ou corrompu après conversion (${audioBase64.length} caractères base64). Réessaie avec un échantillon plus long.`)
      }

      // ÉTAPE 3 : Envoi backend
      setCloningStep('☁️ Envoi au backend...')
      const result = await clonerVoixIA({
        projectId: project.id,
        name,
        audioBase64,
        referenceText,
        durationSec: Math.round(duration),
      })

      await refreshVoix()
      setSelectedVoix(result.id)
      showSuccess(`✅ Voix "${name}" enregistrée et prête à l'emploi !`)
    } catch (err) {
      console.error('Erreur clonage voix:', err)
      showError(`❌ Erreur clonage : ${err.message}`)
    }
    setCloning(false)
    setCloningStep('')
  }

  const supprimerVoix = async (id) => {
    if (!confirm('Supprimer cette voix ?')) return
    try {
      await deleteVoixIA(id)
      setVoix(prev => prev.filter(v => v.id !== id))
      if (selectedVoix === id) setSelectedVoix('')
      showSuccess('🗑️ Voix supprimée')
    } catch (err) {
      showError(`❌ Erreur suppression : ${err.message}`)
    }
  }

  const genererAudio = async () => {
    if (!selectedVoix || !texte.trim() || generating) return
    setGenerating(true)
    setErrorMsg(null)
    try {
      const result = await genererAudioIA({
        voixId: selectedVoix,
        texte: texte.trim(),
        ton,
        vitesse,
        // Sliders avancés -- envoyés seulement si l'utilisateur les a touchés
        temperature: showAdvanced ? temperature : undefined,
        topP: showAdvanced ? topP : undefined,
        repetitionPenalty: showAdvanced ? repetitionPenalty : undefined,
      })
      const blobUrl = base64ToAudioBlobUrl(result.audio_base64)
      const newAudio = {
        id: Date.now().toString(),
        voixId: selectedVoix,
        voixName: result.voix_name || 'Voix',
        ton,
        vitesse,
        texte: texte.slice(0, 200),
        audioBase64: result.audio_base64,
        duration: result.duree_estimee_sec || Math.max(3, texte.split(/\s+/).length * 0.4),
        _blobUrl: blobUrl,
        createdAt: new Date().toISOString(),
      }
      const newList = [newAudio, ...audios].slice(0, 20)
      persistAudios(newList)
      setTexte('')
      showSuccess(`🎙️ Audio généré (${Math.round(result.duree_estimee_sec || 0)}s)`)
    } catch (err) {
      console.error('Erreur génération audio:', err)
      if (err.message.includes('timeout') || err.message.includes('504')) {
        showError(`⏱️ Premier appel à froid trop long (RunPod). Réessaie : la 2ème tentative est rapide (~10s).`, 10000)
      } else {
        showError(`❌ Erreur : ${err.message}`)
      }
    }
    setGenerating(false)
  }

  const supprimerAudio = (id) => {
    const a = audios.find(x => x.id === id)
    if (a?._blobUrl) URL.revokeObjectURL(a._blobUrl)
    persistAudios(audios.filter(x => x.id !== id))
  }

  // Reconstruit blobUrl pour les audios chargés depuis localStorage
  const ensureBlobUrl = (a) => {
    if (a._blobUrl) return a._blobUrl
    if (a.audioBase64) {
      try {
        const url = base64ToAudioBlobUrl(a.audioBase64)
        // Mute la mise à jour pour éviter re-render infini
        a._blobUrl = url
        return url
      } catch {
        return null
      }
    }
    return a.audioData || null
  }

  const charCount = texte.length
  const tooLong = charCount > 2000
  const voixPretes = voix.filter(v => v.status === 'ready')

  return (
    <>
      {showRecModal && <VoixModal onClose={() => setShowRecModal(false)} onValidate={handleNewVoix} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Colonne gauche : voix clonées */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', fontSize: 12, color: '#C75B4E', wordBreak: 'break-word' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', fontSize: 12, color: '#5BC78A' }}>
              {successMsg}
            </div>
          )}

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🎤 Mes voix clonées {voix.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({voix.length})</span>}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={refreshVoix} disabled={loadingVoix || cloning} title="Rafraîchir" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.6)', fontSize: 11, cursor: (loadingVoix || cloning) ? 'not-allowed' : 'pointer' }}>
                  {loadingVoix ? '⏳' : '🔄'}
                </button>
                <button onClick={() => setShowRecModal(true)} disabled={cloning} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: cloning ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: cloning ? 'not-allowed' : 'pointer' }}>
                  {cloning ? '⏳ Clonage...' : '🎙️ Cloner ma voix'}
                </button>
              </div>
            </div>

            {cloning && (
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11, color: '#D4A853', textAlign: 'center' }}>
                {cloningStep || '⏳ En cours...'}
              </div>
            )}

            {loadingVoix && voix.length === 0 ? (
              <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.5)' }}>Chargement des voix...</p>
              </div>
            ) : voix.length === 0 ? (
              <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 6 }}>Aucune voix clonée pour ce projet</p>
                <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Clique sur "Cloner ma voix" — micro ou fichier audio.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {voix.map(v => {
                  const isSelected = selectedVoix === v.id
                  const isReady = v.status === 'ready'
                  return (
                    <div key={v.id} style={{ background: isSelected ? `${STUDIA_COLOR}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? STUDIA_COLOR : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${STUDIA_COLOR}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎤</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>
                            {!isReady ? <span style={{ color: '#D4A853' }}>⏳ {v.status || 'En traitement'}</span> : <span style={{ color: '#5BC78A' }}>✅ Prête</span>}
                            {' · '}{fmtTime(v.duration_sec || 0)} d'échantillon
                          </div>
                        </div>
                        <button onClick={() => supprimerVoix(v.id)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(199,91,78,0.2)', background: 'transparent', color: '#C75B4E', fontSize: 11, cursor: 'pointer', flexShrink: 0 }} title="Supprimer">🗑️</button>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', fontStyle: 'italic', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, marginBottom: 8 }}>
                        "{(v.reference_text || '').slice(0, 100)}{(v.reference_text || '').length > 100 ? '...' : ''}"
                      </div>
                      {isReady && (
                        <button onClick={() => setSelectedVoix(v.id)} style={{ width: '100%', padding: '7px', borderRadius: 8, border: `1px solid ${isSelected ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: isSelected ? STUDIA_COLOR : 'transparent', color: isSelected ? '#0D1B2A' : 'rgba(237,232,219,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {isSelected ? '✓ Voix sélectionnée' : 'Sélectionner pour génération →'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : génération + audios */}
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
                  <textarea value={texte} onChange={e => setTexte(e.target.value)} placeholder="Tape ou colle le texte à faire prononcer..." rows={6} style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }} disabled={generating} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Vitesse</label>
                    <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{vitesse.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.8" max="1.2" step="0.1" value={vitesse} onChange={e => setVitesse(parseFloat(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
                </div>

                {/* Sliders avancés Fish Speech */}
                <div style={{ marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setShowAdvanced(!showAdvanced)} disabled={generating} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(237,232,219,0.6)', fontSize: 11, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚙️ Paramètres avancés Fish Speech</span>
                    <span>{showAdvanced ? '▼' : '▶'}</span>
                  </button>
                  {showAdvanced && (
                    <div style={{ padding: 14, background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 10, color: 'rgba(237,232,219,0.5)' }}>Température (expressivité)</label>
                          <span style={{ fontSize: 10, color: STUDIA_COLOR, fontWeight: 700 }}>{temperature.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0.5" max="1.5" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
                        <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.3)', marginTop: 2 }}>Bas = plus stable et monotone · Haut = plus expressif et imprévisible</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 10, color: 'rgba(237,232,219,0.5)' }}>Top-p (créativité de l'intonation)</label>
                          <span style={{ fontSize: 10, color: STUDIA_COLOR, fontWeight: 700 }}>{topP.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0.5" max="1.0" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 10, color: 'rgba(237,232,219,0.5)' }}>Pénalité de répétition</label>
                          <span style={{ fontSize: 10, color: STUDIA_COLOR, fontWeight: 700 }}>{repetitionPenalty.toFixed(2)}</span>
                        </div>
                        <input type="range" min="1.0" max="1.3" step="0.05" value={repetitionPenalty} onChange={e => setRepetitionPenalty(parseFloat(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
                      </div>
                      <button onClick={() => { setTemperature(0.8); setTopP(0.8); setRepetitionPenalty(1.1) }} disabled={generating} style={{ padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}>↺ Valeurs par défaut</button>
                    </div>
                  )}
                </div>

                <button onClick={genererAudio} disabled={!selectedVoix || !texte.trim() || tooLong || generating} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: (!selectedVoix || !texte.trim() || tooLong || generating) ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: (!selectedVoix || !texte.trim() || tooLong || generating) ? 'not-allowed' : 'pointer' }}>
                  {generating ? '⏳ Génération en cours (5-90s)...' : "🎙️ Générer l'audio"}
                </button>
                {generating && (
                  <p style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 10, textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5 }}>
                    1er appel à froid : ~60-90s. Appels suivants : ~5-15s. Patience ☕
                  </p>
                )}
              </>
            )}
          </div>
          {audios.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Audios générés ({audios.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {audios.slice(0, 5).map(a => {
                  const playbackUrl = ensureBlobUrl(a)
                  return (
                    <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: STUDIA_COLOR }}>🎤 {a.voixName}</div>
                          <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>{TON_OPTIONS.find(t => t.val === a.ton)?.label || a.ton} · {a.vitesse}x · {fmtTime(a.duration)}</div>
                        </div>
                        <button onClick={() => {
                          const dataUrl = `data:audio/wav;base64,${a.audioBase64}`
                          downloadDataUrl(dataUrl, `${slugify(a.voixName)}-${slugify(a.texte.slice(0, 40))}-${a.id}.wav`)
                        }} title="Télécharger en WAV" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(127,119,221,0.3)', background: 'transparent', color: STUDIA_COLOR, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>📥</button>
                        <button onClick={() => supprimerAudio(a.id)} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.6)', margin: '0 0 8px', lineHeight: 1.5, fontStyle: 'italic' }}>"{a.texte}{a.texte.length >= 200 ? '...' : ''}"</p>
                      {playbackUrl && <audio src={playbackUrl} controls style={{ width: '100%', height: 30 }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
// ── MODAL CONFIGURATION CLE API OPENAI ─────────────────────────
function OpenAIKeyModal({ onClose, onSaved }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    if (!key.trim().startsWith('sk-')) {
      setError('La cle doit commencer par "sk-".')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await window.electronAPI.studia.setOpenAIKey(key.trim())
      if (res.success) {
        onSaved()
      } else {
        setError(res.error || 'Erreur inconnue')
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 500, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🔑 Cle API OpenAI</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.7)', lineHeight: 1.6 }}>
          💡 Ta cle API est stockee <strong>uniquement sur ton PC</strong> (fichier <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>userData/openai-config.json</code>). Elle n'est jamais envoyee sur les serveurs Doppler. Toutes les requetes vont <strong>directement</strong> de ton PC vers <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>api.openai.com</code>.
        </div>

        <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Cle API (commence par sk-...)</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          style={iS}
          onKeyDown={e => { if (e.key === 'Enter' && key.trim()) save() }}
        />
        <p style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 6 }}>
          Tu n'as pas encore de cle ? Cree-en une sur <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: STUDIA_COLOR }}>platform.openai.com/api-keys</a>
        </p>

        {error && <div style={{ background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12, color: '#C75B4E' }}>⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          <button onClick={save} disabled={!key.trim() || saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: (!key.trim() || saving) ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: (!key.trim() || saving) ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ Verification...' : '💾 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
// ── ONGLET 2 : IMAGES (GPT Image 1 OpenAI - BYOK) ────────────────
function TabImages({ project }) {
  const storageKey = `pilotage_studia_images_${project.id}`
  const [images, setImages] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] } catch { return [] } })

  // Mode genre
  const [engine, setEngine] = useState('gpt')          // 'flux' (Phase 4b) | 'gpt' (actif)
  const [mode, setMode] = useState('generate')         // 'generate' (txt2img) | 'edit' (img2img)
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')        // 1024x1024 | 1536x1024 | 1024x1536

  // Mode img2img : photo de reference
  const [refImage, setRefImage] = useState(null)       // { dataUrl, name }
  const fileInputRef = useRef(null)

  // Cle OpenAI + usage
  const [hasKey, setHasKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [usage, setUsage] = useState({ totalSpent: 0, generations: [] })

  // Etat generation
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Galerie
  const [hoverId, setHoverId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [filter, setFilter] = useState('all')          // 'all' | 'generate' | 'edit'

  const showError = (msg, dur = 8000) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), dur) }
  const showSuccess = (msg, dur = 4000) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), dur) }

  const refreshKeyAndUsage = async () => {
    try {
      const has = await window.electronAPI.studia.hasOpenAIKey()
      setHasKey(has)
      const u = await window.electronAPI.studia.getUsage()
      setUsage(u || { totalSpent: 0, generations: [] })
    } catch (err) {
      console.error('refreshKeyAndUsage:', err)
    }
    setKeyChecked(true)
  }

  useEffect(() => {
    refreshKeyAndUsage()
    try { setImages(JSON.parse(localStorage.getItem(storageKey)) || []) } catch { setImages([]) }
  }, [project.id])

  const persist = (arr) => { localStorage.setItem(storageKey, JSON.stringify(arr)); setImages(arr) }

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showError('Le fichier doit etre une image (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      showError('Image trop grosse (25 Mo max).')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setRefImage({ dataUrl, name: file.name })
    } catch (err) {
      showError(`Erreur lecture fichier : ${err.message}`)
    }
  }

  const removeRefImage = () => {
    setRefImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const generer = async () => {
    if (!prompt.trim() || generating) return
    if (!hasKey) {
      setShowKeyModal(true)
      return
    }
    if (mode === 'edit' && !refImage) {
      showError('En mode "Image + Texte", upload d\'abord une image de reference.')
      return
    }
    setGenerating(true)
    setErrorMsg(null)
    try {
      const result = await window.electronAPI.studia.generateImage({
        projectId: project.id,
        prompt: prompt.trim(),
        mode,
        photoDataUrl: mode === 'edit' ? refImage.dataUrl : null,
        size,
      })
      if (!result.success) {
        showError(`❌ ${result.error || 'Erreur generation'}`)
      } else {
        const newImg = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          prompt: prompt.trim(),
          mode: result.mode,
          engine: 'gpt',
          size,
          fileUrl: result.fileUrl,
          dataUrl: result.dataUrl,        // pour affichage immediat (bypass file:// CSP)
          filename: result.filename,
          cost: result.cost,
          refImageName: mode === 'edit' ? refImage?.name : null,
          createdAt: new Date().toISOString(),
        }
        persist([newImg, ...images].slice(0, 100))
        setUsage(prev => ({ ...prev, totalSpent: result.totalSpent }))
        showSuccess(`✨ Image generee · cout ${result.cost.toFixed(2)}$ · total ${result.totalSpent.toFixed(2)}$`)
        // On garde le prompt et la ref pour pouvoir generer une variation
      }
    } catch (err) {
      showError(`❌ Erreur : ${err.message}`)
      console.error(err)
    }
    setGenerating(false)
  }

  const supprimer = async (img) => {
    if (img.fileUrl) {
      try { await window.electronAPI.studia.deleteImage(img.fileUrl) } catch {}
    }
    persist(images.filter(i => i.id !== img.id))
  }

  const copierPrompt = (img) => {
    navigator.clipboard.writeText(img.prompt)
    setCopiedId(img.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const telecharger = async (img) => {
    try {
      if (img.fileUrl) {
        const result = await window.electronAPI.studia.exportImage({
          sourceFileUrl: img.fileUrl,
          suggestedName: `${slugify(img.prompt)}-${img.id}.png`,
        })
        if (result.success) {
          showSuccess(`💾 Image exportee : ${result.path.split(/[\\/]/).pop()}`)
        } else if (!result.canceled) {
          showError(`Erreur export : ${result.error}`)
        }
      } else if (img.dataUrl) {
        downloadDataUrl(img.dataUrl, `${slugify(img.prompt)}-${img.id}.png`)
      }
    } catch (err) {
      showError(`Erreur telechargement : ${err.message}`)
    }
  }

  const ouvrirDossierImages = async () => {
    await window.electronAPI.studia.revealImagesFolder()
  }

  const filtered = filter === 'all' ? images : images.filter(i => i.mode === filter)
  const charCount = prompt.length
  const tooLong = charCount > 1000
  const peutGenerer = prompt.trim() && !tooLong && !generating && (mode === 'generate' || refImage)

  // Cout estime par image selon mode
  const coutEstime = mode === 'edit' ? 0.06 : 0.04

  if (!keyChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'rgba(237,232,219,0.4)' }}>
        ⏳ Chargement...
      </div>
    )
  }

  return (
    <>
      {showKeyModal && (
        <OpenAIKeyModal
          onClose={() => setShowKeyModal(false)}
          onSaved={() => { setShowKeyModal(false); refreshKeyAndUsage(); showSuccess('🔑 Cle API enregistree') }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', fontSize: 12, color: '#C75B4E' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', fontSize: 12, color: '#5BC78A' }}>
            {successMsg}
          </div>
        )}

        {/* ═══ TOGGLE MODE FLUX / GPT IMAGE ═══ */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Moteur de generation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => showError('FLUX arrive en Phase 4b (gratuit, RunPod). Pour l\'instant, utilise GPT Image.', 5000)}
              disabled
              style={{
                padding: '14px 12px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                color: 'rgba(237,232,219,0.3)',
                fontSize: 12, fontWeight: 700, cursor: 'not-allowed',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20 }}>⚡</div>
              <div>FLUX Schnell</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>~0.01€ · Bientot</div>
            </button>
            <button
              onClick={() => setEngine('gpt')}
              style={{
                padding: '14px 12px', borderRadius: 12,
                border: `1px solid ${engine === 'gpt' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`,
                background: engine === 'gpt' ? `${STUDIA_COLOR}20` : 'rgba(255,255,255,0.02)',
                color: engine === 'gpt' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20 }}>⭐</div>
              <div>GPT Image 1</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>~{coutEstime.toFixed(2)}$ · Premium</div>
            </button>
          </div>

          {/* Stats credits/conso */}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
            <span style={{ color: 'rgba(237,232,219,0.5)' }}>
              💰 OpenAI conso cumulee Pilot : <strong style={{ color: STUDIA_COLOR }}>{usage.totalSpent.toFixed(2)}$</strong>
              {' · '}
              <span style={{ color: 'rgba(237,232,219,0.4)' }}>{usage.generations?.length || 0} images</span>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {hasKey ? (
                <button onClick={() => setShowKeyModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.6)', fontSize: 10, cursor: 'pointer' }} title="Modifier la cle">
                  🔑 Cle ✓
                </button>
              ) : (
                <button onClick={() => setShowKeyModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${STUDIA_COLOR}`, background: `${STUDIA_COLOR}20`, color: STUDIA_COLOR, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  🔑 Configurer cle API
                </button>
              )}
              <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 10, cursor: 'pointer', textDecoration: 'none' }}>
                Voir solde OpenAI ↗
              </a>
            </div>
          </div>
        </div>

        {/* ═══ FORMULAIRE GENERATION ═══ */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎨 Generer une image</h3>

          {/* Mode txt2img / img2img */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setMode('generate')} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${mode === 'generate' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: mode === 'generate' ? `${STUDIA_COLOR}20` : 'transparent', color: mode === 'generate' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 11 }}>📝 Texte → Image</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>Prompt seul · ~0.04$</div>
              </button>
              <button onClick={() => setMode('edit')} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${mode === 'edit' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: mode === 'edit' ? `${STUDIA_COLOR}20` : 'transparent', color: mode === 'edit' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 11 }}>📷 Image + Texte → Image</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>Transformer une photo · ~0.06$</div>
              </button>
            </div>
          </div>

          {/* Upload image de reference (mode img2img) */}
          {mode === 'edit' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Image de reference *</label>
              {!refImage ? (
                <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '24px 14px', borderRadius: 10, border: `1px dashed ${STUDIA_COLOR}50`, background: `${STUDIA_COLOR}05`, color: STUDIA_COLOR, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 28 }}>📁</span>
                  <span>Cliquer pour uploader une image</span>
                  <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>PNG, JPG, WEBP · 25 Mo max</span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={refImage.dataUrl} alt="Ref" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#EDE8DB', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refImage.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>Image de reference</div>
                  </div>
                  <button onClick={removeRefImage} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.3)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✕ Retirer</button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelected} style={{ display: 'none' }} />
            </div>
          )}

          {/* Prompt */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>
                {mode === 'edit' ? 'Prompt de transformation' : 'Prompt'}
              </label>
              <span style={{ fontSize: 10, color: tooLong ? '#C75B4E' : 'rgba(237,232,219,0.4)', fontWeight: tooLong ? 700 : 400 }}>{charCount} / 1000</span>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={mode === 'edit'
                ? 'Ex: Transforme en super-heros, change le fond en plage tropicale, ajoute des lunettes de soleil...'
                : 'Ex: Un homme au bureau face a une fenetre, lumiere doree du matin...'
              }
              rows={4}
              style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }}
              disabled={generating}
            />
          </div>

          {/* Format / Taille */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Format</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setSize('1024x1024')} disabled={generating} style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${size === '1024x1024' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: size === '1024x1024' ? `${STUDIA_COLOR}20` : 'transparent', color: size === '1024x1024' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: size === '1024x1024' ? 700 : 400, cursor: generating ? 'not-allowed' : 'pointer' }}>⬛ Carre 1024×1024</button>
              <button onClick={() => setSize('1536x1024')} disabled={generating} style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${size === '1536x1024' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: size === '1536x1024' ? `${STUDIA_COLOR}20` : 'transparent', color: size === '1536x1024' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: size === '1536x1024' ? 700 : 400, cursor: generating ? 'not-allowed' : 'pointer' }}>🖥️ Paysage 1536×1024</button>
              <button onClick={() => setSize('1024x1536')} disabled={generating} style={{ padding: '7px 12px', borderRadius: 18, border: `1px solid ${size === '1024x1536' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: size === '1024x1536' ? `${STUDIA_COLOR}20` : 'transparent', color: size === '1024x1536' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: size === '1024x1536' ? 700 : 400, cursor: generating ? 'not-allowed' : 'pointer' }}>📱 Portrait 1024×1536</button>
            </div>
          </div>

          <button onClick={generer} disabled={!peutGenerer} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: !peutGenerer ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: !peutGenerer ? 'not-allowed' : 'pointer' }}>
            {generating
              ? '⏳ Generation en cours (15-40s)...'
              : `${mode === 'edit' ? '🎨 Transformer l\'image' : '✨ Generer l\'image'} · ~${coutEstime.toFixed(2)}$`
            }
          </button>
          {!hasKey && (
            <p style={{ fontSize: 10, color: '#D4A853', marginTop: 8, textAlign: 'center' }}>
              ⚠️ Cle API OpenAI non configuree. Clique pour la configurer.
            </p>
          )}
        </div>

        {/* ═══ GALERIE ═══ */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>
              🖼️ Galerie {images.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({filtered.length}{filter !== 'all' ? `/${images.length}` : ''})</span>}
            </h3>
            {images.length > 0 && (
              <button onClick={ouvrirDossierImages} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#EDE8DB', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>📁 Ouvrir dossier</button>
            )}
          </div>

          {images.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setFilter('all')} style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === 'all' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === 'all' ? `${STUDIA_COLOR}20` : 'transparent', color: filter === 'all' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === 'all' ? 700 : 400, cursor: 'pointer' }}>Tous ({images.length})</button>
              <button onClick={() => setFilter('generate')} style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === 'generate' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === 'generate' ? `${STUDIA_COLOR}20` : 'transparent', color: filter === 'generate' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === 'generate' ? 700 : 400, cursor: 'pointer' }}>📝 Texte ({images.filter(i => i.mode === 'generate').length})</button>
              <button onClick={() => setFilter('edit')} style={{ padding: '4px 10px', borderRadius: 14, border: `1px solid ${filter === 'edit' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: filter === 'edit' ? `${STUDIA_COLOR}20` : 'transparent', color: filter === 'edit' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 10, fontWeight: filter === 'edit' ? 700 : 400, cursor: 'pointer' }}>📷 Img2img ({images.filter(i => i.mode === 'edit').length})</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
              <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 4 }}>{images.length === 0 ? 'Aucune image generee' : 'Aucune image avec ce filtre'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {filtered.map(img => {
                const isHover = hoverId === img.id
                const ratio = img.size === '1536x1024' ? 1536/1024 : img.size === '1024x1536' ? 1024/1536 : 1
                const modeLabel = img.mode === 'edit' ? '📷 Img2img' : '📝 Texte'
                return (
                  <div key={img.id} onMouseEnter={() => setHoverId(img.id)} onMouseLeave={() => setHoverId(null)} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', aspectRatio: ratio, cursor: 'pointer' }}>
                    <img src={img.dataUrl || img.fileUrl} alt={img.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
                      <span style={{ background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{modeLabel}</span>
                      {img.cost && <span style={{ background: 'rgba(0,0,0,0.7)', color: STUDIA_COLOR, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{img.cost.toFixed(2)}$</span>}
                    </div>
                    {isHover && (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, gap: 8 }}>
                        <p style={{ fontSize: 10, color: '#EDE8DB', margin: 0, lineHeight: 1.4, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.prompt}</p>
                        {img.refImageName && <p style={{ fontSize: 9, color: 'rgba(237,232,219,0.5)', margin: 0, fontStyle: 'italic' }}>📷 Ref: {img.refImageName}</p>}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => window.electronAPI.studia.openImage(img.fileUrl)} title="Ouvrir l'image" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🖼️</button>
                          <button onClick={() => telecharger(img)} title="Telecharger" style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>📥</button>
                          <button onClick={() => copierPrompt(img)} title="Copier prompt" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: copiedId === img.id ? '#5BC78A' : 'rgba(255,255,255,0.1)', color: copiedId === img.id ? '#0D1B2A' : '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{copiedId === img.id ? '✓' : '📋'}</button>
                          <button onClick={() => supprimer(img)} title="Supprimer" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.4)', background: 'rgba(199,91,78,0.2)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
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
    </>
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

// ── ONGLET 3 : STUDIO CINÉMA ─────────────────────────────────────
function TabCinema({ project }) {
  const annotationsKey = `pilotage_studia_annotations_${project.id}`
  const sceneEditsKey = `pilotage_studia_scene_edits_${project.id}`

  const [scripts, setScripts] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [annotations, setAnnotations] = useState(() => { try { return JSON.parse(localStorage.getItem(annotationsKey)) || {} } catch { return {} } })
  const [sceneEdits, setSceneEdits] = useState(() => { try { return JSON.parse(localStorage.getItem(sceneEditsKey)) || {} } catch { return {} } })
  const [voixDispo, setVoixDispo] = useState([])
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [titre, setTitre] = useState('')
  const [sujet, setSujet] = useState('')
  const [duree, setDuree] = useState(5)
  const [voixId, setVoixId] = useState('')
  const [styleVid, setStyleVid] = useState('documentaire')
  const [bRoll, setBRoll] = useState(true)

  const [generating, setGenerating] = useState(false)
  const [genPhase, setGenPhase] = useState(0)

  const [activeScript, setActiveScript] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [showAnnotModal, setShowAnnotModal] = useState(false)
  const [pausedAt, setPausedAt] = useState(0)
  const videoRef = useRef(null)

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

  const refreshVoixDispo = async () => {
    try {
      const result = await listVoixIA(project.id)
      setVoixDispo((result.voix || []).filter(v => v.status === 'ready'))
    } catch (err) {
      console.error('Erreur chargement voix dispo:', err)
      setVoixDispo([])
    }
  }

  useEffect(() => {
    refreshScripts()
    refreshVoixDispo()
    try { setAnnotations(JSON.parse(localStorage.getItem(annotationsKey)) || {}) } catch { setAnnotations({}) }
    try { setSceneEdits(JSON.parse(localStorage.getItem(sceneEditsKey)) || {}) } catch { setSceneEdits({}) }
    setActiveScript(null); setVideoUrl(null)
  }, [project.id])

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
      for (let i = 1; i < PHASES_VIDEO.length; i++) {
        setGenPhase(i)
        await new Promise(r => setTimeout(r, PHASES_VIDEO[i].mockMs))
      }
      await refreshScripts()
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
              </div>
            )}
          </div>

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
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
  const [shorts, setShorts] = useState(() => { try { return JSON.parse(localStorage.getItem(shortsKey)) || [] } catch { return [] } })
  const [voixDispo, setVoixDispo] = useState([])

  const [sujet, setSujet] = useState('')
  const [dureeShort, setDureeShort] = useState(60)
  const [voixId, setVoixId] = useState('')
  const [styleS, setStyleS] = useState('demo')
  const [sousTitres, setSousTitres] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [shortVideoUrls, setShortVideoUrls] = useState({})

  const refreshVoixDispo = async () => {
    try {
      const result = await listVoixIA(project.id)
      setVoixDispo((result.voix || []).filter(v => v.status === 'ready'))
    } catch {
      setVoixDispo([])
    }
  }

  useEffect(() => {
    try { setShorts(JSON.parse(localStorage.getItem(shortsKey)) || []) } catch { setShorts([]) }
    refreshVoixDispo()
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

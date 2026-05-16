import { useState, useEffect, useRef } from 'react'
import DriveModal from './DriveModal'

const STUDIA_COLOR = '#7F77DD'
const AGENTS_API_URL = 'https://agents.vigie-officiel.com'

const TABS = [
  { id: 'voix',       label: 'Clone IA voix',       emoji: '🎙️', subtitle: 'Cloner ta voix et générer des audios' },
  { id: 'images',     label: 'Photos & Images IA',  emoji: '🖼️', subtitle: 'Générer des images par lot' },
  { id: 'cinema',     label: 'Studio Cinéma',       emoji: '🎬', subtitle: 'Vidéos longues 3-12 min, montage auto' },
  { id: 'shorts',     label: 'Tutos vidéo courts',  emoji: '⚡', subtitle: 'Shorts 30s-2min vertical 9:16' },
  { id: 'transcript', label: 'YouTube Transcript',  emoji: '📜', subtitle: 'Extraire et analyser des transcripts YouTube' },
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

function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const numSamples = audioBuffer.length
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
  const pcm = new Int16Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, monoData[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
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
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

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

async function extractApiError(res) {
  let detail = `HTTP ${res.status}`
  try {
    const e = await res.json()
    if (typeof e.detail === 'string') {
      detail = e.detail
    } else if (Array.isArray(e.detail)) {
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
  const payload = {
    project_id: projectId,
    name,
    reference_audio_base64: audioBase64,
    reference_text: referenceText,
    duration_sec: durationSec,
  }
  const res = await fetch(`${AGENTS_API_URL}/studia/voix/cloner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
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

// --- Agent IMAGE FLUX (Phase 4b backend - FLUX.1-dev via RunPod ComfyUI) ---

async function genererImageFLUX({ projectId, prompt, width, height, steps, seed }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const payload = {
    project_id: projectId,
    prompt,
    width: width || 1024,
    height: height || 1024,
    steps: steps || 20,
  }
  if (seed !== undefined && seed !== null) payload.seed = seed
  const res = await fetch(`${AGENTS_API_URL}/studia/image/generer-flux`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

async function transformerImageFLUX({ projectId, prompt, photoBase64, denoise, steps, seed }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const payload = {
    project_id: projectId,
    prompt,
    photo_base64: photoBase64,
    denoise: denoise !== undefined ? denoise : 0.75,
    steps: steps || 20,
  }
  if (seed !== undefined && seed !== null) payload.seed = seed
  const res = await fetch(`${AGENTS_API_URL}/studia/image/transformer-flux`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
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
  if (temperature !== undefined && temperature !== null) payload.temperature = temperature
  if (topP !== undefined && topP !== null) payload.top_p = topP
  if (repetitionPenalty !== undefined && repetitionPenalty !== null) payload.repetition_penalty = repetitionPenalty
  const res = await fetch(`${AGENTS_API_URL}/studia/voix/generer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}
// --- Agent VIDEO FAL.AI (Phase 6bis backend - Seedance via fal.ai) ---

async function listVideoModels() {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const res = await fetch(`${AGENTS_API_URL}/studia/video/models`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

async function generateVideoFal({ mode, modelId, resolution, prompt, durationSeconds, aspectRatio, projectId, imageBase64 }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const payload = {
    mode,
    model_id: modelId,
    resolution,
    prompt,
    duration_seconds: durationSeconds,
    aspect_ratio: aspectRatio,
    project_id: projectId,
  }
  if (imageBase64) {
    payload.image_base64 = imageBase64
  }
  const res = await fetch(`${AGENTS_API_URL}/studia/video/generer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  const data = await res.json()
  // v6 : la reponse inclut polling_namespace, on le retourne tel quel pour que le frontend le passe a /status
  return data
}

async function checkVideoStatus({ requestId, modelId, pollingNamespace }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable.')
  const params = new URLSearchParams({ model_id: modelId })
  if (pollingNamespace) {
    params.set('polling_namespace', pollingNamespace)
  }
  const res = await fetch(`${AGENTS_API_URL}/studia/video/status/${requestId}?${params.toString()}`, {
    method: 'GET',
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}
// --- Agent TRANSCRIPT YouTube ---

async function extraireTranscriptYoutube({ url, languesPreferes }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  const res = await fetch(`${AGENTS_API_URL}/transcript/extraire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      url,
      langues_preferees: languesPreferes || ['fr', 'en'],
    }),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json()
}

async function analyserTranscript({ texte, titre, auteur, openaiApiKey, modele }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) throw new Error('Cle Agents Doppler introuvable.')
  const res = await fetch(`${AGENTS_API_URL}/transcript/analyser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      texte,
      titre: titre || null,
      auteur: auteur || null,
      openai_api_key: openaiApiKey,
      modele: modele || 'gpt-4o',
    }),
  })
  if (!res.ok) throw new Error(await extractApiError(res))
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
  const [mode, setMode] = useState('choose')
  const [name, setName] = useState('')
  const [referenceText, setReferenceText] = useState('')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [originalFileName, setOriginalFileName] = useState(null)
  const [recordingState, setRecordingState] = useState('idle')
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
      const tempAudio = new Audio()
      tempAudio.src = url
      const dur = await new Promise((resolve) => {
        tempAudio.addEventListener('loadedmetadata', () => {
          resolve(isFinite(tempAudio.duration) ? tempAudio.duration : 30)
        })
        tempAudio.addEventListener('error', () => resolve(30))
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

// ── ONGLET 1 : VOIX ────────────────────────────────────────────────
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
    const cleaned = a.map(x => ({ ...x, _blobUrl: undefined }))
    localStorage.setItem(audiosKey, JSON.stringify(cleaned))
    setAudios(a)
  }

  const handleNewVoix = async ({ name, audioBlob, referenceText, duration, sourceType }) => {
    setShowRecModal(false)
    setCloning(true)
    setErrorMsg(null)
    try {
      setCloningStep('🔄 Conversion en WAV...')
      const wavBlob = await convertAudioBlobToWav(audioBlob)
      setCloningStep('📦 Encodage en base64...')
      const audioBase64 = await blobToBase64(wavBlob)
      if (audioBase64.length < 100) {
        throw new Error(`Audio trop court ou corrompu après conversion (${audioBase64.length} caractères base64).`)
      }
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

  const ensureBlobUrl = (a) => {
    if (a._blobUrl) return a._blobUrl
    if (a.audioBase64) {
      try {
        const url = base64ToAudioBlobUrl(a.audioBase64)
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
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 10, color: 'rgba(237,232,219,0.5)' }}>Top-p (créativité)</label>
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
          💡 Ta cle API est stockee <strong>uniquement sur ton PC</strong>. Elle n'est jamais envoyee sur les serveurs Doppler. Toutes les requetes vont <strong>directement</strong> de ton PC vers <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>api.openai.com</code>.
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

// ── ONGLET 2 : IMAGES (FLUX RunPod + GPT Image OpenAI BYOK) ──────
function TabImages({ project }) {
  const storageKey = `pilotage_studia_images_${project.id}`
  const [images, setImages] = useState(() => { try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : [] } catch { return [] } })

  const [engine, setEngine] = useState('flux')        // 'flux' | 'gpt'
  const [mode, setMode] = useState('generate')        // 'generate' | 'edit'
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')

  const [refImage, setRefImage] = useState(null)
  const fileInputRef = useRef(null)

  const [hasKey, setHasKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [usage, setUsage] = useState({ totalSpent: 0, generations: [] })

  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [hoverId, setHoverId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [filter, setFilter] = useState('all')

  // Drive OAuth
  const [showDriveModal, setShowDriveModal] = useState(false)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveAccount, setDriveAccount] = useState(null)
  const [uploadingDrive, setUploadingDrive] = useState({})

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

  const refreshDriveStatus = async () => {
    try {
      const cfg = await window.electronAPI.drive.isConfigured()
      if (!cfg) { setDriveConnected(false); setDriveAccount(null); return }
      const conn = await window.electronAPI.drive.isConnected()
      setDriveConnected(conn)
      if (conn) {
        const acc = await window.electronAPI.drive.getConnectedAccount()
        setDriveAccount(acc)
      } else {
        setDriveAccount(null)
      }
    } catch (err) {
      console.error('[Drive] refreshDriveStatus error:', err)
    }
  }

  useEffect(() => {
    refreshKeyAndUsage()
    refreshDriveStatus()
    try { setImages(JSON.parse(localStorage.getItem(storageKey)) || []) } catch { setImages([]) }
  }, [project.id])

  const persist = (arr) => { localStorage.setItem(storageKey, JSON.stringify(arr)); setImages(arr) }

  const uploadVersDrive = async (img) => {
    if (!driveConnected) {
      setShowDriveModal(true)
      return
    }
    setUploadingDrive(prev => ({ ...prev, [img.id]: true }))
    try {
      let contentBase64 = null
      if (img.dataUrl) {
        contentBase64 = img.dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
      } else if (img.fileUrl) {
        const response = await fetch(img.fileUrl)
        const blob = await response.blob()
        contentBase64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result.split(',')[1])
          reader.readAsDataURL(blob)
        })
      } else {
        throw new Error('Aucune source image disponible')
      }
      const date = new Date().toISOString().slice(0, 10)
      const promptSlug = slugify(img.prompt.slice(0, 40))
      const filename = `${date}_${promptSlug}_${img.id}.png`
      const folderPath = ['Pilot', project.id, "Stud'IA", 'Images']
      const result = await window.electronAPI.drive.uploadFile({
        folderPath,
        filename,
        contentBase64,
        mimeType: 'image/png',
      })
      if (result.success) {
        showSuccess(`☁️ Uploade sur Drive : ${result.filename}`, 6000)
        const updated = images.map(i => i.id === img.id ? { ...i, driveUrl: result.webViewLink, driveFileId: result.fileId } : i)
        persist(updated)
      } else {
        showError(`❌ Erreur upload Drive : ${result.error}`)
      }
    } catch (err) {
      showError(`❌ Erreur upload : ${err.message}`)
    }
    setUploadingDrive(prev => {
      const copy = { ...prev }
      delete copy[img.id]
      return copy
    })
  }

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
    if (mode === 'edit' && !refImage) {
      showError('En mode "Image + Texte", upload d\'abord une image de reference.')
      return
    }
    if (engine === 'gpt' && !hasKey) {
      setShowKeyModal(true)
      return
    }

    setGenerating(true)
    setErrorMsg(null)

    try {
      // ===== ENGINE = GPT IMAGE (OpenAI direct via Electron) =====
      if (engine === 'gpt') {
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
            dataUrl: result.dataUrl,
            filename: result.filename,
            cost: result.cost,
            refImageName: mode === 'edit' ? refImage?.name : null,
            createdAt: new Date().toISOString(),
          }
          persist([newImg, ...images].slice(0, 100))
          setUsage(prev => ({ ...prev, totalSpent: result.totalSpent }))
          showSuccess(`✨ Image generee · cout ${result.cost.toFixed(2)}$ · total ${result.totalSpent.toFixed(2)}$`)
        }
      }

      // ===== ENGINE = FLUX (RunPod via VPS Python) =====
      else if (engine === 'flux') {
        const [w, h] = size.split('x').map(s => parseInt(s, 10))

        let result
        if (mode === 'edit') {
          const photoB64 = refImage.dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
          result = await transformerImageFLUX({
            projectId: project.id,
            prompt: prompt.trim(),
            photoBase64: photoB64,
            denoise: 0.75,
            steps: 20,
          })
        } else {
          result = await genererImageFLUX({
            projectId: project.id,
            prompt: prompt.trim(),
            width: w,
            height: h,
            steps: 20,
          })
        }

        const dataUrl = `data:image/${result.format};base64,${result.image_base64}`
        const newImg = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          prompt: prompt.trim(),
          mode,
          engine: 'flux',
          size: `${result.width}x${result.height}`,
          fileUrl: null,
          dataUrl,
          filename: null,
          cost: result.cost_estime,
          refImageName: mode === 'edit' ? refImage?.name : null,
          createdAt: new Date().toISOString(),
        }
        persist([newImg, ...images].slice(0, 100))
        showSuccess(`⚡ FLUX image generee · cout ~${result.cost_estime.toFixed(3)}$ (RunPod)`)
      }
    } catch (err) {
      if (err.message.includes('timeout') || err.message.includes('504')) {
        showError(`⏱️ Premier appel a froid trop long (RunPod cold boot). Reessaie : la 2eme tentative est rapide (~10s).`, 10000)
      } else {
        showError(`❌ Erreur : ${err.message}`)
      }
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

  // Cout estime affiche selon engine
  const coutEstime = engine === 'flux' ? 0.015 : (mode === 'edit' ? 0.06 : 0.04)

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
      {showDriveModal && (
        <DriveModal
          onClose={() => setShowDriveModal(false)}
          onChanged={refreshDriveStatus}
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

        {/* ═══ TOGGLE MOTEUR FLUX / GPT IMAGE ═══ */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Moteur de generation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => setEngine('flux')}
              style={{
                padding: '14px 12px', borderRadius: 12,
                border: `1px solid ${engine === 'flux' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`,
                background: engine === 'flux' ? `${STUDIA_COLOR}20` : 'rgba(255,255,255,0.02)',
                color: engine === 'flux' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20 }}>⚡</div>
              <div>FLUX.1 Dev</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>~0.015$ · Open source</div>
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
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>~{(mode === 'edit' ? 0.06 : 0.04).toFixed(2)}$ · Premium</div>
            </button>
          </div>

          {/* Stats credits/conso (visibles uniquement pour GPT) */}
          {engine === 'gpt' && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
              <span style={{ color: 'rgba(237,232,219,0.5)' }}>
                💰 OpenAI conso cumulee Pilot : <strong style={{ color: STUDIA_COLOR }}>{usage.totalSpent.toFixed(2)}$</strong>
                {' · '}
                <span style={{ color: 'rgba(237,232,219,0.4)' }}>{usage.generations?.length || 0} images</span>
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hasKey ? (
                  <button onClick={() => setShowKeyModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.6)', fontSize: 10, cursor: 'pointer' }} title="Modifier la cle OpenAI">
                    🔑 OpenAI ✓
                  </button>
                ) : (
                  <button onClick={() => setShowKeyModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${STUDIA_COLOR}`, background: `${STUDIA_COLOR}20`, color: STUDIA_COLOR, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🔑 Configurer OpenAI
                  </button>
                )}
                <button onClick={() => setShowDriveModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: driveConnected ? '1px solid rgba(91,199,138,0.3)' : '1px solid rgba(255,255,255,0.1)', background: driveConnected ? 'rgba(91,199,138,0.08)' : 'transparent', color: driveConnected ? '#5BC78A' : 'rgba(237,232,219,0.6)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }} title={driveConnected ? `Drive : ${driveAccount?.email}` : 'Configurer Google Drive'}>
                  {driveConnected ? '☁️ Drive ✓' : '☁️ Drive'}
                </button>
                <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 10, cursor: 'pointer', textDecoration: 'none' }}>
                  Solde OpenAI ↗
                </a>
              </div>
            </div>
          )}
          {engine === 'flux' && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'rgba(237,232,219,0.5)' }}>
              <span style={{ flex: 1, minWidth: 200 }}>
                ⚡ FLUX tourne sur RunPod (GPU a la demande). 1er appel cold boot ~60-180s, puis ~5-15s. Suivi conso : <a href="https://console.runpod.io" target="_blank" rel="noopener noreferrer" style={{ color: STUDIA_COLOR }}>console.runpod.io</a>
              </span>
              <button onClick={() => setShowDriveModal(true)} style={{ padding: '4px 10px', borderRadius: 6, border: driveConnected ? '1px solid rgba(91,199,138,0.3)' : '1px solid rgba(255,255,255,0.1)', background: driveConnected ? 'rgba(91,199,138,0.08)' : 'transparent', color: driveConnected ? '#5BC78A' : 'rgba(237,232,219,0.6)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }} title={driveConnected ? `Drive : ${driveAccount?.email}` : 'Configurer Google Drive'}>
                {driveConnected ? '☁️ Drive ✓' : '☁️ Drive'}
              </button>
            </div>
          )}
        </div>

        {/* ═══ FORMULAIRE GENERATION ═══ */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎨 Generer une image</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 8 }}>Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setMode('generate')} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${mode === 'generate' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: mode === 'generate' ? `${STUDIA_COLOR}20` : 'transparent', color: mode === 'generate' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 11 }}>📝 Texte → Image</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>Prompt seul</div>
              </button>
              <button onClick={() => setMode('edit')} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${mode === 'edit' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: mode === 'edit' ? `${STUDIA_COLOR}20` : 'transparent', color: mode === 'edit' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 11 }}>📷 Image + Texte → Image</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>Transformer une photo</div>
              </button>
            </div>
          </div>

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
                ? 'Ex: Transforme en super-heros, change le fond en plage tropicale...'
                : 'Ex: Un homme au bureau face a une fenetre, lumiere doree du matin...'
              }
              rows={4}
              style={{ ...iS, resize: 'vertical', borderColor: tooLong ? 'rgba(199,91,78,0.4)' : 'rgba(255,255,255,0.1)' }}
              disabled={generating}
            />
          </div>

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
              ? `⏳ Generation en cours (${engine === 'flux' ? '30-180s' : '15-40s'})...`
              : `${engine === 'flux' ? '⚡' : '⭐'} ${mode === 'edit' ? 'Transformer l\'image' : 'Generer l\'image'} · ~${coutEstime.toFixed(engine === 'flux' ? 3 : 2)}$`
            }
          </button>
          {engine === 'gpt' && !hasKey && (
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
                const engineLabel = img.engine === 'flux' ? '⚡ FLUX' : '⭐ GPT'
                return (
                  <div key={img.id} onMouseEnter={() => setHoverId(img.id)} onMouseLeave={() => setHoverId(null)} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', aspectRatio: ratio, cursor: 'pointer' }}>
                    <img src={img.dataUrl || img.fileUrl} alt={img.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(0,0,0,0.7)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{modeLabel}</span>
                      <span style={{ background: 'rgba(0,0,0,0.7)', color: STUDIA_COLOR, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{engineLabel}</span>
                      {img.cost && <span style={{ background: 'rgba(0,0,0,0.7)', color: '#5BC78A', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{img.cost.toFixed(img.cost < 0.1 ? 3 : 2)}$</span>}
                    </div>
                    {isHover && (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, gap: 8 }}>
                        <p style={{ fontSize: 10, color: '#EDE8DB', margin: 0, lineHeight: 1.4, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.prompt}</p>
                        {img.refImageName && <p style={{ fontSize: 9, color: 'rgba(237,232,219,0.5)', margin: 0, fontStyle: 'italic' }}>📷 Ref: {img.refImageName}</p>}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {img.fileUrl && <button onClick={() => window.electronAPI.studia.openImage(img.fileUrl)} title="Ouvrir l'image" style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🖼️</button>}
                          <button onClick={() => telecharger(img)} title="Telecharger" style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: STUDIA_COLOR, color: '#0D1B2A', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>📥</button>
                          <button onClick={() => uploadVersDrive(img)} disabled={uploadingDrive[img.id]} title={img.driveUrl ? `Deja sur Drive : ${img.driveUrl}` : 'Uploader sur Google Drive'} style={{ flex: 1, padding: '6px', borderRadius: 6, border: img.driveUrl ? '1px solid rgba(91,199,138,0.4)' : '1px solid rgba(255,255,255,0.2)', background: img.driveUrl ? 'rgba(91,199,138,0.2)' : 'rgba(255,255,255,0.1)', color: img.driveUrl ? '#5BC78A' : '#EDE8DB', fontSize: 10, fontWeight: 700, cursor: uploadingDrive[img.id] ? 'wait' : 'pointer', opacity: uploadingDrive[img.id] ? 0.5 : 1 }}>{uploadingDrive[img.id] ? '⏳' : (img.driveUrl ? '☁️✓' : '☁️')}</button>
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
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex: La voix sonne trop monotone ici. Donne plus d'émotion." rows={5} style={{ ...iS, resize: 'vertical', marginBottom: 14 }} autoFocus />
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
      showError('Clé Agents Doppler introuvable dans le Coffre-fort.')
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
                <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Titre *</label>
                <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Pourquoi Pierucci..." style={iS} disabled={generating} />
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
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Sujet *</label>
              <textarea value={sujet} onChange={e => setSujet(e.target.value)} placeholder="Décris en 2-3 phrases le sujet de ta vidéo." rows={3} style={{ ...iS, resize: 'vertical' }} disabled={generating} />
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
                ⚠️ Aucune voix prête. Va dans l'onglet "Clone IA voix".
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
                <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', margin: 0 }}>Sélectionne un script ou génère-en un nouveau</p>
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
                      {STYLES_VIDEO.find(s => s.val === activeScript.style)?.label} · 🎤 {activeScript.voix_name || '?'} · {activeScript.duree_cible_min} min · {currentScenes.length} scènes
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
                  {currentScenes.length} scènes · {fmtTime(currentScenes.reduce((acc, s) => acc + (s.duree_sec || 0), 0))}
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
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Scripts {scripts.length > 0 && `(${scripts.length})`}</h3>
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
                        <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginTop: 2 }}>{STYLES_VIDEO.find(x => x.val === s.style)?.emoji} {s.duree_cible_min} min · 📜 {sceneCount}</div>
                        {annotCount > 0 && <div style={{ fontSize: 9, color: '#D4A853', marginTop: 3 }}>📌 {annotCount}</div>}
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
              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 14, lineHeight: 1.5 }}>Pause la vidéo et clique sur "📌 Annoter ici".</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {currentAnnots.map(a => {
                  const statusColor = a.status === 'fixed' ? '#5BC78A' : a.status === 'pending_fix' ? '#D4A853' : 'rgba(237,232,219,0.5)'
                  const statusLabel = a.status === 'fixed' ? '✅ Corrigé' : a.status === 'pending_fix' ? '⏳ Correction...' : '🕒 En attente'
                  return (
                    <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <button onClick={() => seekTo(a.timestamp)} title="Aller à ce moment" style={{ background: `${STUDIA_COLOR}20`, border: 'none', borderRadius: 6, padding: '2px 8px', color: STUDIA_COLOR, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' }}>▶ {fmtTime(a.timestamp)}</button>
                        <button onClick={() => supprimerAnnotation(a.id)} style={{ padding: '2px 6px', borderRadius: 5, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.7)', margin: '0 0 8px', lineHeight: 1.4 }}>{a.comment}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
                        {a.status === 'pending' && <button onClick={() => renvoyerEnCorrection(a.id)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${STUDIA_COLOR}40`, background: 'transparent', color: STUDIA_COLOR, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>🔄 Renvoyer</button>}
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

// ── ONGLET 4 : SHORTS (Phase 6quater - multi-modeles fal.ai) ──────────
function TabShorts({ project }) {
  const shortsKey = `pilotage_studia_shorts_${project.id}`
  const [shorts, setShorts] = useState(() => { try { return JSON.parse(localStorage.getItem(shortsKey)) || [] } catch { return [] } })

  // Toggle 3 modes
  const [mode, setMode] = useState('eco')
  // Toggle T2V / I2V
  const [videoType, setVideoType] = useState('t2v')
  // Modele selectionne dans le mode + type courant
  const [selectedModelId, setSelectedModelId] = useState(null)

  const [models, setModels] = useState(null)
  const [loadingModels, setLoadingModels] = useState(true)

  // Form
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState(5)

  // I2V upload
  const [refImage, setRefImage] = useState(null)
  const fileInputRef = useRef(null)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState(null)
  const [genElapsed, setGenElapsed] = useState(0)
  const pollIntervalRef = useRef(null)
  const elapsedIntervalRef = useRef(null)

  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const showError = (msg, dur = 8000) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), dur) }
  const showSuccess = (msg, dur = 5000) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), dur) }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const cat = await listVideoModels()
        if (!cancelled) setModels(cat)
      } catch (err) {
        if (!cancelled) showError(`Impossible de charger le catalogue : ${err.message}`)
      }
      if (!cancelled) setLoadingModels(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    try { setShorts(JSON.parse(localStorage.getItem(shortsKey)) || []) } catch { setShorts([]) }
  }, [project.id])

  // Reset du modele selectionne quand on change de mode ou de type
  useEffect(() => {
    if (!models) return
    const available = models[mode]?.[videoType] || []
    const defaultModel = available.find(m => m.default) || available[0]
    if (defaultModel) {
      setSelectedModelId(defaultModel.id)
    }
  }, [mode, videoType, models])

  useEffect(() => () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
  }, [])

  const persist = (arr) => { localStorage.setItem(shortsKey, JSON.stringify(arr)); setShorts(arr) }

  // Liste des modeles disponibles pour mode + type courants
  const availableModels = models?.[mode]?.[videoType] || []
  // Modele actuellement selectionne (peut etre null brievement avant le useEffect)
  const currentModel = availableModels.find(m => m.id === selectedModelId) || availableModels.find(m => m.default) || availableModels[0]

  // ── Upload image (I2V) ─────────────────────────────────────────────
  const handleImageSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showError('Le fichier doit etre une image (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showError(`Image trop grosse (${(file.size / 1024 / 1024).toFixed(1)} Mo). Max 10 Mo.`)
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setRefImage({
        dataUrl,
        name: file.name,
        sizeKB: Math.round(file.size / 1024),
      })
    } catch (err) {
      showError(`Erreur lecture image : ${err.message}`)
    }
  }

  const removeRefImage = () => {
    setRefImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Generation ─────────────────────────────────────────────────────
  const generer = async () => {
    if (!prompt.trim() || generating || !currentModel) return
    if (prompt.trim().length < 10) {
      showError('Le prompt doit faire au moins 10 caracteres.')
      return
    }
    if (videoType === 'i2v' && !refImage) {
      showError('En mode Image-to-Video, upload d\'abord une image de reference.')
      return
    }

    setGenerating(true)
    setGenStatus('queued')
    setGenElapsed(0)
    setErrorMsg(null)

    elapsedIntervalRef.current = setInterval(() => setGenElapsed(e => e + 1), 1000)

    try {
      const payload = {
        mode,
        modelId: currentModel.id,
        resolution: currentModel.resolution,
        prompt: prompt.trim(),
        durationSeconds: duration,
        aspectRatio,
        projectId: project.id,
      }
      if (videoType === 'i2v' && refImage) {
        payload.imageBase64 = refImage.dataUrl
      }

      const submitResult = await generateVideoFal(payload)
      const requestId = submitResult.request_id
      const estimatedCost = submitResult.estimated_cost_usd
      const pollingNamespace = submitResult.polling_namespace  // v6 : explicite

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await checkVideoStatus({
            requestId,
            modelId: currentModel.id,
            pollingNamespace,
          })

          if (statusRes.status === 'IN_PROGRESS') {
            setGenStatus('in_progress')
          } else if (statusRes.status === 'COMPLETED' && statusRes.video_url) {
            clearInterval(pollIntervalRef.current)
            clearInterval(elapsedIntervalRef.current)
            pollIntervalRef.current = null
            elapsedIntervalRef.current = null

            const newShort = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              requestId,
              prompt: prompt.trim(),
              mode,
              videoType,
              modelName: currentModel.name,
              modelId: currentModel.id,
              provider: currentModel.provider,
              resolution: currentModel.resolution,
              aspectRatio,
              duration,
              cost: estimatedCost,
              videoUrl: statusRes.video_url,
              refImageName: videoType === 'i2v' && refImage ? refImage.name : null,
              createdAt: new Date().toISOString(),
            }
            persist([newShort, ...shorts].slice(0, 20))
            showSuccess(`🎬 Video ${videoType.toUpperCase()} generee via ${currentModel.provider} - cout reel ~${estimatedCost.toFixed(2)}$`)
            setGenerating(false)
            setGenStatus(null)
            setPrompt('')
            if (videoType === 'i2v') removeRefImage()
          } else if (statusRes.status === 'FAILED') {
            clearInterval(pollIntervalRef.current)
            clearInterval(elapsedIntervalRef.current)
            pollIntervalRef.current = null
            elapsedIntervalRef.current = null
            showError(`❌ Generation echouee : ${statusRes.error_message || 'erreur inconnue'}`)
            setGenerating(false)
            setGenStatus(null)
          }
        } catch (pollErr) {
          console.error('Erreur polling:', pollErr)
        }
      }, 3000)

    } catch (err) {
      showError(`❌ ${err.message}`)
      setGenerating(false)
      setGenStatus(null)
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
    }
  }

  const supprimer = (id) => {
    if (!confirm('Supprimer cette video ?')) return
    persist(shorts.filter(s => s.id !== id))
  }

  const peutGenerer = prompt.trim().length >= 10 && !generating && currentModel && (videoType === 't2v' || refImage)

  const modeColors = {
    eco: '#5BC78A',
    standard: '#D4A853',
    premium: '#C75B4E',
  }
  const modeLabels = {
    eco: '🟢 Eco',
    standard: '🟡 Standard',
    premium: '🔴 Premium',
  }
  const providerColors = {
    'ByteDance': '#FF6B6B',
    'Alibaba': '#FF9F2D',
    'Google': '#4285F4',
    'Kuaishou': '#FF4081',
    'OpenAI': '#10A37F',
  }

  if (loadingModels) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'rgba(237,232,219,0.4)', fontSize: 13 }}>⏳ Chargement du catalogue fal.ai...</div>
  }

  if (!models) {
    return <div style={{ background: 'rgba(199,91,78,0.06)', border: '1px solid rgba(199,91,78,0.2)', borderRadius: 12, padding: 24, textAlign: 'center', color: '#C75B4E', fontSize: 13 }}>❌ Impossible de charger le catalogue. Verifie que la cle Agents Doppler est dans le Coffre-fort.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {errorMsg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', fontSize: 12, color: '#C75B4E' }}>{errorMsg}</div>}
      {successMsg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', fontSize: 12, color: '#5BC78A' }}>{successMsg}</div>}

      <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'rgba(237,232,219,0.8)', lineHeight: 1.6 }}>
        🧪 <strong>Mode test video IA (Phase 6quater)</strong> — 9 modeles dispos via fal.ai : ByteDance, Alibaba, Google, Kuaishou, OpenAI. Choisis ton mode (Eco/Standard/Premium) puis le modele dans le menu deroulant.
      </div>

      {/* ═══ TOGGLE TYPE T2V / I2V ═══ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Type de generation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => { setVideoType('t2v'); removeRefImage() }}
            disabled={generating}
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: `1.5px solid ${videoType === 't2v' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`,
              background: videoType === 't2v' ? `${STUDIA_COLOR}20` : 'rgba(255,255,255,0.02)',
              color: videoType === 't2v' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)',
              fontSize: 12, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.5 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16 }}>📝 Texte → Video</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Decrire la scene en mots</div>
          </button>
          <button
            onClick={() => setVideoType('i2v')}
            disabled={generating}
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: `1.5px solid ${videoType === 'i2v' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`,
              background: videoType === 'i2v' ? `${STUDIA_COLOR}20` : 'rgba(255,255,255,0.02)',
              color: videoType === 'i2v' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)',
              fontSize: 12, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.5 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16 }}>📷 Image → Video</div>
            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Animer une image existante</div>
          </button>
        </div>
      </div>

      {/* ═══ TOGGLE 3 MODES ═══ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Choisis ton mode</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {['eco', 'standard', 'premium'].map(m => {
            const isActive = mode === m
            const c = modeColors[m]
            const modelsInMode = models[m]?.[videoType] || []
            const defaultModel = modelsInMode.find(x => x.default) || modelsInMode[0]
            if (!defaultModel) return null
            return (
              <button key={m} onClick={() => setMode(m)} disabled={generating} style={{ padding: '14px 12px', borderRadius: 12, border: `1.5px solid ${isActive ? c : 'rgba(255,255,255,0.1)'}`, background: isActive ? `${c}20` : 'rgba(255,255,255,0.02)', color: isActive ? c : 'rgba(237,232,219,0.5)', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: generating ? 0.5 : 1, textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16 }}>{modeLabels[m]}</div>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{modelsInMode.length} modele{modelsInMode.length > 1 ? 's' : ''}</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.6, lineHeight: 1.3 }}>Defaut: {defaultModel.resolution} ~{defaultModel.price_per_5s_usd.toFixed(2)}$/5s</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ SELECTEUR DE MODELE (Phase 6quater) ═══ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          🤖 Modele {modeLabels[mode]} · {videoType === 't2v' ? 'Texte→Video' : 'Image→Video'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {availableModels.map(m => {
            const isSelected = m.id === selectedModelId
            const providerColor = providerColors[m.provider] || STUDIA_COLOR
            return (
              <button
                key={m.id + '_' + m.resolution}
                onClick={() => setSelectedModelId(m.id)}
                disabled={generating}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${isSelected ? providerColor : 'rgba(255,255,255,0.08)'}`,
                  background: isSelected ? `${providerColor}15` : 'rgba(0,0,0,0.15)',
                  color: '#EDE8DB',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isSelected ? providerColor : 'rgba(255,255,255,0.15)',
                    flexShrink: 0,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? providerColor : '#EDE8DB' }}>{m.name}</span>
                      {m.default && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${providerColor}25`, color: providerColor, fontWeight: 700 }}>RECOMMANDE</span>}
                      {m.supports_audio && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,199,138,0.15)', color: '#5BC78A', fontWeight: 700 }}>🔊 AUDIO</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: providerColor }}>~{m.price_per_5s_usd.toFixed(2)}$ / 5s</span>
                  <span style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>{m.provider}</span>
                </div>
              </button>
            )
          })}
        </div>
        {availableModels.length === 0 && <div style={{ padding: 14, textAlign: 'center', fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Aucun modele disponible pour cette combinaison.</div>}
      </div>

      {/* ═══ FORMULAIRE GENERATION ═══ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>
          {videoType === 't2v' ? '🎬 Generer une video depuis un texte' : '🎬 Animer une image en video'}
        </h3>

        {videoType === 'i2v' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>
              Image de reference <span style={{ color: '#C75B4E' }}>*</span>
              <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.3)', marginLeft: 8, fontWeight: 'normal' }}>(PNG, JPG, WEBP - max 10 Mo)</span>
            </label>
            {!refImage ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={generating}
                style={{
                  width: '100%', padding: '28px 14px', borderRadius: 10,
                  border: `1px dashed ${STUDIA_COLOR}60`,
                  background: `${STUDIA_COLOR}08`,
                  color: STUDIA_COLOR, fontSize: 12, fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 36 }}>📁</span>
                <span>Cliquer pour selectionner une image</span>
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>L'image sera animee selon ton prompt</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={refImage.dataUrl} alt="Reference" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${STUDIA_COLOR}40` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#EDE8DB', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refImage.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 4 }}>{refImage.sizeKB} Ko</div>
                  <div style={{ fontSize: 10, color: '#5BC78A', marginTop: 2 }}>✅ Image prete a animer</div>
                </div>
                <button onClick={removeRefImage} disabled={generating} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.3)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 11, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>✕ Retirer</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageSelected} style={{ display: 'none' }} />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>
              {videoType === 't2v' ? 'Prompt video' : 'Comment animer cette image ?'}
            </label>
            <span style={{ fontSize: 10, color: prompt.length > 2000 ? '#C75B4E' : 'rgba(237,232,219,0.4)' }}>{prompt.length} / 2000</span>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value.slice(0, 2000))}
            placeholder={videoType === 't2v'
              ? 'Ex: Un chat errant marche lentement dans une rue calme, lumiere de fin d\'apres-midi, cinematique, photorealiste'
              : 'Ex: Le personnage tourne lentement la tete et regarde la camera, mouvement fluide'
            }
            rows={4}
            style={{ ...iS, resize: 'vertical' }}
            disabled={generating}
          />
          {prompt.length > 0 && prompt.length < 10 && <div style={{ fontSize: 10, color: '#C75B4E', marginTop: 4 }}>Encore {10 - prompt.length} caracteres minimum.</div>}
        </div>

        {videoType === 't2v' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 6 }}>Format</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setAspectRatio('9:16')} disabled={generating} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${aspectRatio === '9:16' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: aspectRatio === '9:16' ? `${STUDIA_COLOR}20` : 'transparent', color: aspectRatio === '9:16' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>📱 9:16</button>
                <button onClick={() => setAspectRatio('16:9')} disabled={generating} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${aspectRatio === '16:9' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: aspectRatio === '16:9' ? `${STUDIA_COLOR}20` : 'transparent', color: aspectRatio === '16:9' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>🖥️ 16:9</button>
                <button onClick={() => setAspectRatio('1:1')} disabled={generating} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${aspectRatio === '1:1' ? STUDIA_COLOR : 'rgba(255,255,255,0.1)'}`, background: aspectRatio === '1:1' ? `${STUDIA_COLOR}20` : 'transparent', color: aspectRatio === '1:1' ? STUDIA_COLOR : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer' }}>⬛ 1:1</button>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Duree</label>
                <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{duration}s</span>
              </div>
              <input type="range" min="3" max="10" step="1" value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
            </div>
          </div>
        )}

        {videoType === 'i2v' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)' }}>Duree de l'animation</label>
              <span style={{ fontSize: 11, color: STUDIA_COLOR, fontWeight: 700 }}>{duration}s</span>
            </div>
            <input type="range" min="3" max="10" step="1" value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={{ width: '100%', accentColor: STUDIA_COLOR }} disabled={generating} />
            <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginTop: 6, fontStyle: 'italic' }}>
              ℹ️ Le format de la video sera celui de l'image source.
            </div>
          </div>
        )}

        {currentModel && (
          <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: 'rgba(237,232,219,0.7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💰 Cout estime pour {duration}s · {currentModel.name}</span>
            <strong style={{ color: providerColors[currentModel.provider] || modeColors[mode] }}>~{(currentModel.price_per_5s_usd * duration / 5).toFixed(2)}$</strong>
          </div>
        )}

        <button onClick={generer} disabled={!peutGenerer} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: peutGenerer ? modeColors[mode] : `${modeColors[mode]}40`, color: '#0D1B2A', fontSize: 14, fontWeight: 800, cursor: peutGenerer ? 'pointer' : 'not-allowed' }}>
          {generating
            ? `⏳ Generation... ${genElapsed}s ${genStatus === 'queued' ? '(en queue)' : '(en cours)'}`
            : `🎬 Generer la video ${videoType === 'i2v' ? 'animee' : ''} via ${currentModel?.provider || '?'} (${modeLabels[mode]})`
          }
        </button>

        {generating && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 8, fontSize: 11, color: '#D4A853', textAlign: 'center' }}>
            ⏱️ Patience, fal.ai prend generalement 30-90 secondes pour generer une video courte.
          </div>
        )}
      </div>

      {/* ═══ GALERIE DES SHORTS ═══ */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📱 Mes videos {shorts.length > 0 && <span style={{ color: 'rgba(237,232,219,0.4)', fontWeight: 400 }}>({shorts.length})</span>}</h3>
        {shorts.length === 0 ? (
          <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
            <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)' }}>Aucune video generee pour ce projet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {shorts.map(s => {
              const c = modeColors[s.mode] || STUDIA_COLOR
              const pc = providerColors[s.provider] || c
              const aspectStyle = s.aspectRatio === '9:16' ? '9 / 16' : s.aspectRatio === '16:9' ? '16 / 9' : '1 / 1'
              const typeLabel = s.videoType === 'i2v' ? '📷 I2V' : '📝 T2V'
              return (
                <div key={s.id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', aspectRatio: aspectStyle, background: '#000' }}>
                    <video src={s.videoUrl} controls style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
                    <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(0,0,0,0.75)', color: c, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>{modeLabels[s.mode]}</span>
                      <span style={{ background: 'rgba(0,0,0,0.75)', color: STUDIA_COLOR, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{typeLabel}</span>
                      {s.provider && <span style={{ background: 'rgba(0,0,0,0.75)', color: pc, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{s.provider}</span>}
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', color: '#EDE8DB', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{s.resolution} · {s.duration}s</div>
                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.75)', color: '#5BC78A', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{s.cost.toFixed(2)}$</div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <p style={{ fontSize: 11, color: '#EDE8DB', margin: '0 0 8px', lineHeight: 1.4, maxHeight: 50, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.prompt}</p>
                    {s.refImageName && <p style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px', fontStyle: 'italic' }}>📷 Source : {s.refImageName}</p>}
                    <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginBottom: 8 }}>{s.modelName}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={s.videoUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${STUDIA_COLOR}40`, background: `${STUDIA_COLOR}10`, color: STUDIA_COLOR, fontSize: 10, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>📥 Ouvrir</a>
                      <button onClick={() => supprimer(s.id)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(199,91,78,0.3)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🗑️ Supprimer</button>
                    </div>
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
// ── ONGLET 5 : YOUTUBE TRANSCRIPT ─────────────────────────────────
function TabTranscript({ project }) {
  const storageKey = `pilotage_studia_transcripts_${project.id}`

  // Etat
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey)) || [] } catch { return [] } })
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState(null)
  const [currentAnalyse, setCurrentAnalyse] = useState(null)
  const [activeView, setActiveView] = useState('texte')
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [showSegments, setShowSegments] = useState(false)

  const [hasOpenAIKey, setHasOpenAIKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)

  const showError = (msg, dur = 8000) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), dur) }
  const showSuccess = (msg, dur = 4000) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), dur) }

  const refreshKey = async () => {
    try {
      const has = await window.electronAPI.studia.hasOpenAIKey()
      setHasOpenAIKey(has)
    } catch (err) {
      console.error('refreshKey:', err)
    }
    setKeyChecked(true)
  }

  useEffect(() => {
    refreshKey()
    try { setHistory(JSON.parse(localStorage.getItem(storageKey)) || []) } catch { setHistory([]) }
    setCurrentTranscript(null); setCurrentAnalyse(null)
  }, [project.id])

  const persist = (arr) => { localStorage.setItem(storageKey, JSON.stringify(arr)); setHistory(arr) }

  const extraire = async () => {
    if (!url.trim() || extracting) return
    setExtracting(true)
    setErrorMsg(null)
    setCurrentAnalyse(null)
    try {
      const result = await extraireTranscriptYoutube({
        url: url.trim(),
        languesPreferes: ['fr', 'en'],
      })
      const entry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        url: url.trim(),
        videoId: result.video_id,
        langue: result.langue,
        estAutoGeneree: result.est_auto_generee,
        dureeSec: result.duree_totale,
        nbSegments: result.nb_segments,
        texteComplet: result.texte_complet,
        segments: result.segments,
        analyse: null,
        createdAt: new Date().toISOString(),
      }
      setCurrentTranscript(entry)
      persist([entry, ...history].slice(0, 30))
      showSuccess(`📜 Transcript extrait : ${result.nb_segments} segments, ${fmtTime(result.duree_totale)}`)
    } catch (err) {
      showError(`❌ ${err.message}`)
    }
    setExtracting(false)
  }

 const analyser = async () => {
    if (!currentTranscript || analyzing) return
    if (!hasOpenAIKey) {
      setShowKeyModal(true)
      return
    }
    setAnalyzing(true)
    setErrorMsg(null)
    try {
      const result = await window.electronAPI.studia.analyzeTranscript({
        texte: currentTranscript.texteComplet,
        titre: null,
        auteur: null,
        modele: 'gpt-4o',
      })
      if (!result.success) {
        showError(`❌ ${result.error || 'Erreur inconnue'}`)
        setAnalyzing(false)
        return
      }
      setCurrentAnalyse(result)
      setActiveView('analyse')
      const updated = history.map(h => h.id === currentTranscript.id ? { ...h, analyse: result } : h)
      persist(updated)
      setCurrentTranscript({ ...currentTranscript, analyse: result })
      showSuccess(`✨ Analyse complete - cout ${result.cout_estime_eur.toFixed(4)}€`)
    } catch (err) {
      showError(`❌ Analyse echouee : ${err.message}`)
    }
    setAnalyzing(false)
  }

  const supprimer = (id) => {
    if (!confirm('Supprimer ce transcript ?')) return
    persist(history.filter(h => h.id !== id))
    if (currentTranscript?.id === id) {
      setCurrentTranscript(null)
      setCurrentAnalyse(null)
    }
  }

  const charger = (entry) => {
    setCurrentTranscript(entry)
    setCurrentAnalyse(entry.analyse || null)
    setActiveView(entry.analyse ? 'analyse' : 'texte')
  }

  const copierTexte = () => {
    if (!currentTranscript) return
    navigator.clipboard.writeText(currentTranscript.texteComplet)
    showSuccess('📋 Texte copie dans le presse-papier')
  }

  const exporter = () => {
    if (!currentTranscript) return
    const lines = [
      `# Transcript YouTube`,
      `URL : https://www.youtube.com/watch?v=${currentTranscript.videoId}`,
      `Langue : ${currentTranscript.langue} ${currentTranscript.estAutoGeneree ? '(auto-genere)' : '(manuel)'}`,
      `Duree : ${fmtTime(currentTranscript.dureeSec)}`,
      `Segments : ${currentTranscript.nbSegments}`,
      ``,
      `## Texte complet`,
      ``,
      currentTranscript.texteComplet,
    ]
    if (currentAnalyse) {
      lines.push('', '## Analyse IA', '', '### Resume court', currentAnalyse.resume_court)
      lines.push('', '### Resume detaille', currentAnalyse.resume_detaille)
      lines.push('', '### Chapitres')
      currentAnalyse.chapitres.forEach((c, i) => {
        lines.push(`${i + 1}. **${c.titre}**${c.debut_approximatif ? ` (${c.debut_approximatif})` : ''} - ${c.description_courte}`)
      })
      lines.push('', '### Themes', currentAnalyse.themes.map(t => `- ${t}`).join('\n'))
      lines.push('', '### Sentiment', `${currentAnalyse.sentiment} - ${currentAnalyse.sentiment_description}`)
      lines.push('', '### Citations marquantes')
      currentAnalyse.citations_marquantes.forEach(c => lines.push(`> ${c}`))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const dataUrl = URL.createObjectURL(blob)
    downloadDataUrl(dataUrl, `transcript-${currentTranscript.videoId}-${currentTranscript.id}.md`)
    setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
  }

  const envoyerVers = (cible) => {
    if (!currentTranscript) return
    const payload = {
      type: 'transcript_youtube',
      videoId: currentTranscript.videoId,
      url: currentTranscript.url,
      texteComplet: currentTranscript.texteComplet,
      langue: currentTranscript.langue,
      dureeSec: currentTranscript.dureeSec,
      analyse: currentAnalyse,
      origin: 'studia_transcript',
      timestamp: new Date().toISOString(),
    }
    if (cible === 'contenu') {
      localStorage.setItem('pilot_transfer_to_contenu', JSON.stringify(payload))
      showSuccess('📨 Transcript pousse vers le module Contenu. Ouvre Contenu pour le voir.')
    } else if (cible === 'cinema') {
      localStorage.setItem('pilot_transfer_to_cinema', JSON.stringify(payload))
      showSuccess('🎬 Transcript pousse vers Studio Cinema (script).')
    } else if (cible === 'source') {
      localStorage.setItem('pilot_transfer_to_source', JSON.stringify(payload))
      showSuccess('📚 Transcript pousse vers le module Source (archive).')
    }
  }

  if (!keyChecked) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'rgba(237,232,219,0.4)' }}>⏳ Chargement...</div>
  }

  return (
    <>
      {showKeyModal && (
        <OpenAIKeyModal
          onClose={() => setShowKeyModal(false)}
          onSaved={() => { setShowKeyModal(false); refreshKey(); showSuccess('🔑 Cle API enregistree') }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {errorMsg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', fontSize: 12, color: '#C75B4E' }}>{errorMsg}</div>}
        {successMsg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', fontSize: 12, color: '#5BC78A' }}>{successMsg}</div>}

        <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'rgba(237,232,219,0.8)', lineHeight: 1.6 }}>
          📜 <strong>YouTube Transcript</strong> — Colle une URL YouTube pour extraire le transcript. Analyse IA premium via GPT-4o (resume + chapitres + themes + sentiment + citations). Stockage local uniquement.
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 12 }}>🔗 Extraire un transcript</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && url.trim()) extraire() }}
              placeholder="https://www.youtube.com/watch?v=..."
              style={iS}
              disabled={extracting}
            />
            <button
              onClick={extraire}
              disabled={!url.trim() || extracting}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: (!url.trim() || extracting) ? `${STUDIA_COLOR}40` : STUDIA_COLOR,
                color: '#0D1B2A', fontSize: 12, fontWeight: 800,
                cursor: (!url.trim() || extracting) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {extracting ? '⏳ Extraction...' : '📜 Extraire'}
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: 0 }}>
            Accepte : youtube.com/watch?v=ID, youtu.be/ID, /shorts/, /embed/. Priorite FR puis EN.
          </p>
        </div>

        {currentTranscript && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#EDE8DB', margin: '0 0 6px' }}>📜 Transcript actif</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
                  <span style={{ background: `${STUDIA_COLOR}15`, color: STUDIA_COLOR, padding: '3px 8px', borderRadius: 5, fontWeight: 700 }}>📺 {currentTranscript.videoId}</span>
                  <span style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(237,232,219,0.6)', padding: '3px 8px', borderRadius: 5 }}>{currentTranscript.langue.toUpperCase()} {currentTranscript.estAutoGeneree ? '(auto)' : '(manuel)'}</span>
                  <span style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(237,232,219,0.6)', padding: '3px 8px', borderRadius: 5 }}>⏱️ {fmtTime(currentTranscript.dureeSec)}</span>
                  <span style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(237,232,219,0.6)', padding: '3px 8px', borderRadius: 5 }}>{currentTranscript.nbSegments} segments</span>
                  <span style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(237,232,219,0.6)', padding: '3px 8px', borderRadius: 5 }}>{currentTranscript.texteComplet.length.toLocaleString('fr-FR')} caracteres</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={copierTexte} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.6)', fontSize: 10, cursor: 'pointer' }}>📋 Copier</button>
                <button onClick={exporter} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.6)', fontSize: 10, cursor: 'pointer' }}>💾 .md</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 0 }}>
              <button onClick={() => setActiveView('texte')} style={{ padding: '8px 14px', border: 'none', background: 'transparent', color: activeView === 'texte' ? STUDIA_COLOR : 'rgba(237,232,219,0.4)', fontSize: 12, fontWeight: activeView === 'texte' ? 700 : 500, cursor: 'pointer', borderBottom: activeView === 'texte' ? `2px solid ${STUDIA_COLOR}` : '2px solid transparent', marginBottom: -1 }}>📄 Texte brut</button>
              <button onClick={() => setActiveView('analyse')} style={{ padding: '8px 14px', border: 'none', background: 'transparent', color: activeView === 'analyse' ? STUDIA_COLOR : 'rgba(237,232,219,0.4)', fontSize: 12, fontWeight: activeView === 'analyse' ? 700 : 500, cursor: 'pointer', borderBottom: activeView === 'analyse' ? `2px solid ${STUDIA_COLOR}` : '2px solid transparent', marginBottom: -1 }}>✨ Analyse IA{currentAnalyse && ' ✓'}</button>
            </div>

            {activeView === 'texte' && (
              <>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 16, maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.85)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {currentTranscript.texteComplet}
                  </p>
                </div>

                <button
                  onClick={() => setShowSegments(!showSegments)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: showSegments ? 10 : 0, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{showSegments ? '▼' : '▶'} Segments avec timestamps ({currentTranscript.nbSegments})</span>
                  <span>{showSegments ? 'Replier' : 'Deplier'}</span>
                </button>

                {showSegments && (
                  <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 10, maxHeight: 280, overflowY: 'auto' }}>
                    {currentTranscript.segments.map((seg, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ fontSize: 10, color: STUDIA_COLOR, fontFamily: 'monospace', minWidth: 50, flexShrink: 0 }}>{fmtTime(seg.debut)}</span>
                        <span style={{ fontSize: 11, color: 'rgba(237,232,219,0.7)', lineHeight: 1.5 }}>{seg.texte}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeView === 'analyse' && (
              <>
                {!currentAnalyse ? (
                  <div style={{ background: 'rgba(127,119,221,0.05)', border: `1px dashed ${STUDIA_COLOR}40`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
                    <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.6)', marginBottom: 14 }}>
                      Analyse IA complete via GPT-4o
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
                      Resume court + resume detaille + chapitres + themes + sentiment + citations marquantes<br/>
                      Cout estime : ~0.02-0.05€ selon la longueur du transcript
                    </p>
                    <button
                      onClick={analyser}
                      disabled={analyzing}
                      style={{
                        padding: '12px 24px', borderRadius: 10, border: 'none',
                        background: analyzing ? `${STUDIA_COLOR}40` : STUDIA_COLOR,
                        color: '#0D1B2A', fontSize: 13, fontWeight: 800,
                        cursor: analyzing ? 'wait' : 'pointer',
                      }}
                    >
                      {analyzing ? '⏳ Analyse en cours (10-30s)...' : '✨ Analyser avec GPT-4o'}
                    </button>
                    {!hasOpenAIKey && (
                      <p style={{ fontSize: 10, color: '#D4A853', marginTop: 10 }}>⚠️ Cle OpenAI non configuree. Clique pour la configurer.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    <div style={{ background: 'rgba(127,119,221,0.06)', border: `1px solid ${STUDIA_COLOR}30`, borderRadius: 10, padding: 14 }}>
                      <h4 style={{ fontSize: 10, fontWeight: 700, color: STUDIA_COLOR, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>💡 Resume court</h4>
                      <p style={{ fontSize: 13, color: '#EDE8DB', margin: 0, lineHeight: 1.6 }}>{currentAnalyse.resume_court}</p>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>📋 Resume detaille</h4>
                      <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.85)', margin: 0, lineHeight: 1.7 }}>{currentAnalyse.resume_detaille}</p>
                    </div>

                    {currentAnalyse.chapitres && currentAnalyse.chapitres.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                        <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>📚 Chapitres ({currentAnalyse.chapitres.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {currentAnalyse.chapitres.map((c, i) => (
                            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 10px', borderLeft: `3px solid ${STUDIA_COLOR}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#EDE8DB' }}>{i + 1}. {c.titre}</span>
                                {c.debut_approximatif && <span style={{ fontSize: 10, color: STUDIA_COLOR, fontFamily: 'monospace', flexShrink: 0 }}>{c.debut_approximatif}</span>}
                              </div>
                              <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.6)', margin: 0, lineHeight: 1.5 }}>{c.description_courte}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentAnalyse.themes && currentAnalyse.themes.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                        <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>🏷️ Themes ({currentAnalyse.themes.length})</h4>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {currentAnalyse.themes.map((t, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 14, background: `${STUDIA_COLOR}15`, color: STUDIA_COLOR, fontWeight: 700, border: `1px solid ${STUDIA_COLOR}30` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>🎭 Sentiment general</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{currentAnalyse.sentiment === 'positif' ? '😊' : currentAnalyse.sentiment === 'negatif' ? '😟' : currentAnalyse.sentiment === 'mixte' ? '😐' : '🙂'}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: currentAnalyse.sentiment === 'positif' ? '#5BC78A' : currentAnalyse.sentiment === 'negatif' ? '#C75B4E' : currentAnalyse.sentiment === 'mixte' ? '#D4A853' : 'rgba(237,232,219,0.7)', textTransform: 'capitalize' }}>{currentAnalyse.sentiment}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.6)', margin: 0, lineHeight: 1.5 }}>{currentAnalyse.sentiment_description}</p>
                    </div>

                    {currentAnalyse.citations_marquantes && currentAnalyse.citations_marquantes.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                        <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>💬 Citations marquantes</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {currentAnalyse.citations_marquantes.map((c, i) => (
                            <blockquote key={i} style={{ margin: 0, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${STUDIA_COLOR}`, borderRadius: 4, fontSize: 12, fontStyle: 'italic', color: 'rgba(237,232,219,0.85)', lineHeight: 1.6 }}>"{c}"</blockquote>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 10, color: 'rgba(237,232,219,0.4)' }}>
                      💰 Cout reel : {currentAnalyse.cout_estime_eur.toFixed(4)}€ · {currentAnalyse.nb_tokens_utilises} tokens
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 14 }}>
              <h4 style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>📨 Envoyer vers un module</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={() => envoyerVers('contenu')} style={{ padding: '10px', borderRadius: 8, border: '1px solid rgba(127,119,221,0.3)', background: 'rgba(127,119,221,0.08)', color: STUDIA_COLOR, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  ✍️ Contenu<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>Pour repurposer en post</span>
                </button>
                <button onClick={() => envoyerVers('cinema')} style={{ padding: '10px', borderRadius: 8, border: '1px solid rgba(127,119,221,0.3)', background: 'rgba(127,119,221,0.08)', color: STUDIA_COLOR, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  🎬 Studio Cinema<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>Comme matiere a script</span>
                </button>
                <button onClick={() => envoyerVers('source')} style={{ padding: '10px', borderRadius: 8, border: '1px solid rgba(127,119,221,0.3)', background: 'rgba(127,119,221,0.08)', color: STUDIA_COLOR, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  📚 Source<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>Archiver en R2</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📚 Historique ({history.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {history.map(h => {
                const isActive = currentTranscript?.id === h.id
                return (
                  <div key={h.id} style={{ background: isActive ? `${STUDIA_COLOR}10` : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? STUDIA_COLOR : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => charger(h)}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? STUDIA_COLOR : '#EDE8DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📺 {h.videoId} · {fmtTime(h.dureeSec)} · {h.langue.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.texteComplet.slice(0, 100)}...
                      </div>
                      {h.analyse && <div style={{ fontSize: 9, color: '#5BC78A', marginTop: 3 }}>✨ Analyse IA disponible</div>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); supprimer(h.id) }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(237,232,219,0.3)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}



// ── BANNIERE TRANSFER REÇU DE SOURCE ────────────────────────────
function TransfertBanniere({ transfert, onVoir, onIgnorer }) {
  if (!transfert) return null
  const titreCourt = (transfert.titre || transfert.texte || 'Contenu').slice(0, 60)
  const isResultat = transfert.type === 'source_resultat'
  const isSurlignage = transfert.type === 'source_surlignage'
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 10,
      background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.35)',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0,
    }}>
      <span style={{ fontSize: 18 }}>📥</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#D4A853', margin: '0 0 2px' }}>
          Contenu reçu depuis Module Source
          {isResultat && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>📄 Résultat</span>}
          {isSurlignage && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>✨ Surlignage</span>}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.7)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isResultat && <strong>{titreCourt}</strong>}
          {isSurlignage && <em>"{titreCourt}..."</em>}
        </p>
      </div>
      <button onClick={onVoir} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#D4A853', color: '#0D1B2A', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        👁️ Voir
      </button>
      <button onClick={onIgnorer} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ✕ Ignorer
      </button>
    </div>
  )
}

// ── MODAL DETAIL TRANSFER ───────────────────────────────────────
function TransfertModal({ transfert, onClose, onTraite }) {
  if (!transfert) return null
  const isResultat = transfert.type === 'source_resultat'
  const isSurlignage = transfert.type === 'source_surlignage'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 600, padding: 26, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>
            📥 Contenu reçu de Source
          </h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 11, color: 'rgba(237,232,219,0.6)', lineHeight: 1.6 }}>
          Envoyé depuis le projet <strong style={{ color: '#D4A853' }}>{transfert.projet_id || '?'}</strong>
          {transfert.timestamp && <span> · {new Date(transfert.timestamp).toLocaleString('fr-FR')}</span>}
        </div>

        {isResultat && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Titre</label>
              <p style={{ fontSize: 14, color: '#EDE8DB', margin: 0, lineHeight: 1.5, fontWeight: 700 }}>{transfert.titre}</p>
            </div>
            {transfert.auteur && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Auteur</label>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.8)', margin: 0 }}>{transfert.auteur}</p>
              </div>
            )}
            {transfert.date_doc && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Date du document</label>
                <p style={{ fontSize: 13, color: 'rgba(237,232,219,0.8)', margin: 0 }}>{transfert.date_doc}</p>
              </div>
            )}
            {transfert.snippet && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Extrait</label>
                <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.7)', margin: 0, lineHeight: 1.6, fontStyle: 'italic', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>{transfert.snippet}</p>
              </div>
            )}
            {transfert.url && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Source originale</label>
                <a href={transfert.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7F77DD', wordBreak: 'break-all', textDecoration: 'none' }}>↗ {transfert.url}</a>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'rgba(237,232,219,0.6)', fontWeight: 700 }}>📂 {transfert.source || '?'}</span>
              {transfert.doi && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(91,199,138,0.1)', color: '#5BC78A', fontWeight: 700 }}>DOI {transfert.doi}</span>}
            </div>
          </>
        )}

        {isSurlignage && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Texte surligné</label>
              <p style={{ fontSize: 13, color: '#EDE8DB', margin: 0, lineHeight: 1.7, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontStyle: 'italic' }}>"{transfert.texte}"</p>
            </div>
            {transfert.document_titre && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Document source</label>
                <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.7)', margin: 0 }}>
                  {transfert.document_titre}
                  {transfert.document_auteur && <span> — {transfert.document_auteur}</span>}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {transfert.couleur && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'rgba(237,232,219,0.6)', fontWeight: 700 }}>🎨 {transfert.couleur}</span>}
              {transfert.theme && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(127,119,221,0.15)', color: '#7F77DD', fontWeight: 700 }}>#{transfert.theme}</span>}
            </div>
          </>
        )}

        <div style={{ background: 'rgba(127,119,221,0.06)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 8, padding: 12, marginTop: 18, fontSize: 11, color: 'rgba(237,232,219,0.6)', lineHeight: 1.6 }}>
          💡 <strong>Tip :</strong> Copie le texte ou le titre ci-dessus et utilise-le dans l'onglet de ton choix (Voix, Images, Cinéma, Shorts ou Transcript). Une fois traité, clique sur "Marquer comme traité" pour faire disparaître la bannière.
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => {
            const texteACopier = isResultat
              ? `${transfert.titre}${transfert.auteur ? ' — ' + transfert.auteur : ''}${transfert.date_doc ? ' (' + transfert.date_doc + ')' : ''}${transfert.snippet ? '\n\n' + transfert.snippet : ''}${transfert.url ? '\n\nSource : ' + transfert.url : ''}`
              : `"${transfert.texte}"${transfert.document_titre ? '\n\n— ' + transfert.document_titre + (transfert.document_auteur ? ', ' + transfert.document_auteur : '') : ''}`
            navigator.clipboard.writeText(texteACopier)
          }} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(237,232,219,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            📋 Copier le contenu
          </button>
          <button onClick={onTraite} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#5BC78A', color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            ✅ Marquer comme traité
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────
export default function PageStudIA({ project }) {
  const [activeTab, setActiveTab] = useState('voix')
  const tab = TABS.find(t => t.id === activeTab)

  // Phase B : ecoute des transferts depuis Module Source
  const [transfertRecu, setTransfertRecu] = useState(null)
  const [showTransfertModal, setShowTransfertModal] = useState(false)

  const relireTransfert = () => {
    try {
      const raw = localStorage.getItem('pilot_transfer_to_studia')
      if (!raw) { setTransfertRecu(null); return }
      const parsed = JSON.parse(raw)
      setTransfertRecu(parsed)
    } catch (err) {
      console.error('[StudIA] Erreur lecture transfer:', err)
      setTransfertRecu(null)
    }
  }

  useEffect(() => {
    relireTransfert()
    const handler = (e) => { if (e.key === 'pilot_transfer_to_studia') relireTransfert() }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const ignorerTransfert = () => {
    if (!confirm('Ignorer ce contenu reçu de Source ? Il sera supprimé.')) return
    localStorage.removeItem('pilot_transfer_to_studia')
    setTransfertRecu(null)
  }

  const traiterTransfert = () => {
    localStorage.removeItem('pilot_transfer_to_studia')
    setTransfertRecu(null)
    setShowTransfertModal(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showTransfertModal && (
        <TransfertModal
          transfert={transfertRecu}
          onClose={() => setShowTransfertModal(false)}
          onTraite={traiterTransfert}
        />
      )}

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

      <TransfertBanniere
        transfert={transfertRecu}
        onVoir={() => setShowTransfertModal(true)}
        onIgnorer={ignorerTransfert}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'voix'       && <TabVoix project={project} />}
        {activeTab === 'images'     && <TabImages project={project} />}
        {activeTab === 'cinema'     && <TabCinema project={project} />}
        {activeTab === 'shorts'     && <TabShorts project={project} />}
        {activeTab === 'transcript' && <TabTranscript project={project} />}
      </div>
    </div>
  )
}
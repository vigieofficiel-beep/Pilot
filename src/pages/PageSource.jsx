import { useState, useEffect, useRef, useCallback } from 'react'
import useApiKey from '../hooks/useApiKey'

// ═══════════════════════════════════════════════════════════════
//                       CONFIG & CONSTANTES
// ═══════════════════════════════════════════════════════════════
const AGENTS_API_URL = 'https://agents.vigie-officiel.com'
const FAVORIS_STORAGE_KEY = 'pilot_source_favoris'
const HIGHLIGHTS_STORAGE_KEY = 'pilot_source_highlights'
const OCR_JOBS_STORAGE_KEY = 'pilot_source_ocr_jobs'
const HISTORIQUE_STORAGE_KEY = 'pilot_source_historique'
const CHAT_STORAGE_PREFIX = 'pilot_source_chat_'
// Aligne sur la convention Module 13 : pilot_transfer_to_*
const TRANSFER_CONTENU_KEY = 'pilot_transfer_to_contenu'
const TRANSFER_STUDIA_KEY = 'pilot_transfer_to_studia'
const RESULTS_PER_PAGE = 50
const HISTORIQUE_MAX = 50
const CHAT_MAX_MESSAGES = 20

const COULEURS_SURLIGNAGE = [
  { id:'jaune', label:'Important', emoji:'🟡', bg:'rgba(255, 215, 0, 0.4)', border:'#D4A853' },
  { id:'vert',  label:'Confirmé',  emoji:'🟢', bg:'rgba(91, 199, 138, 0.4)', border:'#5BC78A' },
  { id:'rouge', label:'Attention', emoji:'🔴', bg:'rgba(199, 91, 78, 0.4)', border:'#C75B4E' },
  { id:'bleu',  label:'Citation',  emoji:'🔵', bg:'rgba(91, 163, 199, 0.4)', border:'#5BA3C7' },
]

const SOURCES = [
  { id:'gallica', label:'Gallica BnF', icon:'📰', description:'Archives presse + livres français (avec OCR Tesseract intégré)', placeholder:'soucoupes volantes, Dreyfus, 1968…', supportsDates:true, supportsTypeDoc:true, typeDocOptions:[{value:'',label:'Tous'},{value:'fascicule',label:'Presse / fascicules'},{value:'monographie',label:'Livres / monographies'},{value:'image',label:'Images'},{value:'manuscrit',label:'Manuscrits'}], supportsTendance:true, color:'#5BA3C7' },
  { id:'wikipedia', label:'Wikipedia', icon:'📚', description:'Encyclopédie universelle multilingue', placeholder:'Phénomènes paranormaux, histoire, science…', supportsDates:false, supportsTypeDoc:false, supportsTendance:false, supportsLang:true, color:'#9CA3AF' },
  { id:'openalex', label:'OpenAlex', icon:'🔬', description:'250M publications scientifiques peer-reviewed', placeholder:'quantum mechanics, climate change, UAP…', supportsDates:true, supportsTypeDoc:true, typeDocOptions:[{value:'',label:'Tous'},{value:'article',label:'Articles'},{value:'book',label:'Livres'},{value:'preprint',label:'Preprints'},{value:'review',label:'Reviews'}], supportsTendance:false, color:'#5BC78A' },
  { id:'archive', label:'Internet Archive', icon:'📖', description:'Livres domaine public (XIXe siècle, début XXe)', placeholder:'dracula, madame bovary, hugo, verne…', supportsDates:true, supportsTypeDoc:false, supportsTendance:false, color:'#D4A853' },
]

const TENDANCES = {
  "L'Humanité":         {couleur:'#C75B4E', label:'Communiste / ouvrier'},
  'Le Populaire':       {couleur:'#EA4B71', label:'Socialiste'},
  'Le Temps':           {couleur:'#9CA3AF', label:'Centre / libéral'},
  'Le Figaro':          {couleur:'#5BA3C7', label:'Conservateur'},
  "L'Action Française": {couleur:'#8B5A2B', label:'Extrême droite'},
  'Le Petit Journal':   {couleur:'#D4A853', label:'Populaire'},
  'Je Suis Partout':    {couleur:'#6B3410', label:'Extrême droite'},
}

const LANGUES_WIKI = [
  {value:'fr', label:'Français'}, {value:'en', label:'English'},
  {value:'es', label:'Español'},  {value:'de', label:'Deutsch'},
  {value:'it', label:'Italiano'}, {value:'pt', label:'Português'},
]

const TYPES_FICHIERS_BIBLIO = [
  { value:'', label:'Tous types' },
  { value:'text', label:'Texte (.txt/.md)' },
  { value:'pdf', label:'PDF' },
  { value:'image', label:'Image (.jpg/.png)' },
  { value:'other', label:'Autre' },
]

function detectTypeFichier(key, contentType) {
  const k = (key || '').toLowerCase()
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('text') || k.endsWith('.txt') || k.endsWith('.md')) return 'text'
  if (ct.includes('pdf') || k.endsWith('.pdf')) return 'pdf'
  if (ct.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/.test(k)) return 'image'
  return 'other'
}

function iconePourType(type) {
  return { text:'📄', pdf:'📕', image:'🖼️', other:'📦' }[type] || '📦'
}

function formatTaille(bytes) {
  if (!bytes) return '?'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024*1024) return `${Math.round(bytes/1024)} Ko`
  return `${(bytes/1024/1024).toFixed(1)} Mo`
}

function formatDateBiblio(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) } catch { return '' }
}

function formatDateHisto(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) } catch { return '' }
}

function chargerStorage(key, defaultValue=[]) {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : defaultValue
  } catch (err) {
    console.error(`[Source] Erreur chargement ${key}:`, err)
    return defaultValue
  }
}

function sauverStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.error(`[Source] Erreur sauvegarde ${key}:`, err)
    return false
  }
}

function uuid() {
  return 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function formatTexteOCR(texte) {
  if (!texte) return { header: [], pages: [] }
  const lignes = texte.split('\n')
  const sections = []
  let header = []
  let inHeader = true
  let currentPage = null
  let currentParagraphe = []

  for (const ligne of lignes) {
    const trimmed = ligne.trim()
    const pageMatch = trimmed.match(/^={2,}\s*Page\s+(\d+)\s*={2,}$/)
    if (pageMatch) {
      if (currentParagraphe.length > 0) {
        if (currentPage !== null) currentPage.paragraphes.push(currentParagraphe.join(' ').trim())
        currentParagraphe = []
      }
      if (currentPage !== null) sections.push(currentPage)
      currentPage = { type: 'page', num: parseInt(pageMatch[1]), paragraphes: [] }
      inHeader = false
      continue
    }
    if (trimmed === '---' && inHeader) continue
    if (inHeader) { if (trimmed) header.push(trimmed); continue }
    if (currentPage !== null) {
      if (trimmed === '') {
        if (currentParagraphe.length > 0) {
          currentPage.paragraphes.push(currentParagraphe.join(' ').trim())
          currentParagraphe = []
        }
      } else {
        currentParagraphe.push(trimmed)
      }
    }
  }
  if (currentParagraphe.length > 0 && currentPage !== null) currentPage.paragraphes.push(currentParagraphe.join(' ').trim())
  if (currentPage !== null) sections.push(currentPage)
  return { header, pages: sections }
}

// ═══════════════════════════════════════════════════════════════
//                       COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function PageSource({ project }) {
  const apiKey = useApiKey('agents doppler')

  const [sourceActive, setSourceActive] = useState('gallica')
  const sourceConfig = SOURCES.find(s => s.id === sourceActive)

  const [query, setQuery] = useState('')
  const [dateDebut, setDateDebut] = useState('1900')
  const [dateFin, setDateFin] = useState('1960')
  const [lang, setLang] = useState('fr')
  const [tendances, setTendances] = useState([])
  const [typeDoc, setTypeDoc] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)
  const [sourcesModal, setSourcesModal] = useState(false)

  const [results, setResults] = useState([])
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastSearchParams, setLastSearchParams] = useState(null)

  const [theme, setTheme] = useState('')
  const [downloadStatus, setDownloadStatus] = useState({})

  const [favoris, setFavoris] = useState(() => chargerStorage(FAVORIS_STORAGE_KEY))
  const [ocrJobs, setOcrJobs] = useState(() => chargerStorage(OCR_JOBS_STORAGE_KEY))
  const [ocrModal, setOcrModal] = useState(null)
  const pollIntervalRef = useRef(null)

  const [lecteurOuvert, setLecteurOuvert] = useState(null)
  const [lecteurTexte, setLecteurTexte] = useState('')
  const [lecteurLoading, setLecteurLoading] = useState(false)
  const [lecteurError, setLecteurError] = useState(null)

  const [highlights, setHighlights] = useState(() => chargerStorage(HIGHLIGHTS_STORAGE_KEY))
  const [couleurActive, setCouleurActive] = useState('jaune')

  const [vueActive, setVueActive] = useState('recherche')
  const [biblioFichiers, setBiblioFichiers] = useState([])
  const [biblioLoading, setBiblioLoading] = useState(false)
  const [biblioError, setBiblioError] = useState(null)
  const [biblioSearch, setBiblioSearch] = useState('')
  const [biblioFiltreProjet, setBiblioFiltreProjet] = useState('')
  const [biblioFiltreTheme, setBiblioFiltreTheme] = useState('')
  const [biblioFiltreSource, setBiblioFiltreSource] = useState('')
  const [biblioFiltreType, setBiblioFiltreType] = useState('')
  const [biblioFiltreDateMin, setBiblioFiltreDateMin] = useState('')
  const [biblioFiltreDateMax, setBiblioFiltreDateMax] = useState('')
  const [biblioMenuOuvert, setBiblioMenuOuvert] = useState(null)

  const [rapportModal, setRapportModal] = useState(false)
  const [rapportLoading, setRapportLoading] = useState(false)
  const [rapportTexte, setRapportTexte] = useState('')
  const [rapportError, setRapportError] = useState(null)
  const [rapportCout, setRapportCout] = useState(null)

  // PHASE A
  const [historique, setHistorique] = useState(() => chargerStorage(HISTORIQUE_STORAGE_KEY))
  const [historiqueModal, setHistoriqueModal] = useState(false)

  // PHASE B
  const [menuTransferOuvert, setMenuTransferOuvert] = useState(null)
  const [transferToast, setTransferToast] = useState(null)

  // PHASE C
  const projetIdChat = project?.id || 'general'
  const chatKey = CHAT_STORAGE_PREFIX + projetIdChat
  const [chatOuvert, setChatOuvert] = useState(false)
  const [chatMessages, setChatMessages] = useState(() => chargerStorage(chatKey))
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    setChatMessages(chargerStorage(CHAT_STORAGE_PREFIX + (project?.id || 'general')))
  }, [project?.id])

  useEffect(() => {
    if (chatOuvert && chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight
    }
  }, [chatMessages, chatOuvert])

  const surlignagesProjet = highlights.filter(h => h.projet_id === (project?.id || 'general'))
  const historiqueProjet = historique.filter(h => h.projet_id === (project?.id || 'general'))

  // ── PHASE A : HISTORIQUE ─────────────────────────────────────
  const ajouterHistorique = (params, nbResultats) => {
    const entry = {
      id: uuid(), query: params.query, source: params.source,
      filtres: { date_debut: params.date_debut || null, date_fin: params.date_fin || null, type_doc: params.type_doc || null, lang: params.lang || null },
      nb_resultats: nbResultats, projet_id: project?.id || 'general', date: new Date().toISOString(),
    }
    const newHisto = [entry, ...historique].slice(0, HISTORIQUE_MAX)
    setHistorique(newHisto)
    sauverStorage(HISTORIQUE_STORAGE_KEY, newHisto)
  }

  const supprimerHistorique = (id) => {
    const newHisto = historique.filter(h => h.id !== id)
    setHistorique(newHisto)
    sauverStorage(HISTORIQUE_STORAGE_KEY, newHisto)
  }

  const viderHistorique = () => {
    if (!confirm("Vider tout l'historique des recherches ?")) return
    setHistorique([])
    sauverStorage(HISTORIQUE_STORAGE_KEY, [])
  }

  const relancerRecherche = (entry) => {
    setQuery(entry.query)
    setSourceActive(entry.source)
    if (entry.filtres.date_debut) setDateDebut(entry.filtres.date_debut)
    if (entry.filtres.date_fin) setDateFin(entry.filtres.date_fin)
    if (entry.filtres.type_doc) setTypeDoc(entry.filtres.type_doc)
    if (entry.filtres.lang) setLang(entry.filtres.lang)
    setHistoriqueModal(false)
    setTimeout(() => {
      const body = {
        query: entry.query,
        source: entry.source,
        max_results: RESULTS_PER_PAGE,
        start_record: 1,
      }
      if (entry.filtres.date_debut) body.date_debut = entry.filtres.date_debut
      if (entry.filtres.date_fin) body.date_fin = entry.filtres.date_fin
      if (entry.filtres.type_doc) body.type_doc = entry.filtres.type_doc
      if (entry.filtres.lang) body.lang = entry.filtres.lang
      handleSearchWithParams(body)
    }, 100)
  }

  // ── PHASE B : TRANSFER VERS MODULES ─────────────────────────
  const envoyerVersModule = (destination, payload) => {
    const cleStorage = destination === 'contenu' ? TRANSFER_CONTENU_KEY : TRANSFER_STUDIA_KEY
    const enveloppe = {
      ...payload,
      origin: 'source',
      projet_id: project?.id || 'general',
      timestamp: new Date().toISOString(),
    }
    try { localStorage.setItem(cleStorage, JSON.stringify(enveloppe)) }
    catch (err) {
      console.error('[Transfer] Erreur:', err)
      setTransferToast({ message: 'Erreur envoi : ' + err.message, type: 'error' })
      return
    }
    setMenuTransferOuvert(null)
    setTransferToast({
      message: `✅ Envoyé vers ${destination === 'contenu' ? 'Contenu' : "Stud'IA"}. Ouvre le module pour le récupérer.`,
      type: 'success'
    })
    setTimeout(() => setTransferToast(null), 4000)
  }

  const ajouterResultatAuScript = (destination, result) => {
    envoyerVersModule(destination, {
      type: 'source_resultat',
      titre: result.titre,
      auteur: result.auteur || null,
      date_doc: result.date || null,
      url: result.url_gallica,
      source: result.source || sourceActive,
      snippet: result.snippet || null,
      doi: result.doi || null,
    })
  }

  const ajouterSurlignageAuScript = (destination, h) => {
    envoyerVersModule(destination, {
      type: 'source_surlignage',
      texte: h.texte_surligne,
      couleur: h.couleur,
      document_titre: lecteurOuvert?.titre || null,
      document_auteur: lecteurOuvert?.auteur || null,
      theme: h.theme || null,
    })
  }

  // ── PHASE C : CHAT CONTEXTUEL ───────────────────────────────
  const construireContexteChat = () => {
    const lignes = []
    if (results.length > 0) {
      lignes.push(`=== RESULTATS RECHERCHE EN COURS (${results.length} resultats pour "${query}", source ${sourceActive}) ===`)
      results.slice(0, 15).forEach((r, i) => {
        lignes.push(`${i+1}. ${r.titre}${r.auteur?' — '+r.auteur:''}${r.date?' ('+r.date+')':''}${r.snippet?'\n   '+r.snippet.slice(0,200):''}`)
      })
    }
    const favProjet = favoris.filter(f => f.projet_id === (project?.id || 'general'))
    if (favProjet.length > 0) {
      lignes.push(`\n=== FAVORIS DU PROJET (${favProjet.length}) ===`)
      favProjet.slice(0, 20).forEach((f, i) => {
        lignes.push(`${i+1}. ${f.titre}${f.auteur?' — '+f.auteur:''}${f.theme?' [#'+f.theme+']':''}`)
      })
    }
    if (surlignagesProjet.length > 0) {
      lignes.push(`\n=== SURLIGNAGES DU PROJET (${surlignagesProjet.length}) ===`)
      const parCouleur = { jaune:[], vert:[], rouge:[], bleu:[] }
      for (const h of surlignagesProjet) { if (parCouleur[h.couleur]) parCouleur[h.couleur].push(h) }
      const labels = { jaune:'IMPORTANT', vert:'CONFIRME', rouge:'ATTENTION', bleu:'CITATION' }
      for (const c of ['jaune','vert','rouge','bleu']) {
        if (parCouleur[c].length === 0) continue
        lignes.push(`\n[${labels[c]}]`)
        parCouleur[c].slice(0, 10).forEach(h => lignes.push(`  - "${h.texte_surligne.slice(0, 300)}"`))
      }
    }
    const histoP = historiqueProjet.slice(0, 10)
    if (histoP.length > 0) {
      lignes.push(`\n=== 10 DERNIERES RECHERCHES DU PROJET ===`)
      histoP.forEach((h, i) => lignes.push(`${i+1}. "${h.query}" sur ${h.source} (${h.nb_resultats} resultats)`))
    }
    return lignes.join('\n')
  }

  const envoyerMessageChat = async () => {
    const texte = chatInput.trim()
    if (!texte || chatLoading) return
    const userMsg = { role:'user', content: texte, date: new Date().toISOString() }
    const newMessagesUser = [...chatMessages, userMsg].slice(-CHAT_MAX_MESSAGES)
    setChatMessages(newMessagesUser)
    sauverStorage(chatKey, newMessagesUser)
    setChatInput('')
    setChatLoading(true)

    try {
      const contexte = construireContexteChat()
      const systemPrompt = `Tu es un assistant de recherche documentaire. L'utilisateur travaille sur le projet "${project?.id || 'general'}" et te pose des questions sur les sources qu'il a collectees.

Voici son contexte de travail actuel :

${contexte}

Reponds en francais, sois precis et concis. Si une question depasse le contexte fourni, dis-le clairement plutot qu'inventer. Pour citer une source, utilise des guillemets et reference le titre.`

      const conversationHistory = newMessagesUser.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const userPrompt = conversationHistory.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n')

      const result = await window.electronAPI.studia.callOpenAI({
        systemPrompt, userPrompt, modele: 'gpt-4o', temperature: 0.5, maxTokens: 1500,
      })
      if (!result.success) throw new Error(result.error || 'Erreur OpenAI')

      const assistantMsg = { role: 'assistant', content: result.content || '(reponse vide)', date: new Date().toISOString(), cost_eur: result.cost_eur || null }
      const newMessagesAll = [...newMessagesUser, assistantMsg].slice(-CHAT_MAX_MESSAGES)
      setChatMessages(newMessagesAll)
      sauverStorage(chatKey, newMessagesAll)
    } catch (err) {
      console.error('[Chat] Erreur:', err)
      const errMsg = { role: 'assistant', content: '⚠️ Erreur : ' + (err.message || 'inconnue'), date: new Date().toISOString(), error: true }
      const newMessagesErr = [...newMessagesUser, errMsg].slice(-CHAT_MAX_MESSAGES)
      setChatMessages(newMessagesErr)
      sauverStorage(chatKey, newMessagesErr)
    } finally {
      setChatLoading(false)
    }
  }

  const viderChat = () => {
    if (!confirm('Vider la conversation pour ce projet ?')) return
    setChatMessages([])
    sauverStorage(chatKey, [])
  }

  // ── BIBLIO R2 ─────────────────────────────────────────────────
  const chargerBibliotheque = useCallback(async () => {
    if (!apiKey) { setBiblioError('Cle API Agents Doppler introuvable'); return }
    setBiblioLoading(true)
    setBiblioError(null)
    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/r2/list?max_results=1000`, { headers: { 'X-API-Key': apiKey } })
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.detail || `Erreur ${response.status}`) }
      const data = await response.json()
      setBiblioFichiers(data.fichiers || [])
    } catch (err) {
      console.error('[Biblio] Erreur:', err)
      setBiblioError(err.message || 'Erreur chargement bibliotheque')
    } finally {
      setBiblioLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    if (vueActive === 'biblio' && biblioFichiers.length === 0 && !biblioLoading && apiKey) chargerBibliotheque()
  }, [vueActive, apiKey])

  const biblioFichiersFiltres = biblioFichiers.filter(f => {
    if (biblioSearch.trim()) {
      const q = biblioSearch.trim().toLowerCase()
      const inKey = (f.key || '').toLowerCase().includes(q)
      const inTitre = (f.metadata?.titre || '').toLowerCase().includes(q)
      const inAuteur = (f.metadata?.auteur || '').toLowerCase().includes(q)
      if (!inKey && !inTitre && !inAuteur) return false
    }
    if (biblioFiltreProjet && f.projet_id !== biblioFiltreProjet) return false
    if (biblioFiltreTheme && f.theme !== biblioFiltreTheme) return false
    if (biblioFiltreSource && (f.metadata?.source || '') !== biblioFiltreSource) return false
    if (biblioFiltreType) { const t = detectTypeFichier(f.key, f.content_type); if (t !== biblioFiltreType) return false }
    if (biblioFiltreDateMin && f.last_modified && f.last_modified < biblioFiltreDateMin) return false
    if (biblioFiltreDateMax && f.last_modified && f.last_modified > biblioFiltreDateMax + 'T23:59:59') return false
    return true
  })

  const biblioGroupes = (() => {
    const groupes = {}
    for (const f of biblioFichiersFiltres) {
      const parts = (f.key || '').split('/')
      const docKey = parts.slice(0, 3).join('/') || f.key
      if (!groupes[docKey]) groupes[docKey] = { docKey, fichiers: [], meta: f.metadata || {}, projet_id: f.projet_id, theme: f.theme }
      groupes[docKey].fichiers.push(f)
    }
    return Object.values(groupes).sort((a, b) => {
      const da = a.fichiers[0]?.last_modified || ''
      const db = b.fichiers[0]?.last_modified || ''
      return db.localeCompare(da)
    })
  })()

  const projetsUniques = [...new Set(biblioFichiers.map(f => f.projet_id).filter(Boolean))].sort()
  const themesUniques = [...new Set(biblioFichiers.map(f => f.theme).filter(Boolean))].sort()
  const sourcesUniques = [...new Set(biblioFichiers.map(f => f.metadata?.source).filter(Boolean))].sort()

  const ouvrirFichierR2 = async (fichier) => {
    setBiblioMenuOuvert(null)
    const type = detectTypeFichier(fichier.key, fichier.content_type)
    if (type === 'text') {
      ouvrirLecteur({
        titre: fichier.metadata?.titre || fichier.key.split('/').pop(),
        source: fichier.metadata?.source || 'gallica', r2_key: fichier.key, document_id: fichier.key,
        theme: fichier.theme || null, auteur: fichier.metadata?.auteur || null, date: fichier.metadata?.date || null,
      })
    } else {
      try {
        const response = await fetch(`${AGENTS_API_URL}/sources/r2/presigned-url`, {
          method: 'POST', headers: { 'Content-Type':'application/json', 'X-API-Key':apiKey },
          body: JSON.stringify({ key: fichier.key, expires_in: 3600 })
        })
        if (!response.ok) throw new Error(`Erreur ${response.status}`)
        const data = await response.json()
        window.open(data.url, '_blank')
      } catch (err) { setBiblioError(`Impossible d'ouvrir : ${err.message}`) }
    }
  }

  const telechargerFichierR2 = async (fichier) => {
    setBiblioMenuOuvert(null)
    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/r2/presigned-url`, {
        method: 'POST', headers: { 'Content-Type':'application/json', 'X-API-Key':apiKey },
        body: JSON.stringify({ key: fichier.key, expires_in: 3600 })
      })
      if (!response.ok) throw new Error(`Erreur ${response.status}`)
      const data = await response.json()
      const a = document.createElement('a')
      a.href = data.url
      a.download = fichier.key.split('/').pop()
      a.click()
    } catch (err) { setBiblioError(`Impossible de telecharger : ${err.message}`) }
  }

  const resetFiltresBiblio = () => {
    setBiblioSearch(''); setBiblioFiltreProjet(''); setBiblioFiltreTheme('')
    setBiblioFiltreSource(''); setBiblioFiltreType(''); setBiblioFiltreDateMin(''); setBiblioFiltreDateMax('')
  }

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === FAVORIS_STORAGE_KEY) setFavoris(chargerStorage(FAVORIS_STORAGE_KEY))
      if (e.key === HIGHLIGHTS_STORAGE_KEY) setHighlights(chargerStorage(HIGHLIGHTS_STORAGE_KEY))
      if (e.key === OCR_JOBS_STORAGE_KEY) setOcrJobs(chargerStorage(OCR_JOBS_STORAGE_KEY))
      if (e.key === HISTORIQUE_STORAGE_KEY) setHistorique(chargerStorage(HISTORIQUE_STORAGE_KEY))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    const jobsEnCours = ocrJobs.filter(j => j.status === 'pending' || j.status === 'running')
    if (jobsEnCours.length === 0) {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
      return
    }
    if (pollIntervalRef.current) return

    pollIntervalRef.current = setInterval(async () => {
      if (!apiKey) return
      const updatedJobs = [...ocrJobs]
      let changed = false
      for (let i = 0; i < updatedJobs.length; i++) {
        const job = updatedJobs[i]
        if (job.status === 'pending' || job.status === 'running') {
          try {
            const response = await fetch(`${AGENTS_API_URL}/sources/gallica/ocr/status?job_id=${job.job_id}`, { headers: { 'X-API-Key': apiKey } })
            if (response.ok) {
              const data = await response.json()
              updatedJobs[i] = { ...job, ...data, last_check: new Date().toISOString() }
              changed = true
            }
          } catch (err) { console.error('[OCR] Erreur polling:', err) }
        }
      }
      if (changed) { setOcrJobs(updatedJobs); sauverStorage(OCR_JOBS_STORAGE_KEY, updatedJobs) }
    }, 5000)

    return () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    }
  }, [ocrJobs, apiKey])

  const favorisProjet = favoris.filter(f => f.projet_id === (project?.id || 'general'))
  const estFavori = (resultId) => favoris.some(f => f.id === resultId)

  const toggleFavori = (result) => {
    let newFavoris
    if (estFavori(result.id)) {
      newFavoris = favoris.filter(f => f.id !== result.id)
    } else {
      const fav = {
        id: result.id, titre: result.titre, auteur: result.auteur || null, date: result.date || null,
        editeur: result.editeur || null, type_doc: result.type_doc || null, url_gallica: result.url_gallica,
        thumbnail: result.thumbnail || null, source: result.source || sourceActive,
        ocr_quality: result.ocr_quality ?? null, snippet: result.snippet || null, doi: result.doi || null,
        pdf_url: result.pdf_url || null, open_access: result.open_access ?? null,
        archive_identifier: result.archive_identifier || null, is_borrowable: result.is_borrowable ?? null,
        projet_id: project?.id || 'general', theme: theme.trim() || null,
        ajoute_le: new Date().toISOString(), r2_key: null,
      }
      newFavoris = [fav, ...favoris]
    }
    setFavoris(newFavoris)
    sauverStorage(FAVORIS_STORAGE_KEY, newFavoris)
  }

  const supprimerFavori = (id) => {
    if (!confirm('Supprimer ce favori ? Les surlignages liés seront conservés.')) return
    const newFavoris = favoris.filter(f => f.id !== id)
    setFavoris(newFavoris)
    sauverStorage(FAVORIS_STORAGE_KEY, newFavoris)
  }

  const mettreAJourFavoriR2Key = (id, r2Key) => {
    const newFavoris = favoris.map(f => f.id === id ? {...f, r2_key: r2Key} : f)
    setFavoris(newFavoris)
    sauverStorage(FAVORIS_STORAGE_KEY, newFavoris)
  }

  const tendancePour = (j) => TENDANCES[j] || {couleur:'#6B7280', label:'Inconnu'}

  const handleChangeSource = (newSource) => {
    setSourceActive(newSource); setResults([]); setTotalHits(0)
    setSearched(false); setError(null); setCurrentPage(1); setLastSearchParams(null)
  }

  const surlignagesDocument = (docId) => highlights.filter(h => h.document_id === docId)

  const ajouterSurlignage = (docId, texte, couleur, note='') => {
    const newHighlight = {
      id: uuid(), document_id: docId, texte_surligne: texte, couleur: couleur, note: note,
      projet_id: project?.id || 'general', theme: lecteurOuvert?.theme || null, ajoute_le: new Date().toISOString(),
    }
    const newHighlights = [newHighlight, ...highlights]
    setHighlights(newHighlights)
    sauverStorage(HIGHLIGHTS_STORAGE_KEY, newHighlights)
    return newHighlight
  }

  const supprimerSurlignage = (highlightId) => {
    const newHighlights = highlights.filter(h => h.id !== highlightId)
    setHighlights(newHighlights)
    sauverStorage(HIGHLIGHTS_STORAGE_KEY, newHighlights)
  }

  const buildSearchBody = (page=1) => {
    const body = {
      query: query.trim(), source: sourceActive,
      max_results: RESULTS_PER_PAGE, start_record: (page - 1) * RESULTS_PER_PAGE + 1,
    }
    if (sourceConfig.supportsDates) { if (dateDebut) body.date_debut = dateDebut; if (dateFin) body.date_fin = dateFin }
    if (sourceConfig.supportsTypeDoc && typeDoc) body.type_doc = typeDoc
    if (sourceConfig.supportsLang) body.lang = lang
    return body
  }

  const handleSearchWithParams = async (body) => {
    if (!body.query?.trim()) return
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }

    setLoading(true); setError(null); setSearched(true)
    setResults([]); setTotalHits(0); setCurrentPage(1)
    setLastSearchParams(body)

    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/recherche`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      const newResults = data.results || []
      setResults(newResults)
      setTotalHits(data.total || 0)
      ajouterHistorique(body, data.total || newResults.length)
    } catch (err) {
      console.error('[Source] Erreur recherche:', err)
      let msg = 'Erreur recherche'
      if (typeof err.message === 'string') msg = err.message
      else if (err.message) msg = JSON.stringify(err.message)
      else if (typeof err === 'string') msg = err
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) { setError('Saisis un terme de recherche'); return }
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }
    const body = buildSearchBody(1)
    await handleSearchWithParams(body)
  }

  const handleLoadMore = async () => {
    if (!lastSearchParams || loadingMore) return
    const nextPage = currentPage + 1
    setLoadingMore(true)
    setError(null)
    const body = {...lastSearchParams, start_record: (nextPage - 1) * RESULTS_PER_PAGE + 1}
    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/recherche`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      const newResults = data.results || []
      const existingIds = new Set(results.map(r => r.id))
      const uniqueNew = newResults.filter(r => !existingIds.has(r.id))
      setResults(prev => [...prev, ...uniqueNew])
      setCurrentPage(nextPage)
    } catch (err) {
      console.error('[Source] Erreur chargement page:', err)
      setError(`Erreur chargement page ${nextPage} : ${err.message}`)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleDownload = async (result) => {
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }
    if (!theme.trim()) { setError('Indique un theme dans le champ ci-dessus (ex: ovnis, stavisky, 1968)'); return }

    const docId = result.id
    setDownloadStatus(prev => ({...prev, [docId]: 'loading'}))
    setError(null)

    try {
      const body = {
        url_gallica: result.url_gallica, titre: result.titre,
        projet_id: project?.id || 'general', theme: theme.trim().toLowerCase(),
        auteur: result.auteur || '', date: result.date || '',
        source: result.source || sourceActive, type_telechargement: 'both',
        archive_identifier: result.archive_identifier || null,
      }
      const response = await fetch(`${AGENTS_API_URL}/sources/telecharger`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      setDownloadStatus(prev => ({...prev, [docId]: 'ok'}))

      if (estFavori(docId)) {
        const txtFile = data.fichiers_uploades.find(f => f.content_type.includes('text'))
        if (txtFile) mettreAJourFavoriR2Key(docId, txtFile.key)
      }
    } catch (err) {
      console.error('[Source] Erreur telechargement:', err)
      setDownloadStatus(prev => ({...prev, [docId]: 'error'}))
      setError(`Téléchargement échoué : ${err.message}`)
    }
  }

  const handleStartOcr = (result) => {
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }
    if (!theme.trim()) { setError('Indique un theme dans le champ ci-dessus'); return }
    if (result.source !== 'gallica') { setError('OCR uniquement pour Gallica'); return }
    const arkMatch = result.url_gallica.match(/\/([a-z0-9]+)$/)
    if (!arkMatch) { setError('URL Gallica invalide'); return }
    setOcrModal({ result, ark_id: arkMatch[1], pages: 50 })
  }

  const confirmerOcr = async () => {
    if (!ocrModal) return
    const { result, ark_id, pages } = ocrModal
    setOcrModal(null)
    setError(null)

    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/gallica/ocr/start`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({
          ark_id, titre: result.titre, projet_id: project?.id || 'general',
          theme: theme.trim().toLowerCase(), auteur: result.auteur || '', date: result.date || '',
          max_pages: Math.min(pages, 1000),
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      const newJob = {
        ...data, progress: 0, pages_done: 0,
        document_id: result.id, document_titre: result.titre,
        ark_id, max_pages: Math.min(pages, 1000), cree_le: new Date().toISOString(),
      }
      const newJobs = [newJob, ...ocrJobs]
      setOcrJobs(newJobs)
      sauverStorage(OCR_JOBS_STORAGE_KEY, newJobs)
    } catch (err) {
      console.error('[Source] Erreur OCR:', err)
      setError(`OCR échoué : ${err.message}`)
    }
  }

  const ouvrirLecteur = async (docInfo) => {
    setLecteurOuvert(docInfo)
    setLecteurTexte('')
    setLecteurError(null)
    setLecteurLoading(true)

    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/r2/presigned-url`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({key: docInfo.r2_key, expires_in: 3600}),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      const textResponse = await fetch(data.url)
      if (!textResponse.ok) throw new Error(`Erreur Cloudflare : ${textResponse.status}`)
      const text = await textResponse.text()
      setLecteurTexte(text)
    } catch (err) {
      console.error('[Lecteur] Erreur:', err)
      setLecteurError(`Impossible de charger le document : ${err.message}`)
    } finally {
      setLecteurLoading(false)
    }
  }

  const fermerLecteur = () => {
    setLecteurOuvert(null); setLecteurTexte(''); setLecteurError(null)
  }

  const handleSurligner = () => {
    const selection = window.getSelection()
    const texte = selection.toString().trim()
    if (!texte) return
    if (texte.length > 1000) {
      alert('Sélection trop longue (max 1000 caractères). Réduis ta sélection.')
      return
    }
    if (!lecteurOuvert?.document_id) return
    ajouterSurlignage(lecteurOuvert.document_id, texte, couleurActive)
    selection.removeAllRanges()
  }

  const genererRapportIA = async () => {
    if (surlignagesProjet.length === 0) {
      setRapportError('Aucun surlignage dans ce projet. Surligne du texte dans le lecteur pour generer un rapport.')
      setRapportModal(true)
      return
    }
    setRapportModal(true); setRapportLoading(true)
    setRapportError(null); setRapportTexte(''); setRapportCout(null)

    const parCouleur = { jaune:[], vert:[], rouge:[], bleu:[] }
    for (const h of surlignagesProjet) { if (parCouleur[h.couleur]) parCouleur[h.couleur].push(h) }

    const labelsCouleurs = {
      jaune: 'IMPORTANT (points cles)', vert: 'CONFIRME (preuves, faits etablis)',
      rouge: 'ATTENTION (contre-arguments, contradictions, doutes)',
      bleu: 'CITATION (citations marquantes a reutiliser)',
    }

    let extraits = ''
    for (const couleurId of ['jaune','vert','rouge','bleu']) {
      const items = parCouleur[couleurId]
      if (items.length === 0) continue
      extraits += `\n\n=== ${labelsCouleurs[couleurId]} (${items.length} extraits) ===\n`
      items.forEach((h, i) => {
        const docInfo = h.theme ? ` [theme: ${h.theme}]` : ''
        extraits += `\n${i+1}.${docInfo} "${h.texte_surligne}"\n`
      })
    }

    const systemPrompt = `Tu es un analyste expert specialise dans la synthese de sources documentaires. Tu vas recevoir une liste d'extraits surlignes par un chercheur dans differentes sources, classes par categorie (Important / Confirme / Attention / Citation). Tu dois produire un argumentaire structure en Markdown qui :

1. Pose une THESE centrale claire deduite des extraits
2. Liste les PREUVES (en t'appuyant sur les extraits Important + Confirme)
3. Presente les CONTRE-ARGUMENTS / NUANCES (en t'appuyant sur les extraits Attention)
4. Integre des CITATIONS MARQUANTES (extraits Citation) au fil du texte
5. Conclut par une SYNTHESE finale

Regles :
- Ecris en FRANCAIS, ton academique mais accessible
- Cite TEXTUELLEMENT les extraits entre guillemets quand tu les utilises
- Si les extraits sont contradictoires, ASSUME la contradiction au lieu de la masquer
- Format Markdown propre avec titres ## et listes
- NE PAS inventer de contenu absent des extraits`

    const userPrompt = `Voici les extraits surlignes pour le projet "${project?.id || 'general'}" (${surlignagesProjet.length} extraits au total) :
${extraits}

Produis l'argumentaire structure (these / preuves / contre-arguments / citations / synthese) en Markdown.`

    try {
      const result = await window.electronAPI.studia.callOpenAI({
        systemPrompt, userPrompt, modele: 'gpt-4o', temperature: 0.4, maxTokens: 4000,
      })
      if (!result.success) throw new Error(result.error || 'Erreur OpenAI')
      setRapportTexte(result.content || '')
      setRapportCout(result.cost_eur || null)
    } catch (err) {
      console.error('[Rapport IA] Erreur:', err)
      setRapportError(err.message || 'Erreur generation rapport')
    } finally {
      setRapportLoading(false)
    }
  }

  const telechargerRapport = () => {
    if (!rapportTexte) return
    const date = new Date().toISOString().slice(0,10)
    const projetId = project?.id || 'general'
    const filename = `rapport-ia_${projetId}_${date}.md`
    const blob = new Blob([rapportTexte], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const getDownloadButtonLabel = (id) => {
    const status = downloadStatus[id]
    if (status === 'loading') return '⏳ En cours...'
    if (status === 'ok')      return '✅ Stocké'
    if (status === 'error')   return '⚠️ Erreur'
    return '📥 Télécharger R2'
  }

  const getDownloadButtonStyle = (id) => {
    const status = downloadStatus[id]
    const base = {padding:'5px 10px', borderRadius:7, fontSize:10, fontWeight:700,
      cursor:status === 'loading' ? 'wait' : 'pointer', border:'1px solid'}
    if (status === 'ok')      return {...base, borderColor:'#5BC78A', background:'rgba(91,199,138,0.1)', color:'#5BC78A'}
    if (status === 'error')   return {...base, borderColor:'#C75B4E', background:'rgba(199,91,78,0.1)', color:'#C75B4E'}
    if (status === 'loading') return {...base, borderColor:'rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)', color:'rgba(237,232,219,0.5)'}
    return {...base, borderColor:`${project.color}40`, background:`${project.color}10`, color:project.color}
  }

  const hasMore = results.length < totalHits
  const jobsActifs = ocrJobs.filter(j => j.status === 'pending' || j.status === 'running')
  const jobsDone = ocrJobs.filter(j => j.status === 'done')

  // ═══════════════════════════════════════════════════════════════
  //                       RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12, height:'100%', overflow:'hidden', position:'relative'}}>

      {/* ONGLETS */}
      <div style={{display:'flex', gap:4, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:3, flexShrink:0, alignSelf:'flex-start'}}>
        {[{id:'recherche', label:'🔍 Recherche'},{id:'biblio', label:'📚 Bibliothèque'}].map(v => (
          <button key={v.id} onClick={()=>setVueActive(v.id)}
            style={{padding:'7px 16px', borderRadius:8, border:'none',
              background:vueActive===v.id ? project.color : 'transparent',
              color:vueActive===v.id ? '#0D1B2A' : 'rgba(237,232,219,0.6)',
              fontSize:12, fontWeight:800, cursor:'pointer', transition:'all 0.15s'}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* TOAST TRANSFER */}
      {transferToast && (
        <div style={{position:'fixed', top:80, right:30, zIndex:1500,
          background: transferToast.type==='error' ? 'rgba(199,91,78,0.95)' : 'rgba(91,199,138,0.95)',
          color:'#0D1B2A', padding:'12px 20px', borderRadius:10, fontSize:13, fontWeight:700,
          boxShadow:'0 4px 16px rgba(0,0,0,0.4)', maxWidth:400}}>
          {transferToast.message}
        </div>
      )}

      {/* MODALE HISTORIQUE (PHASE A) */}
      {historiqueModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1150, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
             onClick={e=>{if(e.target===e.currentTarget) setHistoriqueModal(false)}}>
          <div style={{background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:680, maxHeight:'85vh', display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0}}>
              <div>
                <h3 style={{fontSize:16, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px'}}>📜 Historique des recherches</h3>
                <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>
                  Projet : <strong style={{color:project.color}}>{project?.id || 'general'}</strong> · {historiqueProjet.length} recherches
                </p>
              </div>
              <div style={{display:'flex', gap:8}}>
                {historique.length > 0 && (
                  <button onClick={viderHistorique}
                    style={{padding:'6px 12px', borderRadius:8, border:'1px solid rgba(199,91,78,0.3)', background:'rgba(199,91,78,0.1)', color:'#C75B4E', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                    🗑️ Tout vider
                  </button>
                )}
                <button onClick={()=>setHistoriqueModal(false)}
                  style={{background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'rgba(237,232,219,0.7)', fontSize:13, fontWeight:700}}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{flex:1, overflowY:'auto', padding:'14px 20px'}}>
              {historiqueProjet.length === 0 ? (
                <div style={{padding:'40px 20px', textAlign:'center', color:'rgba(237,232,219,0.4)'}}>
                  <p style={{fontSize:40, margin:'0 0 12px'}}>📜</p>
                  <p style={{fontSize:13, margin:0}}>Aucune recherche dans l'historique de ce projet</p>
                </div>
              ) : (
                historiqueProjet.map(h => {
                  const sourceCfg = SOURCES.find(s => s.id === h.source) || SOURCES[0]
                  return (
                    <div key={h.id} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 14px', marginBottom:8, borderLeft:`3px solid ${sourceCfg.color}`, display:'flex', gap:10, alignItems:'center'}}>
                      <div style={{flex:1, minWidth:0}}>
                        <p style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px', lineHeight:1.4}}>"{h.query}"</p>
                        <p style={{fontSize:10, color:'rgba(237,232,219,0.5)', margin:0}}>
                          <span style={{color:sourceCfg.color, fontWeight:700}}>{sourceCfg.icon} {sourceCfg.label}</span>
                          {' · '}{h.nb_resultats.toLocaleString('fr-FR')} résultats
                          {' · '}{formatDateHisto(h.date)}
                          {(h.filtres.date_debut || h.filtres.date_fin) && <span> · {h.filtres.date_debut || '?'}–{h.filtres.date_fin || '?'}</span>}
                          {h.filtres.type_doc && <span> · {h.filtres.type_doc}</span>}
                        </p>
                      </div>
                      <button onClick={()=>relancerRecherche(h)}
                        style={{padding:'6px 12px', borderRadius:7, border:'none', background:project.color, color:'#0D1B2A', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap'}}>
                        ↻ Relancer
                      </button>
                      <button onClick={()=>supprimerHistorique(h.id)} title="Supprimer"
                        style={{padding:'4px 8px', borderRadius:6, border:'none', background:'transparent', color:'rgba(237,232,219,0.4)', fontSize:13, cursor:'pointer'}}>
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE RAPPORT IA */}
      {rapportModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
             onClick={e=>{if(e.target===e.currentTarget && !rapportLoading) setRapportModal(false)}}>
          <div style={{background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:820, maxHeight:'90vh', display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0}}>
              <div>
                <h3 style={{fontSize:16, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px'}}>✨ Rapport IA — Argumentaire structuré</h3>
                <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>
                  Projet : <strong style={{color:project.color}}>{project?.id || 'general'}</strong>
                  {' · '}{surlignagesProjet.length} surlignages
                  {rapportCout && <span> · Coût : {rapportCout.toFixed(4)} €</span>}
                </p>
              </div>
              <button onClick={()=>{if(!rapportLoading) setRapportModal(false)}} disabled={rapportLoading}
                style={{background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, padding:'6px 12px', cursor:rapportLoading?'wait':'pointer', color:'rgba(237,232,219,0.7)', fontSize:13, fontWeight:700}}>✕</button>
            </div>
            <div style={{flex:1, overflowY:'auto', padding:'20px 24px'}}>
              {rapportLoading && (
                <div style={{padding:60, textAlign:'center'}}>
                  <p style={{fontSize:40, margin:'0 0 16px'}}>⏳</p>
                  <p style={{fontSize:14, color:'#EDE8DB', margin:'0 0 6px', fontWeight:700}}>Génération en cours…</p>
                  <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>GPT-4o analyse les {surlignagesProjet.length} surlignages (10-30 sec)</p>
                </div>
              )}
              {!rapportLoading && rapportError && (
                <div style={{padding:24, background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:10}}>
                  <p style={{fontSize:13, color:'#C75B4E', margin:'0 0 8px', fontWeight:700}}>⚠️ Erreur</p>
                  <p style={{fontSize:12, color:'#EDE8DB', margin:0, lineHeight:1.6}}>{rapportError}</p>
                </div>
              )}
              {!rapportLoading && !rapportError && rapportTexte && (
                <div style={{color:'#EDE8DB', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', fontFamily:"'Nunito Sans', sans-serif"}}>
                  {rapportTexte}
                </div>
              )}
            </div>
            {!rapportLoading && rapportTexte && (
              <div style={{padding:'14px 24px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0}}>
                <button onClick={()=>navigator.clipboard.writeText(rapportTexte)}
                  style={{padding:'9px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.7)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  📋 Copier
                </button>
                <button onClick={telechargerRapport}
                  style={{padding:'9px 16px', borderRadius:8, border:'none', background:project.color, color:'#0D1B2A', fontSize:12, fontWeight:800, cursor:'pointer'}}>
                  📥 Télécharger .md
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE SOURCES */}
      {sourcesModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
             onClick={e=>{if(e.target===e.currentTarget)setSourcesModal(false)}}>
          <div style={{background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:560, padding:28, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h3 style={{fontSize:16, fontWeight:700, color:'#EDE8DB', margin:0}}>📰 Sources documentaires</h3>
              <button onClick={()=>setSourcesModal(false)} style={{background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', color:'rgba(237,232,219,0.6)', fontSize:12}}>✕</button>
            </div>
            <p style={{fontSize:12, color:'rgba(237,232,219,0.5)', marginBottom:14, lineHeight:1.6}}>
              {SOURCES.length} sources préconfigurées par Pilot. Plus à venir.
            </p>
            {SOURCES.map(s => (
              <div key={s.id} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{flex:1}}>
                  <p style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:'0 0 2px'}}>{s.icon} {s.label}</p>
                  <p style={{fontSize:11, color:'rgba(237,232,219,0.4)', margin:0}}>{s.description}</p>
                </div>
                <span style={{fontSize:10, color:'#5BC78A', fontWeight:700, whiteSpace:'nowrap', marginLeft:12}}>✅ Actif</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALE OCR */}
      {ocrModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1050, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
             onClick={e=>{if(e.target===e.currentTarget)setOcrModal(null)}}>
          <div style={{background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:480, padding:24}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{fontSize:16, fontWeight:700, color:'#EDE8DB', margin:0}}>🔬 OCR Tesseract</h3>
              <button onClick={()=>setOcrModal(null)} style={{background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', color:'rgba(237,232,219,0.6)', fontSize:12}}>✕</button>
            </div>
            <p style={{fontSize:12, color:'rgba(237,232,219,0.7)', margin:'0 0 6px', lineHeight:1.5}}>
              Document : <strong style={{color:'#EDE8DB'}}>{ocrModal.result.titre}</strong>
            </p>
            <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:'0 0 16px', lineHeight:1.5}}>
              L'OCR Tesseract va télécharger les images Gallica, les analyser, et stocker le texte dans R2. Compte ~3 secondes par page.
            </p>
            <label style={{fontSize:11, color:'rgba(237,232,219,0.6)', display:'block', marginBottom:8, fontWeight:700}}>Nombre de pages à OCRiser</label>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginBottom:14}}>
              {[20, 50, 200, 500].map(n => (
                <button key={n} onClick={()=>setOcrModal({...ocrModal, pages:n})}
                  style={{padding:'10px 6px', borderRadius:8, border:`1px solid ${ocrModal.pages === n ? project.color : 'rgba(255,255,255,0.1)'}`, background:ocrModal.pages === n ? `${project.color}20` : 'transparent', color:ocrModal.pages === n ? project.color : 'rgba(237,232,219,0.6)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {n}
                  <span style={{display:'block', fontSize:9, fontWeight:400, marginTop:2}}>~{Math.round(n*3/60)} min</span>
                </button>
              ))}
            </div>
            <input type="number" min="1" max="1000" value={ocrModal.pages}
              onChange={e=>setOcrModal({...ocrModal, pages:parseInt(e.target.value)||50})}
              style={{width:'100%', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:13, outline:'none', marginBottom:14, boxSizing:'border-box'}}
              placeholder="Valeur custom (1-1000)"/>
            <p style={{fontSize:10, color:'rgba(237,232,219,0.4)', margin:'0 0 14px', lineHeight:1.5}}>
              💡 Estimation : <strong>{Math.round(ocrModal.pages*3/60)} min</strong> pour {ocrModal.pages} pages.
            </p>
            <div style={{display:'flex', gap:8}}>
              <button onClick={()=>setOcrModal(null)}
                style={{flex:1, padding:'10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.6)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                Annuler
              </button>
              <button onClick={confirmerOcr}
                style={{flex:2, padding:'10px', borderRadius:8, border:'none', background:project.color, color:'#0D1B2A', fontSize:12, fontWeight:800, cursor:'pointer'}}>
                🚀 Lancer l'OCR ({ocrModal.pages} pages)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE LECTEUR */}
      {lecteurOuvert && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:1100, display:'flex', flexDirection:'column'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0, gap:14}}>
            <div style={{flex:1, minWidth:0}}>
              <h2 style={{fontSize:15, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>📖 {lecteurOuvert.titre}</h2>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>
                {lecteurOuvert.auteur && <span>{lecteurOuvert.auteur}</span>}
                {lecteurOuvert.auteur && lecteurOuvert.date && <span> · </span>}
                {lecteurOuvert.date && <span>{lecteurOuvert.date}</span>}
                {lecteurOuvert.theme && <span> · #{lecteurOuvert.theme}</span>}
                {' · '}
                <span style={{color:'rgba(237,232,219,0.4)'}}>{surlignagesDocument(lecteurOuvert.document_id).length} surlignages</span>
              </p>
            </div>
            <button onClick={fermerLecteur} style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', cursor:'pointer', color:'#EDE8DB', fontSize:13, fontWeight:700}}>
              ✕ Fermer
            </button>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, background:'rgba(255,255,255,0.02)'}}>
            <span style={{fontSize:11, fontWeight:700, color:'rgba(237,232,219,0.6)', textTransform:'uppercase', letterSpacing:'0.08em'}}>Couleur :</span>
            {COULEURS_SURLIGNAGE.map(c => (
              <button key={c.id} onClick={()=>setCouleurActive(c.id)}
                style={{padding:'5px 11px', borderRadius:8, border:`2px solid ${couleurActive === c.id ? c.border : 'transparent'}`, background:c.bg, color:'#EDE8DB', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s ease'}}>
                {c.emoji} {c.label}
              </button>
            ))}
            <button onClick={handleSurligner}
              style={{marginLeft:'auto', padding:'7px 14px', borderRadius:8, border:'none', background:project.color, color:'#0D1B2A', fontSize:11, fontWeight:800, cursor:'pointer'}}>
              ✨ Surligner la sélection
            </button>
          </div>

          <div style={{flex:1, display:'flex', overflow:'hidden'}}>
            <div style={{flex:1, overflowY:'auto', padding:'30px 60px', color:'#3D2E1F', fontFamily:"'Georgia', serif", fontSize:16, lineHeight:1.8, background:'#F4ECD8'}}>
              {lecteurLoading && (
                <div style={{textAlign:'center', padding:60}}>
                  <p style={{fontSize:40, margin:'0 0 12px'}}>⏳</p>
                  <p style={{fontSize:14, color:'rgba(61,46,31,0.6)', margin:0}}>Chargement du document depuis Cloudflare R2...</p>
                </div>
              )}
              {lecteurError && (
                <div style={{padding:30, background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:10}}>
                  <p style={{fontSize:13, color:'#C75B4E', margin:0}}>⚠️ {lecteurError}</p>
                </div>
              )}
              {!lecteurLoading && lecteurTexte && (() => {
                const formatted = formatTexteOCR(lecteurTexte)
                return (
                  <div style={{maxWidth:760, margin:'0 auto'}}>
                    {formatted.header.length > 0 && (
                      <div style={{padding:'18px 24px', background:'rgba(91,163,199,0.08)', border:'1px solid rgba(91,163,199,0.2)', borderRadius:10, marginBottom:32, fontFamily:'Inter, sans-serif', fontSize:13}}>
                        {formatted.header.map((line, i) => {
                          if (line.startsWith('#')) {
                            return <h1 key={i} style={{fontSize:18, fontWeight:700, color:'#3D2E1F', margin:'0 0 8px', fontFamily:'Georgia, serif'}}>{line.replace(/^#+\s*/, '')}</h1>
                          }
                          return <p key={i} style={{margin:'2px 0', color:'rgba(61,46,31,0.7)'}}>{line}</p>
                        })}
                      </div>
                    )}
                    {formatted.pages.map(p => (
                      <div key={`page_${p.num}`} style={{marginBottom:30}}>
                        <div style={{display:'flex', alignItems:'center', gap:10, margin:'24px 0 16px', opacity:0.5}}>
                          <div style={{flex:1, height:1, background:'rgba(61,46,31,0.3)'}}/>
                          <span style={{fontSize:10, fontWeight:700, color:'rgba(61,46,31,0.6)', textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif'}}>Page {p.num}</span>
                          <div style={{flex:1, height:1, background:'rgba(61,46,31,0.3)'}}/>
                        </div>
                        {p.paragraphes.length === 0 ? (
                          <p style={{fontSize:12, color:'rgba(61,46,31,0.4)', fontStyle:'italic', textAlign:'center', margin:'12px 0'}}>(page sans texte OCR exploitable)</p>
                        ) : (
                          p.paragraphes.map((para, idx) => (
                            <p key={idx} style={{margin:'0 0 14px', textAlign:'justify', textIndent:24}}>{para}</p>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div style={{width:300, borderLeft:'1px solid rgba(255,255,255,0.08)', overflowY:'auto', padding:'20px 16px', flexShrink:0}}>
              <h3 style={{fontSize:11, fontWeight:700, color:'rgba(237,232,219,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 14px'}}>
                ✨ Surlignages ({surlignagesDocument(lecteurOuvert.document_id).length})
              </h3>
              {surlignagesDocument(lecteurOuvert.document_id).length === 0 ? (
                <div style={{padding:'30px 14px', textAlign:'center', color:'rgba(237,232,219,0.3)'}}>
                  <p style={{fontSize:30, margin:'0 0 8px'}}>✨</p>
                  <p style={{fontSize:11, margin:'0 0 4px', fontWeight:700}}>Aucun surlignage</p>
                  <p style={{fontSize:10, margin:0, lineHeight:1.5}}>Sélectionne du texte puis clique sur "✨ Surligner la sélection"</p>
                </div>
              ) : (
                surlignagesDocument(lecteurOuvert.document_id).map(h => {
                  const c = COULEURS_SURLIGNAGE.find(col => col.id === h.couleur) || COULEURS_SURLIGNAGE[0]
                  const menuId = 'sur_' + h.id
                  const menuOpen = menuTransferOuvert === menuId
                  return (
                    <div key={h.id} style={{background:c.bg, border:`1px solid ${c.border}40`, borderLeft:`3px solid ${c.border}`, borderRadius:8, padding:'10px 12px', marginBottom:8, position:'relative'}}>
                      <button onClick={()=>supprimerSurlignage(h.id)} style={{position:'absolute', top:5, right:5, background:'transparent', border:'none', color:'rgba(237,232,219,0.5)', fontSize:12, cursor:'pointer', padding:'2px 4px', lineHeight:1}}>✕</button>
                      <p style={{fontSize:10, color:c.border, fontWeight:700, margin:'0 0 4px'}}>{c.emoji} {c.label}</p>
                      <p style={{fontSize:11, color:'#EDE8DB', margin:'0 0 6px', lineHeight:1.5, paddingRight:14, fontStyle:'italic'}}>
                        "{h.texte_surligne.length > 200 ? h.texte_surligne.slice(0,200) + '...' : h.texte_surligne}"
                      </p>
                      <div style={{position:'relative', display:'inline-block'}}>
                        <button onClick={()=>setMenuTransferOuvert(menuOpen ? null : menuId)}
                          style={{fontSize:9, padding:'3px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(0,0,0,0.3)', color:'#EDE8DB', fontWeight:700, cursor:'pointer'}}>
                          ➕ Ajouter au script
                        </button>
                        {menuOpen && (
                          <div style={{position:'absolute', top:'100%', left:0, marginTop:4, background:'#1a1d24', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, padding:4, zIndex:1200, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth:130}}>
                            <button onClick={()=>ajouterSurlignageAuScript('contenu', h)}
                              style={{display:'block', width:'100%', textAlign:'left', padding:'6px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:4}}>
                              → Contenu
                            </button>
                            <button onClick={()=>ajouterSurlignageAuScript('studia', h)}
                              style={{display:'block', width:'100%', textAlign:'left', padding:'6px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:4}}>
                              → Stud'IA
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VUE RECHERCHE */}
      {vueActive === 'recherche' && (
        <div style={{display:'flex', gap:20, flex:1, overflow:'hidden', minHeight:0}}>

          <div style={{flex:1, display:'flex', flexDirection:'column', gap:10, overflow:'hidden', minWidth:0}}>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, gap:14}}>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0, flex:1}}>
                {sourceConfig.description} · Cloudflare R2
                {!apiKey && <span style={{color:'#C75B4E', marginLeft:8, fontWeight:700}}>⚠️ Clé Doppler manquante</span>}
              </p>
              <button onClick={()=>setHistoriqueModal(true)}
                style={{padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(237,232,219,0.7)', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
                📜 Historique ({historiqueProjet.length})
              </button>
              <button onClick={()=>setSourcesModal(true)} style={{padding:'6px 12px', borderRadius:8, border:`1px solid ${project.color}40`, background:`${project.color}15`, color:project.color, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
                ⚙️ Gérer les sources
              </button>
            </div>

            <div style={{display:'flex', gap:0, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:3, flexShrink:0}}>
              {SOURCES.map(s => {
                const isActive = sourceActive === s.id
                return (
                  <button key={s.id} onClick={()=>handleChangeSource(s.id)}
                    style={{flex:1, padding:'9px 8px', borderRadius:8, border:'none', background:isActive ? s.color : 'transparent', color:isActive ? '#0D1B2A' : 'rgba(237,232,219,0.6)', fontSize:11, fontWeight:800, cursor:'pointer', transition:'all 0.15s ease', display:'flex', alignItems:'center', justifyContent:'center', gap:5}}>
                    <span style={{fontSize:13}}>{s.icon}</span>
                    <span style={{whiteSpace:'nowrap'}}>{s.label}</span>
                  </button>
                )
              })}
            </div>

            <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'12px 14px', flexShrink:0}}>
              <div style={{display:'flex', gap:8, marginBottom:10}}>
                <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleSearch()}}
                  placeholder={sourceConfig.placeholder}
                  style={{flex:1, padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:13, outline:'none', fontFamily:"'Nunito Sans',sans-serif"}}/>
                <button onClick={handleSearch} disabled={loading || !apiKey}
                  style={{padding:'10px 20px', borderRadius:10, border:'none', background:loading ? `${project.color}40` : project.color, color:'#0D1B2A', fontSize:12, fontWeight:800, cursor:loading || !apiKey ? 'not-allowed' : 'pointer', opacity:!apiKey ? 0.5 : 1, whiteSpace:'nowrap'}}>
                  {loading ? '⏳ Recherche...' : '🔍 Chercher'}
                </button>
              </div>

              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <label style={{fontSize:11, color:'rgba(237,232,219,0.5)', fontWeight:700, whiteSpace:'nowrap'}}>Thème R2 :</label>
                <input value={theme} onChange={e=>setTheme(e.target.value)} placeholder="ovnis, stavisky, 1968…"
                  style={{flex:1, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:12, outline:'none'}}/>
                <button onClick={()=>setFiltresOuverts(!filtresOuverts)}
                  style={{background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(237,232,219,0.6)', fontSize:11, fontWeight:700, cursor:'pointer', padding:'7px 10px', borderRadius:8, whiteSpace:'nowrap'}}>
                  {filtresOuverts ? '▼' : '▶'} Filtres
                </button>
              </div>

              {filtresOuverts && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                  {sourceConfig.supportsDates && (
                    <div>
                      <label style={{fontSize:9, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700}}>Période</label>
                      <div style={{display:'flex', gap:6, alignItems:'center'}}>
                        <input type="number" value={dateDebut} onChange={e=>setDateDebut(e.target.value)} min="1800" max="2025"
                          style={{flex:1, padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}/>
                        <span style={{fontSize:10, color:'rgba(237,232,219,0.3)'}}>→</span>
                        <input type="number" value={dateFin} onChange={e=>setDateFin(e.target.value)} min="1800" max="2025"
                          style={{flex:1, padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}/>
                      </div>
                    </div>
                  )}
                  {sourceConfig.supportsTypeDoc && (
                    <div>
                      <label style={{fontSize:9, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700}}>Type de document</label>
                      <select value={typeDoc} onChange={e=>setTypeDoc(e.target.value)}
                        style={{width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                        {sourceConfig.typeDocOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  )}
                  {sourceConfig.supportsLang && (
                    <div>
                      <label style={{fontSize:9, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700}}>Langue</label>
                      <select value={lang} onChange={e=>setLang(e.target.value)}
                        style={{width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                        {LANGUES_WIKI.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div style={{background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:8, padding:'8px 12px', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <p style={{fontSize:11, color:'#C75B4E', margin:0}}>⚠️ {error}</p>
                <button onClick={()=>setError(null)} style={{background:'transparent', border:'none', color:'#C75B4E', cursor:'pointer', fontSize:14, padding:0}}>✕</button>
              </div>
            )}

            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, padding:'0 4px'}}>
              <p style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0}}>
                {searched ? `${sourceConfig.label} — ${results.length} affichés sur ${totalHits.toLocaleString('fr-FR')} trouvés` : `Lance une recherche dans ${sourceConfig.label}`}
              </p>
              {searched && results.length>0 && (
                <p style={{fontSize:10, color:'rgba(91,199,138,0.7)', margin:0}}>
                  {hasMore ? `📄 Page ${currentPage}` : '✅ Tous affichés'}
                </p>
              )}
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:8, overflowY:'auto', paddingRight:6, flex:'1 1 auto', minHeight:0, scrollbarWidth:'thin', scrollbarColor:`${project.color}60 rgba(255,255,255,0.05)`}}>
              {loading && (
                <div style={{padding:40, textAlign:'center', color:'rgba(237,232,219,0.5)'}}>
                  <p style={{fontSize:28, margin:'0 0 8px'}}>⏳</p>
                  <p style={{fontSize:13, margin:0}}>Recherche dans {sourceConfig.label}…</p>
                </div>
              )}
              {!loading && !searched && (
                <div style={{padding:60, textAlign:'center', color:'rgba(237,232,219,0.3)'}}>
                  <p style={{fontSize:40, margin:'0 0 12px'}}>{sourceConfig.icon}</p>
                  <p style={{fontSize:14, margin:'0 0 6px', fontWeight:700}}>Aucune recherche dans {sourceConfig.label}</p>
                </div>
              )}
              {!loading && searched && results.length===0 && !error && (
                <div style={{padding:40, textAlign:'center', color:'rgba(237,232,219,0.4)'}}>
                  <p style={{fontSize:28, margin:'0 0 8px'}}>🔎</p>
                  <p style={{fontSize:13, margin:0}}>Aucun résultat pour "{query}"</p>
                </div>
              )}

              {!loading && results.map((r, idx) => {
                let borderColor = sourceConfig.color
                let tendanceLabel = null
                if (r.source === 'gallica') {
                  const journalDetecte = Object.keys(TENDANCES).find(j => (r.titre || '').includes(j) || (r.editeur || '').includes(j))
                  if (journalDetecte) {
                    const t = tendancePour(journalDetecte)
                    borderColor = t.couleur
                    tendanceLabel = t.label
                  }
                }
                const isFav = estFavori(r.id)
                const canOcr = r.source === 'gallica' && r.type_doc && r.type_doc.toLowerCase().includes('monograph')
                const menuId = 'res_' + r.id + '_' + idx
                const menuOpen = menuTransferOuvert === menuId

                return (
                  <div key={`${r.id}_${idx}`} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', borderLeft:`4px solid ${borderColor}`, display:'flex', gap:12, flexShrink:0}}>
                    {r.thumbnail && (
                      <img src={r.thumbnail} alt="" style={{width:56, height:74, objectFit:'cover', borderRadius:5, flexShrink:0, background:'rgba(0,0,0,0.3)'}} onError={e=>{e.target.style.display='none'}}/>
                    )}
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5, gap:10}}>
                        <h4 style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:0, lineHeight:1.4, flex:1}}>
                          <span style={{color:'rgba(237,232,219,0.3)', fontSize:10, marginRight:6}}>#{idx+1}</span>
                          {r.titre}
                        </h4>
                        <button onClick={()=>toggleFavori(r)} title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          style={{background:'transparent', border:'none', color:isFav ? '#D4A853' : 'rgba(237,232,219,0.3)', fontSize:18, cursor:'pointer', padding:0, lineHeight:1, transition:'color 0.2s'}}>
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>

                      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6, fontSize:10, flexWrap:'wrap'}}>
                        {r.auteur && (<><span style={{color:'rgba(237,232,219,0.7)', fontWeight:700}}>{r.auteur}</span><span style={{color:'rgba(237,232,219,0.3)'}}>·</span></>)}
                        {r.date && (<><span style={{color:'rgba(237,232,219,0.5)'}}>{r.date}</span><span style={{color:'rgba(237,232,219,0.3)'}}>·</span></>)}
                        {r.editeur && (<><span style={{color:'rgba(237,232,219,0.5)'}}>{r.editeur}</span></>)}
                        {r.type_doc && <span style={{fontSize:9, color:'rgba(237,232,219,0.4)', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>{r.type_doc}</span>}
                        {tendanceLabel && (<span style={{fontSize:9, color:borderColor, background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>{tendanceLabel}</span>)}
                      </div>

                      {r.snippet && (<p style={{fontSize:11, color:'rgba(237,232,219,0.6)', lineHeight:1.5, margin:'0 0 8px'}}>{r.snippet}</p>)}

                      <div style={{display:'flex', gap:5, flexWrap:'wrap', position:'relative'}}>
                        <a href={r.url_gallica} target="_blank" rel="noopener noreferrer"
                          style={{padding:'4px 9px', borderRadius:6, border:`1px solid ${project.color}40`, background:`${project.color}10`, color:project.color, fontSize:10, fontWeight:700, cursor:'pointer', textDecoration:'none'}}>
                          📖 {r.source === 'gallica' ? 'Lire sur Gallica' : r.source === 'wikipedia' ? 'Lire sur Wikipedia' : r.source === 'archive' ? 'Voir sur Archive' : 'Ouvrir le papier'}
                        </a>
                        <button onClick={()=>handleDownload(r)} disabled={downloadStatus[r.id]==='loading' || downloadStatus[r.id]==='ok'} style={getDownloadButtonStyle(r.id)}>
                          {getDownloadButtonLabel(r.id)}
                        </button>
                        {canOcr && (
                          <button onClick={()=>handleStartOcr(r)}
                            style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(212,168,83,0.4)', background:'rgba(212,168,83,0.1)', color:'#D4A853', fontSize:10, fontWeight:700, cursor:'pointer'}}>
                            🔬 OCR Tesseract
                          </button>
                        )}

                        <div style={{position:'relative', display:'inline-block'}}>
                          <button onClick={()=>setMenuTransferOuvert(menuOpen ? null : menuId)}
                            style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(91,199,138,0.4)', background:'rgba(91,199,138,0.1)', color:'#5BC78A', fontSize:10, fontWeight:700, cursor:'pointer'}}>
                            ➕ Script
                          </button>
                          {menuOpen && (
                            <div style={{position:'absolute', top:'100%', left:0, marginTop:4, background:'#1a1d24', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, padding:4, zIndex:1200, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth:130}}>
                              <button onClick={()=>ajouterResultatAuScript('contenu', r)}
                                style={{display:'block', width:'100%', textAlign:'left', padding:'6px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:4}}>
                                → Contenu
                              </button>
                              <button onClick={()=>ajouterResultatAuScript('studia', r)}
                                style={{display:'block', width:'100%', textAlign:'left', padding:'6px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:4}}>
                                → Stud'IA
                              </button>
                            </div>
                          )}
                        </div>

                        <button onClick={()=>navigator.clipboard.writeText(`${r.titre} — ${r.auteur || 'Anonyme'} (${r.date || 'n.d.'}). ${r.url_gallica}`)}
                          style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', fontSize:10, cursor:'pointer'}}>
                          📋 Copier
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {!loading && results.length > 0 && hasMore && (
                <div style={{padding:'12px 0', display:'flex', justifyContent:'center', flexShrink:0}}>
                  <button onClick={handleLoadMore} disabled={loadingMore}
                    style={{padding:'12px 28px', borderRadius:10, border:`1px solid ${sourceConfig.color}60`, background:loadingMore ? `${sourceConfig.color}20` : `${sourceConfig.color}15`, color:sourceConfig.color, fontSize:12, fontWeight:800, cursor:loadingMore ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:8}}>
                    {loadingMore ? '⏳ Chargement…' : `↓ Charger 50 résultats de plus (${results.length} / ${totalHits.toLocaleString('fr-FR')})`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* COLONNE DROITE */}
          <div style={{width:280, display:'flex', flexDirection:'column', gap:10, flexShrink:0, overflow:'hidden'}}>
            {jobsActifs.length > 0 && (
              <div style={{background:'rgba(212,168,83,0.08)', border:'1px solid rgba(212,168,83,0.3)', borderRadius:10, padding:'10px 12px', flexShrink:0}}>
                <h3 style={{fontSize:10, fontWeight:700, color:'#D4A853', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px'}}>🔬 OCR en cours ({jobsActifs.length})</h3>
                {jobsActifs.map(j => (
                  <div key={j.job_id} style={{marginBottom:8, paddingBottom:6, borderBottom:'1px solid rgba(212,168,83,0.15)'}}>
                    <p style={{fontSize:10, color:'#EDE8DB', margin:'0 0 3px', fontWeight:700, lineHeight:1.3}}>
                      {j.document_titre.length > 40 ? j.document_titre.slice(0,40) + '…' : j.document_titre}
                    </p>
                    <div style={{height:6, background:'rgba(0,0,0,0.3)', borderRadius:3, overflow:'hidden', marginBottom:3}}>
                      <div style={{height:'100%', width:`${j.progress || 0}%`, background:'#D4A853', transition:'width 0.3s'}}/>
                    </div>
                    <p style={{fontSize:9, color:'rgba(237,232,219,0.6)', margin:0}}>{j.pages_done || 0} / {j.total_pages} pages · {j.progress || 0}%</p>
                  </div>
                ))}
              </div>
            )}

            {jobsDone.length > 0 && (
              <div style={{background:'rgba(91,199,138,0.05)', border:'1px solid rgba(91,199,138,0.2)', borderRadius:10, padding:'10px 12px', flexShrink:0, maxHeight:200, overflowY:'auto'}}>
                <h3 style={{fontSize:10, fontWeight:700, color:'#5BC78A', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px'}}>✅ OCR terminés ({jobsDone.length})</h3>
                {jobsDone.map(j => {
                  const surlignagesCount = surlignagesDocument(j.document_id).length
                  return (
                    <div key={j.job_id} style={{marginBottom:8, paddingBottom:8, borderBottom:'1px solid rgba(91,199,138,0.15)'}}>
                      <p style={{fontSize:10, color:'#EDE8DB', margin:'0 0 4px', fontWeight:700, lineHeight:1.3}}>
                        {j.document_titre.length > 35 ? j.document_titre.slice(0,35) + '…' : j.document_titre}
                      </p>
                      <p style={{fontSize:9, color:'rgba(237,232,219,0.5)', margin:'0 0 5px'}}>
                        {j.pages_done} pages · {Math.round((j.bytes_total || 0)/1024)} Ko
                      </p>
                      <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                        {j.r2_key && (
                          <button onClick={()=>ouvrirLecteur({titre: j.document_titre, source: 'gallica', r2_key: j.r2_key, document_id: j.document_id, theme: j.theme || null, auteur: null, date: null})}
                            style={{fontSize:9, padding:'3px 7px', borderRadius:5, border:'none', background:'#5BC78A', color:'#0D1B2A', fontWeight:700, cursor:'pointer'}}>
                            📖 Lire
                            {surlignagesCount > 0 && <span style={{marginLeft:4, opacity:0.7}}>({surlignagesCount})</span>}
                          </button>
                        )}
                        <button onClick={()=>{
                          if(confirm('Retirer ce job de la liste ? Le texte reste dans R2.')) {
                            const newJobs = ocrJobs.filter(job => job.job_id !== j.job_id)
                            setOcrJobs(newJobs)
                            sauverStorage(OCR_JOBS_STORAGE_KEY, newJobs)
                          }}}
                          style={{fontSize:9, padding:'3px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', cursor:'pointer'}}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0}}>
              <h3 style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0}}>
                ⭐ Favoris {project?.id || 'general'} ({favorisProjet.length})
              </h3>
              {favoris.length > favorisProjet.length && (<span style={{fontSize:9, color:'rgba(237,232,219,0.3)'}}>+{favoris.length - favorisProjet.length} autres</span>)}
            </div>

            <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, paddingRight:4, scrollbarWidth:'thin', scrollbarColor:`${project.color}40 transparent`}}>
              {favorisProjet.length === 0 ? (
                <div style={{padding:'20px 12px', textAlign:'center', color:'rgba(237,232,219,0.3)', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px dashed rgba(255,255,255,0.08)'}}>
                  <p style={{fontSize:20, margin:'0 0 6px'}}>⭐</p>
                  <p style={{fontSize:11, margin:'0 0 3px', fontWeight:700}}>Aucun favori</p>
                </div>
              ) : (
                favorisProjet.map(f => {
                  const sourceConfigFav = SOURCES.find(s => s.id === f.source) || SOURCES[0]
                  let borderColor = sourceConfigFav.color
                  const ocrJob = ocrJobs.find(j => j.document_id === f.id && j.status === 'done')
                  const r2Key = f.r2_key || (ocrJob ? ocrJob.r2_key : null)
                  const surlignagesCount = surlignagesDocument(f.id).length

                  return (
                    <div key={f.id} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'8px 10px', borderLeft:`3px solid ${borderColor}`, flexShrink:0, position:'relative'}}>
                      <button onClick={()=>supprimerFavori(f.id)} title="Retirer des favoris"
                        style={{position:'absolute', top:6, right:6, background:'transparent', border:'none', color:'rgba(237,232,219,0.3)', fontSize:11, cursor:'pointer', padding:'2px 4px', lineHeight:1}}>✕</button>
                      <p style={{fontSize:11, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px', lineHeight:1.4, paddingRight:16}}>{f.titre}</p>
                      <p style={{fontSize:9, color:'rgba(237,232,219,0.4)', margin:'0 0 4px'}}>
                        <span style={{color:sourceConfigFav.color, fontWeight:700}}>{sourceConfigFav.icon} {sourceConfigFav.label}</span>
                        {f.auteur && <span> · {f.auteur.length > 20 ? f.auteur.slice(0,20)+'…' : f.auteur}</span>}
                        {f.date && <span> · {f.date}</span>}
                      </p>
                      {f.theme && (<p style={{fontSize:8, color:`${project.color}cc`, margin:'0 0 4px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>#{f.theme}</p>)}
                      <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                        {r2Key && (
                          <button onClick={()=>ouvrirLecteur({titre:f.titre, source:f.source, r2_key:r2Key, document_id:f.id, theme:f.theme, auteur:f.auteur, date:f.date})}
                            style={{fontSize:9, padding:'3px 7px', borderRadius:5, border:'none', background:project.color, color:'#0D1B2A', fontWeight:700, cursor:'pointer'}}>
                            📖 Lire
                            {surlignagesCount > 0 && <span style={{marginLeft:4, opacity:0.7}}>({surlignagesCount})</span>}
                          </button>
                        )}
                        <a href={f.url_gallica} target="_blank" rel="noopener noreferrer" style={{fontSize:9, color:'rgba(237,232,219,0.5)', textDecoration:'none', padding:'3px 6px'}}>↗ Source</a>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{height:1, background:'rgba(255,255,255,0.06)', flexShrink:0}}/>
            <p style={{fontSize:9, fontWeight:700, color:'rgba(237,232,219,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0, flexShrink:0}}>Actions</p>

            <button onClick={genererRapportIA}
              style={{padding:'9px 11px', borderRadius:8, border:'none', background:project.color, color:'#0D1B2A', fontSize:11, fontWeight:800, cursor:'pointer', textAlign:'left', flexShrink:0}}>
              ✨ Générer rapport IA ({surlignagesProjet.length} surlignages)
            </button>

            <div style={{padding:'9px 11px', background:'rgba(91,199,138,0.08)', border:'1px solid rgba(91,199,138,0.2)', borderRadius:8, flexShrink:0}}>
              <p style={{fontSize:10, fontWeight:700, color:'#5BC78A', margin:'0 0 4px'}}>✅ V6 SFPF integre</p>
              <p style={{fontSize:9, color:'rgba(237,232,219,0.5)', margin:0, lineHeight:1.5}}>
                Recherche + Biblio + Rapport + Historique + Transfer + Chat IA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VUE BIBLIOTHEQUE */}
      {vueActive === 'biblio' && (
        <div style={{flex:1, display:'flex', flexDirection:'column', gap:12, overflow:'hidden', minWidth:0}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, gap:14}}>
            <div>
              <h2 style={{fontSize:15, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px'}}>📚 Bibliothèque globale R2</h2>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>Tous les documents archivés, tous projets confondus</p>
            </div>
            <button onClick={chargerBibliotheque} disabled={biblioLoading || !apiKey}
              style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${project.color}40`, background:`${project.color}15`, color:project.color, fontSize:11, fontWeight:700, cursor:biblioLoading?'wait':'pointer', whiteSpace:'nowrap'}}>
              {biblioLoading ? '⏳ Chargement…' : '↻ Rafraîchir'}
            </button>
          </div>

          <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'12px 14px', flexShrink:0}}>
            <input value={biblioSearch} onChange={e=>setBiblioSearch(e.target.value)}
              placeholder="🔎 Rechercher dans les titres, auteurs, chemins…"
              style={{width:'100%', padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:10}}/>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:8}}>
              <select value={biblioFiltreProjet} onChange={e=>setBiblioFiltreProjet(e.target.value)}
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                <option value="">Tous les projets ({projetsUniques.length})</option>
                {projetsUniques.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={biblioFiltreTheme} onChange={e=>setBiblioFiltreTheme(e.target.value)}
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                <option value="">Tous les thèmes ({themesUniques.length})</option>
                {themesUniques.map(t => <option key={t} value={t}>#{t}</option>)}
              </select>
              <select value={biblioFiltreSource} onChange={e=>setBiblioFiltreSource(e.target.value)}
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                <option value="">Toutes les sources</option>
                {sourcesUniques.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8}}>
              <select value={biblioFiltreType} onChange={e=>setBiblioFiltreType(e.target.value)}
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}>
                {TYPES_FICHIERS_BIBLIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="date" value={biblioFiltreDateMin} onChange={e=>setBiblioFiltreDateMin(e.target.value)} title="Date min"
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}/>
              <input type="date" value={biblioFiltreDateMax} onChange={e=>setBiblioFiltreDateMax(e.target.value)} title="Date max"
                style={{padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:11, outline:'none'}}/>
              <button onClick={resetFiltresBiblio}
                style={{padding:'7px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.6)', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>✕ Reset</button>
            </div>
          </div>

          {biblioError && (
            <div style={{background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:8, padding:'8px 12px', flexShrink:0}}>
              <p style={{fontSize:11, color:'#C75B4E', margin:0}}>⚠️ {biblioError}</p>
            </div>
          )}

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, padding:'0 4px'}}>
            <p style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0}}>
              {biblioLoading ? 'Chargement de la bibliothèque…' : `${biblioGroupes.length} documents — ${biblioFichiersFiltres.length} fichiers sur ${biblioFichiers.length}`}
            </p>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:8, overflowY:'auto', paddingRight:6, flex:'1 1 auto', minHeight:0, scrollbarWidth:'thin', scrollbarColor:`${project.color}60 rgba(255,255,255,0.05)`}}>
            {biblioGroupes.map((g, idx) => {
              const meta = g.meta || {}
              const sourceConfigGr = SOURCES.find(s => s.id === meta.source) || SOURCES[0]
              const borderColor = sourceConfigGr.color
              return (
                <div key={g.docKey + '_' + idx} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', borderLeft:`4px solid ${borderColor}`, flexShrink:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:10}}>
                    <div style={{flex:1, minWidth:0}}>
                      <h4 style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:'0 0 4px', lineHeight:1.4}}>
                        <span style={{color:'rgba(237,232,219,0.3)', fontSize:10, marginRight:6}}>#{idx+1}</span>
                        {meta.titre || g.docKey.split('/').pop() || g.docKey}
                      </h4>
                      <div style={{display:'flex', alignItems:'center', gap:6, fontSize:10, flexWrap:'wrap'}}>
                        <span style={{color:sourceConfigGr.color, fontWeight:700}}>{sourceConfigGr.icon} {sourceConfigGr.label}</span>
                        {meta.auteur && (<><span style={{color:'rgba(237,232,219,0.3)'}}>·</span><span style={{color:'rgba(237,232,219,0.6)'}}>{meta.auteur}</span></>)}
                        {meta.date && (<><span style={{color:'rgba(237,232,219,0.3)'}}>·</span><span style={{color:'rgba(237,232,219,0.5)'}}>{meta.date}</span></>)}
                        {g.projet_id && <span style={{fontSize:9, color:project.color, background:`${project.color}15`, padding:'1px 6px', borderRadius:5, fontWeight:700}}>📁 {g.projet_id}</span>}
                        {g.theme && <span style={{fontSize:9, color:'#D4A853', background:'rgba(212,168,83,0.1)', padding:'1px 6px', borderRadius:5, fontWeight:700}}>#{g.theme}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:4, marginTop:8}}>
                    {g.fichiers.map(f => {
                      const type = detectTypeFichier(f.key, f.content_type)
                      const fileName = f.key.split('/').pop()
                      const menuOuvert = biblioMenuOuvert === f.key
                      return (
                        <div key={f.key} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'rgba(255,255,255,0.02)', borderRadius:6, fontSize:11, position:'relative'}}>
                          <span style={{fontSize:14}}>{iconePourType(type)}</span>
                          <span style={{flex:1, color:'rgba(237,232,219,0.8)', fontFamily:'monospace', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{fileName}</span>
                          <span style={{color:'rgba(237,232,219,0.4)', fontSize:9, whiteSpace:'nowrap'}}>{formatTaille(f.size)}</span>
                          <span style={{color:'rgba(237,232,219,0.4)', fontSize:9, whiteSpace:'nowrap'}}>{formatDateBiblio(f.last_modified)}</span>
                          <button onClick={()=>setBiblioMenuOuvert(menuOuvert ? null : f.key)}
                            style={{padding:'3px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.6)', fontSize:10, fontWeight:700, cursor:'pointer'}}>⋯</button>
                          {menuOuvert && (
                            <div style={{position:'absolute', top:'100%', right:0, marginTop:4, background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:4, zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth:160}}>
                              <button onClick={()=>ouvrirFichierR2(f)} style={{display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:5}}>
                                {type === 'text' ? '📖 Ouvrir dans le lecteur' : '↗ Ouvrir dans le navigateur'}
                              </button>
                              <button onClick={()=>telechargerFichierR2(f)} style={{display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none', background:'transparent', color:'#EDE8DB', fontSize:11, cursor:'pointer', borderRadius:5}}>📥 Télécharger</button>
                              <button onClick={()=>{navigator.clipboard.writeText(f.key); setBiblioMenuOuvert(null)}} style={{display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none', background:'transparent', color:'rgba(237,232,219,0.6)', fontSize:11, cursor:'pointer', borderRadius:5}}>📋 Copier la clé R2</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* BULLE CHAT (PHASE C) */}
      {!chatOuvert && (
        <button onClick={()=>setChatOuvert(true)}
          style={{position:'fixed', bottom:24, right:24, width:60, height:60, borderRadius:'50%', border:'none',
            background:project.color, color:'#0D1B2A', fontSize:26, cursor:'pointer', zIndex:900,
            boxShadow:'0 4px 16px rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center'}}>
          💬
        </button>
      )}

      {chatOuvert && (
        <div style={{position:'fixed', bottom:24, right:24, width:380, height:500, background:'#1a1d24',
          border:'1px solid rgba(255,255,255,0.15)', borderRadius:14, zIndex:900,
          boxShadow:'0 8px 32px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', overflow:'hidden'}}>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.2)', flexShrink:0}}>
            <div>
              <p style={{fontSize:13, fontWeight:800, color:'#EDE8DB', margin:'0 0 2px'}}>💬 Chat contextuel</p>
              <p style={{fontSize:9, color:'rgba(237,232,219,0.5)', margin:0}}>
                Projet : <strong style={{color:project.color}}>{project?.id || 'general'}</strong> · GPT-4o
              </p>
            </div>
            <div style={{display:'flex', gap:6}}>
              {chatMessages.length > 0 && (
                <button onClick={viderChat} title="Vider la conversation"
                  style={{padding:'4px 8px', borderRadius:6, border:'none', background:'rgba(199,91,78,0.15)', color:'#C75B4E', fontSize:11, cursor:'pointer'}}>
                  🗑️
                </button>
              )}
              <button onClick={()=>setChatOuvert(false)}
                style={{padding:'4px 10px', borderRadius:6, border:'none', background:'rgba(255,255,255,0.08)', color:'rgba(237,232,219,0.7)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                ✕
              </button>
            </div>
          </div>

          <div ref={chatEndRef} style={{flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10}}>
            {chatMessages.length === 0 && (
              <div style={{padding:'20px 12px', textAlign:'center', color:'rgba(237,232,219,0.4)'}}>
                <p style={{fontSize:30, margin:'0 0 8px'}}>💬</p>
                <p style={{fontSize:11, margin:'0 0 6px', fontWeight:700, color:'#EDE8DB'}}>Pose une question</p>
                <p style={{fontSize:10, margin:0, lineHeight:1.5}}>
                  J'ai accès aux résultats de recherche, favoris, surlignages et historique de ce projet.
                </p>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth:'85%',
                background: m.role === 'user' ? `${project.color}25` : (m.error ? 'rgba(199,91,78,0.15)' : 'rgba(255,255,255,0.05)'),
                border: `1px solid ${m.role === 'user' ? project.color+'40' : (m.error ? 'rgba(199,91,78,0.3)' : 'rgba(255,255,255,0.08)')}`,
                borderRadius:10, padding:'8px 12px'
              }}>
                <p style={{fontSize:11.5, color:'#EDE8DB', margin:0, lineHeight:1.55, whiteSpace:'pre-wrap'}}>{m.content}</p>
                {m.cost_eur && (
                  <p style={{fontSize:8, color:'rgba(237,232,219,0.4)', margin:'4px 0 0', fontFamily:'monospace'}}>
                    {m.cost_eur.toFixed(4)} €
                  </p>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{alignSelf:'flex-start', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px'}}>
                <p style={{fontSize:11.5, color:'rgba(237,232,219,0.6)', margin:0, fontStyle:'italic'}}>⏳ GPT-4o réfléchit…</p>
              </div>
            )}
          </div>

          <div style={{display:'flex', gap:6, padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.08)', flexShrink:0, background:'rgba(0,0,0,0.2)'}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey) {e.preventDefault(); envoyerMessageChat()}}}
              placeholder="Pose ta question…" disabled={chatLoading}
              style={{flex:1, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:12, outline:'none'}}/>
            <button onClick={envoyerMessageChat} disabled={chatLoading || !chatInput.trim()}
              style={{padding:'8px 14px', borderRadius:8, border:'none', background:chatLoading?'rgba(255,255,255,0.1)':project.color, color:chatLoading?'rgba(237,232,219,0.4)':'#0D1B2A', fontSize:13, fontWeight:800, cursor:chatLoading||!chatInput.trim()?'not-allowed':'pointer'}}>
              {chatLoading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import useApiKey from '../hooks/useApiKey'

// ═══════════════════════════════════════════════════════════════
//                       CONFIG & CONSTANTES
// ═══════════════════════════════════════════════════════════════
const AGENTS_API_URL = 'https://agents.vigie-officiel.com'
const FAVORIS_STORAGE_KEY = 'pilot_source_favoris'
const HIGHLIGHTS_STORAGE_KEY = 'pilot_source_highlights'
const OCR_JOBS_STORAGE_KEY = 'pilot_source_ocr_jobs'
const RESULTS_PER_PAGE = 50

// ── COULEURS SURLIGNEUR ─────────────────────────────────────────
const COULEURS_SURLIGNAGE = [
  { id:'jaune', label:'Important', emoji:'🟡', bg:'rgba(255, 215, 0, 0.4)', border:'#D4A853' },
  { id:'vert',  label:'Confirmé',  emoji:'🟢', bg:'rgba(91, 199, 138, 0.4)', border:'#5BC78A' },
  { id:'rouge', label:'Attention', emoji:'🔴', bg:'rgba(199, 91, 78, 0.4)', border:'#C75B4E' },
  { id:'bleu',  label:'Citation',  emoji:'🔵', bg:'rgba(91, 163, 199, 0.4)', border:'#5BA3C7' },
]

// ── SOURCES ─────────────────────────────────────────────────────
const SOURCES = [
  {
    id:'gallica', label:'Gallica BnF', icon:'📰',
    description:'Archives presse + livres français (avec OCR Tesseract intégré)',
    placeholder:'soucoupes volantes, Dreyfus, 1968…',
    supportsDates:true, supportsTypeDoc:true,
    typeDocOptions:[
      {value:'',label:'Tous'},
      {value:'fascicule',label:'Presse / fascicules'},
      {value:'monographie',label:'Livres / monographies'},
      {value:'image',label:'Images'},
      {value:'manuscrit',label:'Manuscrits'},
    ],
    supportsTendance:true, color:'#5BA3C7',
  },
  {
    id:'wikipedia', label:'Wikipedia', icon:'📚',
    description:'Encyclopédie universelle multilingue',
    placeholder:'Phénomènes paranormaux, histoire, science…',
    supportsDates:false, supportsTypeDoc:false,
    supportsTendance:false, supportsLang:true, color:'#9CA3AF',
  },
  {
    id:'openalex', label:'OpenAlex', icon:'🔬',
    description:'250M publications scientifiques peer-reviewed',
    placeholder:'quantum mechanics, climate change, UAP…',
    supportsDates:true, supportsTypeDoc:true,
    typeDocOptions:[
      {value:'',label:'Tous'},
      {value:'article',label:'Articles'},
      {value:'book',label:'Livres'},
      {value:'preprint',label:'Preprints'},
      {value:'review',label:'Reviews'},
    ],
    supportsTendance:false, color:'#5BC78A',
  },
  {
    id:'archive', label:'Internet Archive', icon:'📖',
    description:'Livres domaine public (XIXe siècle, début XXe)',
    placeholder:'dracula, madame bovary, hugo, verne…',
    supportsDates:true, supportsTypeDoc:false,
    supportsTendance:false, color:'#D4A853',
  },
]

// ── TENDANCES POLITIQUES JOURNAUX ────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
//                       HELPERS LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
//                       COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function PageSource({ project }) {
  const apiKey = useApiKey('agents doppler')

  // Source active
  const [sourceActive, setSourceActive] = useState('gallica')
  const sourceConfig = SOURCES.find(s => s.id === sourceActive)

  // Recherche
  const [query, setQuery] = useState('')
  const [dateDebut, setDateDebut] = useState('1900')
  const [dateFin, setDateFin] = useState('1960')
  const [lang, setLang] = useState('fr')
  const [tendances, setTendances] = useState([])
  const [typeDoc, setTypeDoc] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)
  const [sourcesModal, setSourcesModal] = useState(false)

  // Résultats
  const [results, setResults] = useState([])
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastSearchParams, setLastSearchParams] = useState(null)

  // Téléchargement R2
  const [theme, setTheme] = useState('')
  const [downloadStatus, setDownloadStatus] = useState({})

  // Favoris persistants
  const [favoris, setFavoris] = useState(() => chargerStorage(FAVORIS_STORAGE_KEY))

  // OCR Jobs (persistant + polling)
  const [ocrJobs, setOcrJobs] = useState(() => chargerStorage(OCR_JOBS_STORAGE_KEY))
  const [ocrModal, setOcrModal] = useState(null) // {result, pages} pour modale OCR
  const pollIntervalRef = useRef(null)

  // Lecteur modal
  const [lecteurOuvert, setLecteurOuvert] = useState(null) // { titre, source, key, ...}
  const [lecteurTexte, setLecteurTexte] = useState('')
  const [lecteurLoading, setLecteurLoading] = useState(false)
  const [lecteurError, setLecteurError] = useState(null)

  // Surlignages (par favori/document)
  const [highlights, setHighlights] = useState(() => chargerStorage(HIGHLIGHTS_STORAGE_KEY))
  const [couleurActive, setCouleurActive] = useState('jaune')

  // ── EFFETS ────────────────────────────────────────────────────

  // Sync localStorage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === FAVORIS_STORAGE_KEY) setFavoris(chargerStorage(FAVORIS_STORAGE_KEY))
      if (e.key === HIGHLIGHTS_STORAGE_KEY) setHighlights(chargerStorage(HIGHLIGHTS_STORAGE_KEY))
      if (e.key === OCR_JOBS_STORAGE_KEY) setOcrJobs(chargerStorage(OCR_JOBS_STORAGE_KEY))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Polling OCR jobs en cours
  useEffect(() => {
    const jobsEnCours = ocrJobs.filter(j => j.status === 'pending' || j.status === 'running')
    if (jobsEnCours.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }
    if (pollIntervalRef.current) return // déjà en cours

    pollIntervalRef.current = setInterval(async () => {
      if (!apiKey) return
      const updatedJobs = [...ocrJobs]
      let changed = false
      for (let i = 0; i < updatedJobs.length; i++) {
        const job = updatedJobs[i]
        if (job.status === 'pending' || job.status === 'running') {
          try {
            const response = await fetch(
              `${AGENTS_API_URL}/sources/gallica/ocr/status?job_id=${job.job_id}`,
              { headers: { 'X-API-Key': apiKey } }
            )
            if (response.ok) {
              const data = await response.json()
              updatedJobs[i] = { ...job, ...data, last_check: new Date().toISOString() }
              changed = true
            }
          } catch (err) {
            console.error('[OCR] Erreur polling:', err)
          }
        }
      }
      if (changed) {
        setOcrJobs(updatedJobs)
        sauverStorage(OCR_JOBS_STORAGE_KEY, updatedJobs)
      }
    }, 5000) // toutes les 5 sec

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [ocrJobs, apiKey])

  // ── HELPERS FAVORIS ───────────────────────────────────────────
  const favorisProjet = favoris.filter(f => f.projet_id === (project?.id || 'general'))
  const estFavori = (resultId) => favoris.some(f => f.id === resultId)

  const toggleFavori = (result) => {
    let newFavoris
    if (estFavori(result.id)) {
      newFavoris = favoris.filter(f => f.id !== result.id)
    } else {
      const fav = {
        id: result.id,
        titre: result.titre,
        auteur: result.auteur || null,
        date: result.date || null,
        editeur: result.editeur || null,
        type_doc: result.type_doc || null,
        url_gallica: result.url_gallica,
        thumbnail: result.thumbnail || null,
        source: result.source || sourceActive,
        ocr_quality: result.ocr_quality ?? null,
        snippet: result.snippet || null,
        doi: result.doi || null,
        pdf_url: result.pdf_url || null,
        open_access: result.open_access ?? null,
        archive_identifier: result.archive_identifier || null,
        is_borrowable: result.is_borrowable ?? null,
        projet_id: project?.id || 'general',
        theme: theme.trim() || null,
        ajoute_le: new Date().toISOString(),
        r2_key: null, // sera rempli quand téléchargé
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
    setSourceActive(newSource)
    setResults([])
    setTotalHits(0)
    setSearched(false)
    setError(null)
    setCurrentPage(1)
    setLastSearchParams(null)
  }

  // ── HELPERS SURLIGNAGES ───────────────────────────────────────
  const surlignagesDocument = (docId) => highlights.filter(h => h.document_id === docId)

  const ajouterSurlignage = (docId, texte, couleur, note='') => {
    const newHighlight = {
      id: uuid(),
      document_id: docId,
      texte_surligne: texte,
      couleur: couleur,
      note: note,
      projet_id: project?.id || 'general',
      theme: lecteurOuvert?.theme || null,
      ajoute_le: new Date().toISOString(),
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

  // ── RECHERCHE ─────────────────────────────────────────────────
  const buildSearchBody = (page=1) => {
    const body = {
      query: query.trim(),
      source: sourceActive,
      max_results: RESULTS_PER_PAGE,
      start_record: (page - 1) * RESULTS_PER_PAGE + 1,
    }
    if (sourceConfig.supportsDates) {
      if (dateDebut) body.date_debut = dateDebut
      if (dateFin) body.date_fin = dateFin
    }
    if (sourceConfig.supportsTypeDoc && typeDoc) body.type_doc = typeDoc
    if (sourceConfig.supportsLang) body.lang = lang
    return body
  }

  const handleSearch = async () => {
    if (!query.trim()) { setError('Saisis un terme de recherche'); return }
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }

    setLoading(true)
    setError(null)
    setSearched(true)
    setResults([])
    setTotalHits(0)
    setCurrentPage(1)

    const body = buildSearchBody(1)
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
      setResults(data.results || [])
      setTotalHits(data.total || 0)
    } catch (err) {
      console.error('[Source] Erreur recherche:', err)
      setError(err.message || 'Erreur recherche')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = async () => {
    if (!lastSearchParams || loadingMore) return
    const nextPage = currentPage + 1
    setLoadingMore(true)
    setError(null)
    const body = {...lastSearchParams, start_record: (nextPage - 1) * RESULTS_PER_PAGE + 1}
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

  // ── TELECHARGEMENT R2 ──────────────────────────────────────────
  const handleDownload = async (result) => {
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }
    if (!theme.trim()) { setError('Indique un theme dans le champ ci-dessus (ex: ovnis, stavisky, 1968)'); return }

    const docId = result.id
    setDownloadStatus(prev => ({...prev, [docId]: 'loading'}))
    setError(null)

    try {
      const body = {
        url_gallica: result.url_gallica,
        titre: result.titre,
        projet_id: project?.id || 'general',
        theme: theme.trim().toLowerCase(),
        auteur: result.auteur || '',
        date: result.date || '',
        source: result.source || sourceActive,
        type_telechargement: 'both',
        archive_identifier: result.archive_identifier || null,
      }
      const response = await fetch(`${AGENTS_API_URL}/sources/telecharger`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      console.log('[Source] Telechargement OK:', data)
      setDownloadStatus(prev => ({...prev, [docId]: 'ok'}))

      // Si c'est un favori, on sauvegarde la r2_key (premier fichier .txt si dispo)
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

  // ── LANCEMENT OCR GALLICA ─────────────────────────────────────
  const handleStartOcr = (result) => {
    if (!apiKey) { setError('Cle API Agents Doppler introuvable'); return }
    if (!theme.trim()) { setError('Indique un theme dans le champ ci-dessus'); return }
    if (result.source !== 'gallica') { setError('OCR uniquement pour Gallica'); return }
    const arkMatch = result.url_gallica.match(/\/([a-z0-9]+)$/)
    if (!arkMatch) { setError('URL Gallica invalide'); return }
    // Ouvre la modale OCR avec le résultat
    setOcrModal({ result, ark_id: arkMatch[1], pages: 50 })
  }

  const confirmerOcr = async () => {
    if (!ocrModal) return
    const { result, ark_id, pages } = ocrModal
    setOcrModal(null)
    setError(null)

    try {
      const response = await fetch(`${AGENTS_API_URL}/sources/gallica/ocr/start`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({
          ark_id,
          titre: result.titre,
          projet_id: project?.id || 'general',
          theme: theme.trim().toLowerCase(),
          auteur: result.auteur || '',
          date: result.date || '',
          max_pages: Math.min(pages, 1000),
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      const newJob = {
        ...data,
        progress: 0, pages_done: 0,
        document_id: result.id,
        document_titre: result.titre,
        ark_id,
        max_pages: Math.min(pages, 1000),
        cree_le: new Date().toISOString(),
      }
      const newJobs = [newJob, ...ocrJobs]
      setOcrJobs(newJobs)
      sauverStorage(OCR_JOBS_STORAGE_KEY, newJobs)
    } catch (err) {
      console.error('[Source] Erreur OCR:', err)
      setError(`OCR échoué : ${err.message}`)
    }
  }

  // ── LECTEUR : OUVRIR DOC ──────────────────────────────────────
  const ouvrirLecteur = async (docInfo) => {
    // docInfo = { titre, source, r2_key, document_id, theme, auteur, date }
    setLecteurOuvert(docInfo)
    setLecteurTexte('')
    setLecteurError(null)
    setLecteurLoading(true)

    try {
      // Demande URL présignée
      const response = await fetch(`${AGENTS_API_URL}/sources/r2/presigned-url`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({key: docInfo.r2_key, expires_in: 3600}),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }
      const data = await response.json()
      // Télécharge le texte depuis Cloudflare R2 directement
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
    setLecteurOuvert(null)
    setLecteurTexte('')
    setLecteurError(null)
  }

  // ── SURLIGNER LA SELECTION DU LECTEUR ─────────────────────────
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

  // ── HELPERS UI ─────────────────────────────────────────────────
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
    <div style={{display:'flex', gap:20, height:'100%', overflow:'hidden'}}>

      {/* ═════ MODALE GESTION SOURCES ═════ */}
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
            <p style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px'}}>Sources actives</p>
            {SOURCES.map(s => (
              <div key={s.id} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{flex:1}}>
                  <p style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:'0 0 2px'}}>
                    {s.icon} {s.label}
                  </p>
                  <p style={{fontSize:11, color:'rgba(237,232,219,0.4)', margin:0}}>{s.description}</p>
                </div>
                <span style={{fontSize:10, color:'#5BC78A', fontWeight:700, whiteSpace:'nowrap', marginLeft:12}}>✅ Actif</span>
              </div>
            ))}
            <p style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'18px 0 8px'}}>À venir</p>
            <div style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:10, padding:'16px 14px', marginBottom:10}}>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:'0 0 6px', lineHeight:1.5}}>
                Wikisource, Europe PMC, INSEE, Légifrance, GEIPAN, et 15+ autres sources gratuites.
              </p>
              <p style={{fontSize:10, color:'rgba(237,232,219,0.3)', margin:0, fontStyle:'italic'}}>
                Sources custom utilisateur (URL + clé API) également prévues.
              </p>
            </div>
          </div>
        </div>
      )}
{/* ═════ MODALE OCR ═════ */}
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

            <label style={{fontSize:11, color:'rgba(237,232,219,0.6)', display:'block', marginBottom:8, fontWeight:700}}>
              Nombre de pages à OCRiser
            </label>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginBottom:14}}>
              {[20, 50, 200, 500].map(n => (
                <button key={n} onClick={()=>setOcrModal({...ocrModal, pages:n})}
                  style={{padding:'10px 6px', borderRadius:8, border:`1px solid ${ocrModal.pages === n ? project.color : 'rgba(255,255,255,0.1)'}`, background:ocrModal.pages === n ? `${project.color}20` : 'transparent', color:ocrModal.pages === n ? project.color : 'rgba(237,232,219,0.6)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {n}
                  <span style={{display:'block', fontSize:9, fontWeight:400, marginTop:2}}>
                    ~{Math.round(n*3/60)} min
                  </span>
                </button>
              ))}
            </div>

            <input type="number" min="1" max="1000" value={ocrModal.pages}
              onChange={e=>setOcrModal({...ocrModal, pages:parseInt(e.target.value)||50})}
              style={{width:'100%', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:13, outline:'none', marginBottom:14, boxSizing:'border-box'}}
              placeholder="Valeur custom (1-1000)"/>

            <p style={{fontSize:10, color:'rgba(237,232,219,0.4)', margin:'0 0 14px', lineHeight:1.5}}>
              💡 Estimation : <strong>{Math.round(ocrModal.pages*3/60)} min</strong> pour {ocrModal.pages} pages.
              Le job tourne en arrière-plan, tu peux fermer Pilot et revenir plus tard.
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
      {/* ═════ MODALE LECTEUR PLEIN ÉCRAN ═════ */}
      {lecteurOuvert && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:1100, display:'flex', flexDirection:'column'}}>

          {/* Barre haut */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0, gap:14}}>
            <div style={{flex:1, minWidth:0}}>
              <h2 style={{fontSize:15, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                📖 {lecteurOuvert.titre}
              </h2>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0}}>
                {lecteurOuvert.auteur && <span>{lecteurOuvert.auteur}</span>}
                {lecteurOuvert.auteur && lecteurOuvert.date && <span> · </span>}
                {lecteurOuvert.date && <span>{lecteurOuvert.date}</span>}
                {lecteurOuvert.theme && <span> · #{lecteurOuvert.theme}</span>}
                {' · '}
                <span style={{color:'rgba(237,232,219,0.4)'}}>
                  {surlignagesDocument(lecteurOuvert.document_id).length} surlignages
                </span>
              </p>
            </div>
            <button onClick={fermerLecteur} style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', cursor:'pointer', color:'#EDE8DB', fontSize:13, fontWeight:700}}>
              ✕ Fermer
            </button>
          </div>

          {/* Toolbar surligneur */}
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, background:'rgba(255,255,255,0.02)'}}>
            <span style={{fontSize:11, fontWeight:700, color:'rgba(237,232,219,0.6)', textTransform:'uppercase', letterSpacing:'0.08em'}}>
              Couleur :
            </span>
            {COULEURS_SURLIGNAGE.map(c => (
              <button
                key={c.id}
                onClick={()=>setCouleurActive(c.id)}
                style={{
                  padding:'5px 11px', borderRadius:8,
                  border:`2px solid ${couleurActive === c.id ? c.border : 'transparent'}`,
                  background:c.bg, color:'#EDE8DB',
                  fontSize:11, fontWeight:700, cursor:'pointer',
                  transition:'all 0.15s ease',
                }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
            <button
              onClick={handleSurligner}
              style={{
                marginLeft:'auto', padding:'7px 14px', borderRadius:8,
                border:'none', background:project.color, color:'#0D1B2A',
                fontSize:11, fontWeight:800, cursor:'pointer',
              }}
            >
              ✨ Surligner la sélection
            </button>
            <p style={{fontSize:10, color:'rgba(237,232,219,0.4)', margin:0, fontStyle:'italic'}}>
              Sélectionne du texte avec la souris, puis clique sur ✨
            </p>
          </div>

          {/* Zone contenu + sidebar surlignages */}
          <div style={{flex:1, display:'flex', overflow:'hidden'}}>

            {/* Texte du document */}
            <div style={{flex:1, overflowY:'auto', padding:'30px 60px', color:'#EDE8DB', fontFamily:"'Georgia', serif", fontSize:15, lineHeight:1.8}}>
              {lecteurLoading && (
                <div style={{textAlign:'center', padding:60}}>
                  <p style={{fontSize:40, margin:'0 0 12px'}}>⏳</p>
                  <p style={{fontSize:14, color:'rgba(237,232,219,0.5)', margin:0}}>Chargement du document depuis Cloudflare R2...</p>
                </div>
              )}
              {lecteurError && (
                <div style={{padding:30, background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:10}}>
                  <p style={{fontSize:13, color:'#C75B4E', margin:0}}>⚠️ {lecteurError}</p>
                </div>
              )}
              {!lecteurLoading && lecteurTexte && (
                <pre style={{whiteSpace:'pre-wrap', wordWrap:'break-word', fontFamily:'inherit', fontSize:'inherit', margin:0}}>
                  {lecteurTexte}
                </pre>
              )}
            </div>

            {/* Sidebar surlignages du document */}
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
                  return (
                    <div key={h.id} style={{background:c.bg, border:`1px solid ${c.border}40`, borderLeft:`3px solid ${c.border}`, borderRadius:8, padding:'10px 12px', marginBottom:8, position:'relative'}}>
                      <button onClick={()=>supprimerSurlignage(h.id)} style={{position:'absolute', top:5, right:5, background:'transparent', border:'none', color:'rgba(237,232,219,0.5)', fontSize:12, cursor:'pointer', padding:'2px 4px', lineHeight:1}}>✕</button>
                      <p style={{fontSize:10, color:c.border, fontWeight:700, margin:'0 0 4px'}}>{c.emoji} {c.label}</p>
                      <p style={{fontSize:11, color:'#EDE8DB', margin:0, lineHeight:1.5, paddingRight:14, fontStyle:'italic'}}>
                        "{h.texte_surligne.length > 200 ? h.texte_surligne.slice(0,200) + '...' : h.texte_surligne}"
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════ COLONNE GAUCHE ═════ */}
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:10, overflow:'hidden', minWidth:0}}>

        {/* HEADER COMPACT */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, gap:14}}>
          <p style={{fontSize:11, color:'rgba(237,232,219,0.5)', margin:0, flex:1}}>
            {sourceConfig.description} · Cloudflare R2
            {!apiKey && <span style={{color:'#C75B4E', marginLeft:8, fontWeight:700}}>⚠️ Clé Doppler manquante</span>}
          </p>
          <button onClick={()=>setSourcesModal(true)} style={{padding:'6px 12px', borderRadius:8, border:`1px solid ${project.color}40`, background:`${project.color}15`, color:project.color, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
            ⚙️ Gérer les sources
          </button>
        </div>

        {/* SEGMENTED CONTROL 4 SOURCES */}
        <div style={{display:'flex', gap:0, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:3, flexShrink:0}}>
          {SOURCES.map(s => {
            const isActive = sourceActive === s.id
            return (
              <button
                key={s.id}
                onClick={()=>handleChangeSource(s.id)}
                style={{
                  flex:1, padding:'9px 8px', borderRadius:8, border:'none',
                  background:isActive ? s.color : 'transparent',
                  color:isActive ? '#0D1B2A' : 'rgba(237,232,219,0.6)',
                  fontSize:11, fontWeight:800, cursor:'pointer',
                  transition:'all 0.15s ease',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                }}>
                <span style={{fontSize:13}}>{s.icon}</span>
                <span style={{whiteSpace:'nowrap'}}>{s.label}</span>
              </button>
            )
          })}
        </div>

        {/* BARRE RECHERCHE + THEME */}
        <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'12px 14px', flexShrink:0}}>
          <div style={{display:'flex', gap:8, marginBottom:10}}>
            <input
              value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')handleSearch()}}
              placeholder={sourceConfig.placeholder}
              style={{flex:1, padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:13, outline:'none', fontFamily:"'Nunito Sans',sans-serif"}}
            />
            <button onClick={handleSearch} disabled={loading || !apiKey}
              style={{padding:'10px 20px', borderRadius:10, border:'none', background:loading ? `${project.color}40` : project.color, color:'#0D1B2A', fontSize:12, fontWeight:800, cursor:loading || !apiKey ? 'not-allowed' : 'pointer', opacity:!apiKey ? 0.5 : 1, whiteSpace:'nowrap'}}>
              {loading ? '⏳ Recherche...' : '🔍 Chercher'}
            </button>
          </div>

          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <label style={{fontSize:11, color:'rgba(237,232,219,0.5)', fontWeight:700, whiteSpace:'nowrap'}}>Thème R2 :</label>
            <input value={theme} onChange={e=>setTheme(e.target.value)}
              placeholder="ovnis, stavisky, 1968…"
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
              {sourceConfig.supportsTendance && (
                <div>
                  <label style={{fontSize:9, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700}}>Tendance politique</label>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {['Gauche','Centre','Droite'].map(t => (
                      <button key={t} onClick={()=>setTendances(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                        style={{padding:'4px 9px', borderRadius:12, border:`1px solid ${tendances.includes(t)?project.color:'rgba(255,255,255,0.1)'}`, background:tendances.includes(t)?`${project.color}20`:'transparent', color:tendances.includes(t)?project.color:'rgba(237,232,219,0.5)', fontSize:10, fontWeight:700, cursor:'pointer'}}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              {!sourceConfig.supportsDates && !sourceConfig.supportsTypeDoc && !sourceConfig.supportsLang && !sourceConfig.supportsTendance && (
                <div style={{gridColumn:'1 / -1', padding:12, textAlign:'center'}}>
                  <p style={{fontSize:11, color:'rgba(237,232,219,0.4)', margin:0}}>Pas de filtres avancés pour cette source.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ERREUR */}
        {error && (
          <div style={{background:'rgba(199,91,78,0.1)', border:'1px solid rgba(199,91,78,0.3)', borderRadius:8, padding:'8px 12px', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <p style={{fontSize:11, color:'#C75B4E', margin:0}}>⚠️ {error}</p>
            <button onClick={()=>setError(null)} style={{background:'transparent', border:'none', color:'#C75B4E', cursor:'pointer', fontSize:14, padding:0}}>✕</button>
          </div>
        )}

        {/* LABEL RESULTATS */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, padding:'0 4px'}}>
          <p style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0}}>
            {searched
              ? `${sourceConfig.label} — ${results.length} affichés sur ${totalHits.toLocaleString('fr-FR')} trouvés`
              : `Lance une recherche dans ${sourceConfig.label}`}
          </p>
          {searched && results.length>0 && (
            <p style={{fontSize:10, color:'rgba(91,199,138,0.7)', margin:0}}>
              {hasMore ? `📄 Page ${currentPage}` : '✅ Tous affichés'}
            </p>
          )}
        </div>

        {/* ZONE RÉSULTATS */}
        <div style={{display:'flex', flexDirection:'column', gap:8, overflowY:'auto', paddingRight:6, flex:'1 1 auto', minHeight:0,
          scrollbarWidth:'thin', scrollbarColor:`${project.color}60 rgba(255,255,255,0.05)`}}>

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
              <p style={{fontSize:11, margin:0, lineHeight:1.5}}>{sourceConfig.description}</p>
            </div>
          )}

          {!loading && searched && results.length===0 && !error && (
            <div style={{padding:40, textAlign:'center', color:'rgba(237,232,219,0.4)'}}>
              <p style={{fontSize:28, margin:'0 0 8px'}}>🔎</p>
              <p style={{fontSize:13, margin:0}}>Aucun résultat pour "{query}"</p>
              <p style={{fontSize:11, margin:'4px 0 0', color:'rgba(237,232,219,0.3)'}}>Essaie avec d'autres mots-clés</p>
            </div>
          )}

          {!loading && results.map((r, idx) => {
            let borderColor = sourceConfig.color
            let tendanceLabel = null
            if (r.source === 'gallica') {
              const journalDetecte = Object.keys(TENDANCES).find(j =>
                (r.titre || '').includes(j) || (r.editeur || '').includes(j)
              )
              if (journalDetecte) {
                const t = tendancePour(journalDetecte)
                borderColor = t.couleur
                tendanceLabel = t.label
              }
            }
            const isFav = estFavori(r.id)
            const canOcr = r.source === 'gallica' && r.type_doc && r.type_doc.toLowerCase().includes('monograph')
            const isDownloaded = downloadStatus[r.id] === 'ok'

            return (
              <div key={`${r.id}_${idx}`}
                style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', borderLeft:`4px solid ${borderColor}`, display:'flex', gap:12, flexShrink:0}}>

                {r.thumbnail && (
                  <img src={r.thumbnail} alt=""
                    style={{width:56, height:74, objectFit:'cover', borderRadius:5, flexShrink:0, background:'rgba(0,0,0,0.3)'}}
                    onError={e=>{e.target.style.display='none'}}/>
                )}

                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5, gap:10}}>
                    <h4 style={{fontSize:13, fontWeight:700, color:'#EDE8DB', margin:0, lineHeight:1.4, flex:1}}>
                      <span style={{color:'rgba(237,232,219,0.3)', fontSize:10, marginRight:6}}>#{idx+1}</span>
                      {r.titre}
                    </h4>
                    <button onClick={()=>toggleFavori(r)}
                      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      style={{background:'transparent', border:'none', color:isFav ? '#D4A853' : 'rgba(237,232,219,0.3)', fontSize:18, cursor:'pointer', padding:0, lineHeight:1, transition:'color 0.2s'}}>
                      {isFav ? '★' : '☆'}
                    </button>
                  </div>

                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6, fontSize:10, flexWrap:'wrap'}}>
                    {r.auteur && (<><span style={{color:'rgba(237,232,219,0.7)', fontWeight:700}}>{r.auteur}</span><span style={{color:'rgba(237,232,219,0.3)'}}>·</span></>)}
                    {r.date && (<><span style={{color:'rgba(237,232,219,0.5)'}}>{r.date}</span><span style={{color:'rgba(237,232,219,0.3)'}}>·</span></>)}
                    {r.editeur && (<><span style={{color:'rgba(237,232,219,0.5)'}}>{r.editeur}</span></>)}
                    {r.type_doc && <span style={{fontSize:9, color:'rgba(237,232,219,0.4)', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>{r.type_doc}</span>}
                    {r.ocr_quality != null && (
                      <span style={{fontSize:9, color:r.ocr_quality>80 ? '#5BC78A' : r.ocr_quality>60 ? '#D4A853' : '#C75B4E', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>
                        OCR {Math.round(r.ocr_quality)}%
                      </span>
                    )}
                    {r.open_access === true && (
                      <span style={{fontSize:9, color:'#5BC78A', background:'rgba(91,199,138,0.1)', padding:'1px 6px', borderRadius:5, fontWeight:700}}>🔓 Open Access</span>
                    )}
                    {r.open_access === false && (
                      <span style={{fontSize:9, color:'rgba(237,232,219,0.5)', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>🔒 Payant</span>
                    )}
                    {r.is_borrowable === true && (
                      <span style={{fontSize:9, color:'#D4A853', background:'rgba(212,168,83,0.1)', padding:'1px 6px', borderRadius:5, fontWeight:700}}>🔒 Emprunt</span>
                    )}
                    {r.is_borrowable === false && (
                      <span style={{fontSize:9, color:'#5BC78A', background:'rgba(91,199,138,0.1)', padding:'1px 6px', borderRadius:5, fontWeight:700}}>🔓 Libre</span>
                    )}
                    {r.doi && (
                      <span style={{fontSize:9, color:'rgba(237,232,219,0.4)', background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5, fontFamily:'monospace'}}>DOI:{r.doi.slice(0,18)}...</span>
                    )}
                    {tendanceLabel && (
                      <span style={{fontSize:9, color:borderColor, background:'rgba(255,255,255,0.04)', padding:'1px 6px', borderRadius:5}}>{tendanceLabel}</span>
                    )}
                  </div>

                  {r.snippet && (
                    <p style={{fontSize:11, color:'rgba(237,232,219,0.6)', lineHeight:1.5, margin:'0 0 8px'}}>{r.snippet}</p>
                  )}

                  <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
                    <a href={r.url_gallica} target="_blank" rel="noopener noreferrer"
                      style={{padding:'4px 9px', borderRadius:6, border:`1px solid ${project.color}40`, background:`${project.color}10`, color:project.color, fontSize:10, fontWeight:700, cursor:'pointer', textDecoration:'none'}}>
                      📖 {r.source === 'gallica' ? 'Lire sur Gallica' : r.source === 'wikipedia' ? 'Lire sur Wikipedia' : r.source === 'archive' ? 'Voir sur Archive' : 'Ouvrir le papier'}
                    </a>
                    {r.pdf_url && r.pdf_url !== r.url_gallica && (
                      <a href={r.pdf_url} target="_blank" rel="noopener noreferrer"
                        style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(91,199,138,0.4)', background:'rgba(91,199,138,0.1)', color:'#5BC78A', fontSize:10, fontWeight:700, cursor:'pointer', textDecoration:'none'}}>
                        📄 PDF
                      </a>
                    )}
                    <button onClick={()=>handleDownload(r)} disabled={downloadStatus[r.id]==='loading' || downloadStatus[r.id]==='ok'} style={getDownloadButtonStyle(r.id)}>
                      {getDownloadButtonLabel(r.id)}
                    </button>
                    {canOcr && (
                      <button onClick={()=>handleStartOcr(r)}
                        style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(212,168,83,0.4)', background:'rgba(212,168,83,0.1)', color:'#D4A853', fontSize:10, fontWeight:700, cursor:'pointer'}}>
                        🔬 OCR Tesseract
                      </button>
                    )}
                    <button onClick={()=>navigator.clipboard.writeText(`${r.titre} — ${r.auteur || 'Anonyme'} (${r.date || 'n.d.'}). ${r.url_gallica}`)}
                      style={{padding:'4px 9px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', fontSize:10, cursor:'pointer'}}>
                      📋 Copier
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* BOUTON CHARGER PLUS */}
          {!loading && results.length > 0 && hasMore && (
            <div style={{padding:'12px 0', display:'flex', justifyContent:'center', flexShrink:0}}>
              <button onClick={handleLoadMore} disabled={loadingMore}
                style={{padding:'12px 28px', borderRadius:10, border:`1px solid ${sourceConfig.color}60`, background:loadingMore ? `${sourceConfig.color}20` : `${sourceConfig.color}15`, color:sourceConfig.color, fontSize:12, fontWeight:800, cursor:loadingMore ? 'wait' : 'pointer', transition:'all 0.2s ease', display:'flex', alignItems:'center', gap:8}}>
                {loadingMore ? '⏳ Chargement…' : `↓ Charger 50 résultats de plus (${results.length} / ${totalHits.toLocaleString('fr-FR')})`}
              </button>
            </div>
          )}

          {!loading && results.length > 0 && !hasMore && (
            <div style={{padding:'14px 0', textAlign:'center', flexShrink:0}}>
              <p style={{fontSize:11, color:'rgba(237,232,219,0.3)', margin:0, fontStyle:'italic'}}>
                — Fin des résultats ({totalHits.toLocaleString('fr-FR')} affichés) —
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═════ COLONNE DROITE : FAVORIS + JOBS OCR ═════ */}
      <div style={{width:280, display:'flex', flexDirection:'column', gap:10, flexShrink:0, overflow:'hidden'}}>

        {/* SECTION OCR JOBS ACTIFS (si y'en a) */}
        {jobsActifs.length > 0 && (
          <div style={{background:'rgba(212,168,83,0.08)', border:'1px solid rgba(212,168,83,0.3)', borderRadius:10, padding:'10px 12px', flexShrink:0}}>
            <h3 style={{fontSize:10, fontWeight:700, color:'#D4A853', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px'}}>
              🔬 OCR en cours ({jobsActifs.length})
            </h3>
            {jobsActifs.map(j => (
              <div key={j.job_id} style={{marginBottom:8, paddingBottom:6, borderBottom:'1px solid rgba(212,168,83,0.15)'}}>
                <p style={{fontSize:10, color:'#EDE8DB', margin:'0 0 3px', fontWeight:700, lineHeight:1.3}}>
                  {j.document_titre.length > 40 ? j.document_titre.slice(0,40) + '…' : j.document_titre}
                </p>
                <div style={{height:6, background:'rgba(0,0,0,0.3)', borderRadius:3, overflow:'hidden', marginBottom:3}}>
                  <div style={{height:'100%', width:`${j.progress || 0}%`, background:'#D4A853', transition:'width 0.3s'}}/>
                </div>
                <p style={{fontSize:9, color:'rgba(237,232,219,0.6)', margin:0}}>
                  {j.pages_done || 0} / {j.total_pages} pages · {j.progress || 0}%
                </p>
              </div>
            ))}
          </div>
        )}
{/* SECTION OCR TERMINÉS */}
        {jobsDone.length > 0 && (
          <div style={{background:'rgba(91,199,138,0.05)', border:'1px solid rgba(91,199,138,0.2)', borderRadius:10, padding:'10px 12px', flexShrink:0, maxHeight:200, overflowY:'auto'}}>
            <h3 style={{fontSize:10, fontWeight:700, color:'#5BC78A', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px'}}>
              ✅ OCR terminés ({jobsDone.length})
            </h3>
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
                      <button onClick={()=>ouvrirLecteur({
                          titre: j.document_titre,
                          source: 'gallica',
                          r2_key: j.r2_key,
                          document_id: j.document_id,
                          theme: j.theme || null,
                          auteur: null,
                          date: null
                        })}
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
                        }
                      }}
                      style={{fontSize:9, padding:'3px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', cursor:'pointer'}}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* SECTION FAVORIS */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0}}>
          <h3 style={{fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0}}>
            ⭐ Favoris {project?.id || 'general'} ({favorisProjet.length})
          </h3>
          {favoris.length > favorisProjet.length && (
            <span style={{fontSize:9, color:'rgba(237,232,219,0.3)'}}>+{favoris.length - favorisProjet.length} autres</span>
          )}
        </div>

        <div style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, paddingRight:4,
          scrollbarWidth:'thin', scrollbarColor:`${project.color}40 transparent`}}>

          {favorisProjet.length === 0 ? (
            <div style={{padding:'20px 12px', textAlign:'center', color:'rgba(237,232,219,0.3)', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px dashed rgba(255,255,255,0.08)'}}>
              <p style={{fontSize:20, margin:'0 0 6px'}}>⭐</p>
              <p style={{fontSize:11, margin:'0 0 3px', fontWeight:700}}>Aucun favori</p>
              <p style={{fontSize:9, margin:0, lineHeight:1.5}}>Clique sur ☆ d'un résultat pour l'ajouter</p>
            </div>
          ) : (
            favorisProjet.map(f => {
              const sourceConfigFav = SOURCES.find(s => s.id === f.source) || SOURCES[0]
              let borderColor = sourceConfigFav.color
              if (f.source === 'gallica') {
                const journalDetecte = Object.keys(TENDANCES).find(j =>
                  (f.titre || '').includes(j) || (f.editeur || '').includes(j)
                )
                if (journalDetecte) borderColor = tendancePour(journalDetecte).couleur
              }

              // Cherche un job OCR ou téléchargement terminé pour ce favori
              const ocrJob = ocrJobs.find(j => j.document_id === f.id && j.status === 'done')
              const r2Key = f.r2_key || (ocrJob ? ocrJob.r2_key : null)
              const surlignagesCount = surlignagesDocument(f.id).length

              return (
                <div key={f.id}
                  style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'8px 10px', borderLeft:`3px solid ${borderColor}`, flexShrink:0, position:'relative'}}>
                  <button onClick={()=>supprimerFavori(f.id)} title="Retirer des favoris"
                    style={{position:'absolute', top:6, right:6, background:'transparent', border:'none', color:'rgba(237,232,219,0.3)', fontSize:11, cursor:'pointer', padding:'2px 4px', lineHeight:1}}>✕</button>
                  <p style={{fontSize:11, fontWeight:700, color:'#EDE8DB', margin:'0 0 3px', lineHeight:1.4, paddingRight:16}}>{f.titre}</p>
                  <p style={{fontSize:9, color:'rgba(237,232,219,0.4)', margin:'0 0 4px'}}>
                    <span style={{color:sourceConfigFav.color, fontWeight:700}}>{sourceConfigFav.icon} {sourceConfigFav.label}</span>
                    {f.auteur && <span> · {f.auteur.length > 20 ? f.auteur.slice(0,20)+'…' : f.auteur}</span>}
                    {f.date && <span> · {f.date}</span>}
                  </p>
                  {f.theme && (
                    <p style={{fontSize:8, color:`${project.color}cc`, margin:'0 0 4px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>#{f.theme}</p>
                  )}
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {r2Key && (
                      <button onClick={()=>ouvrirLecteur({
                          titre:f.titre, source:f.source, r2_key:r2Key,
                          document_id:f.id, theme:f.theme, auteur:f.auteur, date:f.date
                        })}
                        style={{fontSize:9, padding:'3px 7px', borderRadius:5, border:'none', background:project.color, color:'#0D1B2A', fontWeight:700, cursor:'pointer'}}>
                        📖 Lire
                        {surlignagesCount > 0 && <span style={{marginLeft:4, opacity:0.7}}>({surlignagesCount})</span>}
                      </button>
                    )}
                    <a href={f.url_gallica} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:9, color:'rgba(237,232,219,0.5)', textDecoration:'none', padding:'3px 6px'}}>
                      ↗ Source
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{height:1, background:'rgba(255,255,255,0.06)', flexShrink:0}}/>

        <p style={{fontSize:9, fontWeight:700, color:'rgba(237,232,219,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0, flexShrink:0}}>Actions</p>

        <button disabled style={{padding:'9px 11px', borderRadius:8, border:'none', background:`${project.color}30`, color:project.color, fontSize:11, fontWeight:700, cursor:'not-allowed', textAlign:'left', flexShrink:0}}>
          ✨ Générer rapport IA
        </button>
        <button disabled style={{padding:'9px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(237,232,219,0.4)', fontSize:11, fontWeight:700, cursor:'not-allowed', textAlign:'left', flexShrink:0}}>
          📄 Exporter Markdown
        </button>

        <div style={{padding:'9px 11px', background:'rgba(91,199,138,0.08)', border:'1px solid rgba(91,199,138,0.2)', borderRadius:8, flexShrink:0}}>
          <p style={{fontSize:10, fontWeight:700, color:'#5BC78A', margin:'0 0 4px'}}>✅ V4 Lecteur + OCR</p>
          <p style={{fontSize:9, color:'rgba(237,232,219,0.5)', margin:0, lineHeight:1.5}}>
            4 sources + OCR Tesseract Gallica + lecteur + surligneur. Prochain : Rapport IA.
          </p>
        </div>
      </div>
    </div>
  )
}

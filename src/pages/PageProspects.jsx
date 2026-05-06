import { useState, useRef, useEffect, useCallback } from 'react'

// ============================================
// CONFIG API
// ============================================
const API_URL = 'https://pilot-api.vigie-officiel.com'
const N8N_WEBHOOK_URL = 'https://n8n.vigie-officiel.com/webhook/pilot-prospect'
const AGENTS_API_URL = 'https://agents.vigie-officiel.com'

// ============================================
// COLONNES KANBAN
// ============================================
const COLONNES = [
  { id: 'prospect', label: 'Prospect', color: '#5BA3C7', emoji: '👁️',  statutBase: 'nouveau' },
  { id: 'contact',  label: 'Contact',  color: '#D4A853', emoji: '📞',  statutBase: 'contacte' },
  { id: 'devis',    label: 'Devis',    color: '#A85BC7', emoji: '📄',  statutBase: 'devis' },
  { id: 'client',   label: 'Client',   color: '#5BC78A', emoji: '✅',  statutBase: 'client' },
  { id: 'perdu',    label: 'Perdu',    color: '#C75B4E', emoji: '❌',  statutBase: 'perdu' },
]

function statutBaseToColonne(statut) {
  if (!statut) return 'prospect'
  const found = COLONNES.find(c => c.statutBase === statut)
  if (found) return found.id
  if (statut === 'interesse') return 'contact'
  return 'prospect'
}

function colonneToStatutBase(colonneId) {
  const found = COLONNES.find(c => c.id === colonneId)
  return found ? found.statutBase : 'nouveau'
}

const SOURCES = ['LinkedIn', 'Facebook', 'Bouche à oreille', 'Site web', 'Discord', 'Email', 'SIRENE', 'Autre']

const SECTEURS = [
  { label: 'Tous secteurs',     naf: '' },
  { label: 'Plombier',          naf: '4322A' },
  { label: 'Électricien',       naf: '4321A' },
  { label: 'Menuisier',         naf: '4332A' },
  { label: 'Maçon',             naf: '4120A' },
  { label: 'Peintre',           naf: '4334Z' },
  { label: 'Coiffeur',          naf: '9602A' },
  { label: 'Boulanger',         naf: '1071A' },
  { label: 'Restaurant',        naf: '5610A' },
  { label: 'Auto-école',        naf: '8553Z' },
  { label: 'Garage auto',       naf: '4520A' },
  { label: 'Agent immobilier',  naf: '6831Z' },
  { label: 'Comptable',         naf: '6920Z' },
  { label: 'Architecte',        naf: '7111Z' },
  { label: 'Infirmier',         naf: '8621Z' },
  { label: 'Kinésithérapeute',  naf: '8623Z' },
  { label: 'Taxi / VTC',        naf: '4932Z' },
  { label: 'Traiteur',          naf: '5621Z' },
  { label: 'Jardinier',         naf: '8130Z' },
  { label: 'Photographe',       naf: '7420Z' },
  { label: 'Consultant',        naf: '7022Z' },
  { label: 'Développeur web',   naf: '6201Z' },
  { label: 'Graphiste',         naf: '7410Z' },
  { label: 'Médecin',           naf: '8610Z' },
  { label: 'Dentiste',          naf: '8621Z' },
  { label: 'Vétérinaire',       naf: '7500Z' },
  { label: 'Fleuriste',         naf: '4776Z' },
  { label: 'Bijoutier',         naf: '4777Z' },
  { label: 'Opticien',          naf: '4778A' },
  { label: 'Pharmacie',         naf: '4773Z' },
]

const DEPARTEMENTS = [
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','21',
  '22','23','24','25','26','27','28','29','30','31',
  '32','33','34','35','36','37','38','39','40','41',
  '42','43','44','45','46','47','48','49','50','51',
  '52','53','54','55','56','57','58','59','60','61',
  '62','63','64','65','66','67','68','69','70','71',
  '72','73','74','75','76','77','78','79','80','81',
  '82','83','84','85','86','87','88','89','90','91',
  '92','93','94','95','971','972','973','974',
]

// ============================================
// HELPERS API PILOT DB
// ============================================
async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Accept': 'application/json' }
  })
  if (!res.ok) throw new Error(`API GET ${path} : ${res.status}`)
  return res.json()
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API PATCH ${path} : ${res.status}`)
  return res.json()
}

async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`API DELETE ${path} : ${res.status}`)
  return true
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    if (res.status === 409) return { duplicate: true }
    throw new Error(`API POST ${path} : ${res.status}`)
  }
  return res.json()
}

// ============================================
// HELPERS AGENTS DOPPLER (Rédacteur)
// ============================================

/**
 * Récupère la clé X-API-Key Agents Doppler depuis le Coffre-fort Pilot.
 * Cherche un compte dont le nom contient "Agents Doppler" (insensible à la casse).
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
 * Récupère la config IA d'un projet depuis localStorage.
 * Si la config n'existe pas, retourne une config minimale par défaut.
 */
function getProjectConfig(projectId, projectLabel) {
  try {
    const stored = localStorage.getItem(`pilotage_config_${projectId}`)
    if (stored) {
      const config = JSON.parse(stored)
      // Mappe les champs Pilot vers le format attendu par l'agent Rédacteur
      return {
        nom: config.nom || projectLabel || projectId,
        activite: config.activite || 'Logiciel pour entrepreneurs solo',
        audience: config.audience || 'professionnels',
        ton: config.ton || 'chaleureux mais professionnel',
      }
    }
  } catch {}
  // Config par défaut si rien n'est configuré
  return {
    nom: projectLabel || projectId,
    activite: 'Logiciel pour entrepreneurs solo',
    audience: 'professionnels',
    ton: 'chaleureux mais professionnel',
  }
}

/**
 * Appelle l'agent Rédacteur sur le VPS pour générer un message de prospection.
 */
async function genererMessageIA({ prospectId, projectConfig, allowNoEmail = false }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) {
    throw new Error('Clé API Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  }

  const res = await fetch(`${AGENTS_API_URL}/redacteur/generer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      prospect_id: prospectId,
      project_config: projectConfig,
      allow_no_email: allowNoEmail,
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
 * Appelle l'agent Mailer sur le VPS pour envoyer l'email de prospection via Resend.
 */
async function envoyerEmailViaAgent({ prospectId, sujet, message }) {
  const apiKey = getAgentsApiKey()
  if (!apiKey) {
    throw new Error('Clé API Agents Doppler introuvable. Ajoute-la dans le Coffre-fort.')
  }

  const res = await fetch(`${AGENTS_API_URL}/mailer/envoyer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      prospect_id: prospectId,
      sujet,
      message,
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
 * Récupère les events Resend d'un email envoyé depuis Pilot DB.
 * Retourne un tableau d'events triés par created_at ascendant.
 */
async function fetchEmailEvents(resendId) {
  if (!resendId) return []
  try {
    const res = await fetch(
      `${API_URL}/email_events?resend_id=eq.${resendId}&select=event_type,created_at&order=created_at.asc`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/**
 * Construit un résumé des events tracking : compteurs + dernière interaction significative.
 * Retourne null si aucun event utile.
 */
function summarizeEmailEvents(events) {
  if (!events || events.length === 0) return null

  const summary = {
    delivered: false,
    deliveredAt: null,
    bounced: false,
    bouncedAt: null,
    opens: 0,
    lastOpenAt: null,
    clicks: 0,
    lastClickAt: null,
    complained: false,
  }

  for (const ev of events) {
    switch (ev.event_type) {
      case 'email.delivered':
        summary.delivered = true
        summary.deliveredAt = ev.created_at
        break
      case 'email.bounced':
        summary.bounced = true
        summary.bouncedAt = ev.created_at
        break
      case 'email.opened':
        summary.opens += 1
        summary.lastOpenAt = ev.created_at
        break
      case 'email.clicked':
        summary.clicks += 1
        summary.lastClickAt = ev.created_at
        break
      case 'email.complained':
        summary.complained = true
        break
      default:
        break
    }
  }

  return summary
}

/**
 * Formatage temps relatif court ("il y a 5 min", "il y a 2h", "hier")
 */
function timeAgo(isoDate) {
  if (!isoDate) return ''
  const now = new Date()
  const then = new Date(isoDate)
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'à l\'instant'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'hier'
  if (diffD < 7) return `il y a ${diffD}j`
  return then.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ============================================
// HELPERS LOCAL STORAGE — Messages générés
// ============================================
const MESSAGES_STORAGE_KEY = 'pilot_messages_generes'

function getStoredMessage(prospectId) {
  try {
    const all = JSON.parse(localStorage.getItem(MESSAGES_STORAGE_KEY) || '{}')
    return all[prospectId] || null
  } catch {
    return null
  }
}

function saveStoredMessage(prospectId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(MESSAGES_STORAGE_KEY) || '{}')
    all[prospectId] = {
      ...data,
      generated_at: new Date().toISOString(),
    }
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

function deleteStoredMessage(prospectId) {
  try {
    const all = JSON.parse(localStorage.getItem(MESSAGES_STORAGE_KEY) || '{}')
    delete all[prospectId]
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

// ============================================
// CSV PARSING
// ============================================
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(/[;,]/).map(v => v.trim().replace(/^["']|["']$/g, ''))
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    if (row.nom && row.nom.trim()) rows.push(row)
  }
  return rows
}

const iS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDE8DB', fontSize: 12, outline: 'none',
  fontFamily: "'Nunito Sans',sans-serif", boxSizing: 'border-box'
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
export default function PageProspects({ project }) {
  const [prospects,     setProspects]     = useState([])
  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [view,          setView]          = useState('kanban')
  const [selected,      setSelected]      = useState(null)
  const [selection,     setSelection]     = useState(new Set())
  const [filterSession, setFilterSession] = useState(null)
  const [msg,           setMsg]           = useState(null)

  const [autoSecteur,   setAutoSecteur]   = useState('')
  const [autoDept,      setAutoDept]      = useState('75')
  const [autoSearching, setAutoSearching] = useState(false)

  // --- États enrichissement manuel dans le drawer ---
  const [enrichData,    setEnrichData]    = useState({ email: '', telephone: '', site_web: '' })
  const [enrichSaving,  setEnrichSaving]  = useState(false)

  // --- États génération message IA ---
  const [iaMessage,     setIaMessage]     = useState(null)  // { sujet, message, prospect_nom, generated_at, tokens_used }
  const [iaGenerating,  setIaGenerating]  = useState(false)
  const [iaCopied,      setIaCopied]      = useState(null)  // 'sujet' | 'message' | null

  // --- États envoi email IA ---
  const [iaSending,     setIaSending]     = useState(false)

  // --- États tracking events Resend (Phase 2B) ---
  const [iaEvents,      setIaEvents]      = useState([])  // [{event_type, created_at}, ...]

  const csvRef = useRef(null)

  const showMsg = (text, duration = 3500) => {
    setMsg(text)
    setTimeout(() => setMsg(null), duration)
  }

  // --- Chargement initial ---
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([
        apiGet('/prospects?order=created_at.desc&limit=500'),
        apiGet('/sessions?order=created_at.desc&limit=50'),
      ])
      setProspects(p)
      setSessions(s)
    } catch (err) {
      showMsg(`❌ Erreur chargement : ${err.message}`, 5000)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // --- Quand un prospect est sélectionné, on initialise les champs enrichissement + on charge un message éventuellement déjà généré ---
  useEffect(() => {
    if (selected) {
      setEnrichData({
        email: selected.email || '',
        telephone: selected.telephone || '',
        site_web: selected.site_web || '',
      })
      // Si un email a déjà été envoyé, on charge sujet+message depuis la base (priorité sur le local)
      if (selected.email_envoye_le && selected.email_sujet) {
        setIaMessage({
          sujet: selected.email_sujet,
          message: selected.email_message || '',
          generated_at: selected.email_envoye_le,
          tokens_used: null,
        })
      } else {
        // Sinon : charger le message stocké en local (s'il existe)
        const stored = getStoredMessage(selected.id)
        setIaMessage(stored)
      }
      setIaCopied(null)

      // Charger les events Resend (tracking) si email envoyé
      if (selected.email_resend_id) {
        fetchEmailEvents(selected.email_resend_id).then(setIaEvents)
      } else {
        setIaEvents([])
      }
    } else {
      setIaMessage(null)
      setIaEvents([])
    }
  }, [selected])

  const prospectsAffiches = filterSession
    ? prospects.filter(p => p.session_id === filterSession)
    : prospects

  const totalScore = prospectsAffiches.reduce((acc, p) => acc + (p.score_qualite || 0), 0)

  // --- Drag & drop ---
  const onDragStart = (e, prospect) => { e.dataTransfer.setData('prospectId', prospect.id) }
  const onDragOver = (e) => { e.preventDefault() }

  const onDrop = async (e, colonne) => {
    e.preventDefault()
    const prospectId = e.dataTransfer.getData('prospectId')
    if (!prospectId) return
    const prospect = prospects.find(p => p.id === prospectId)
    if (!prospect) return

    const nouveauStatut = colonneToStatutBase(colonne.id)
    if (prospect.statut === nouveauStatut) return

    const ancienStatut = prospect.statut
    setProspects(curr => curr.map(p => p.id === prospectId ? { ...p, statut: nouveauStatut } : p))

    try {
      const update = { statut: nouveauStatut }
      if (nouveauStatut === 'contacte' && !prospect.contacte_le) {
        update.contacte_le = new Date().toISOString()
      }
      await apiPatch(`/prospects?id=eq.${prospectId}`, update)
      showMsg(`✅ ${prospect.nom_entreprise} → ${colonne.label}`, 2000)
    } catch (err) {
      setProspects(curr => curr.map(p => p.id === prospectId ? { ...p, statut: ancienStatut } : p))
      showMsg(`❌ Erreur mise à jour : ${err.message}`)
    }
  }

  // --- Suppression individuelle ---
  const supprimer = async (id) => {
    const prospect = prospects.find(p => p.id === id)
    if (!prospect) return
    if (!confirm(`Supprimer "${prospect.nom_entreprise}" ?`)) return

    setProspects(curr => curr.filter(p => p.id !== id))
    if (selected?.id === id) setSelected(null)
    deleteStoredMessage(id)  // nettoie aussi le message stocké

    try {
      await apiDelete(`/prospects?id=eq.${id}`)
      showMsg(`🗑️ ${prospect.nom_entreprise} supprimé`, 2000)
    } catch (err) {
      showMsg(`❌ Erreur suppression : ${err.message}`)
      fetchAll()
    }
  }

  // --- Suppression multiple ---
  const supprimerSelection = async () => {
    if (selection.size === 0) return
    if (!confirm(`Supprimer ${selection.size} prospect(s) ?`)) return

    const ids = Array.from(selection)
    setProspects(curr => curr.filter(p => !selection.has(p.id)))
    ids.forEach(id => deleteStoredMessage(id))
    setSelection(new Set())

    try {
      const idsParam = ids.map(i => `"${i}"`).join(',')
      await apiDelete(`/prospects?id=in.(${idsParam})`)
      showMsg(`🗑️ ${ids.length} prospect(s) supprimé(s)`, 2000)
    } catch (err) {
      showMsg(`❌ Erreur suppression : ${err.message}`)
      fetchAll()
    }
  }

  const toggleSelect = (id) => {
    setSelection(curr => {
      const next = new Set(curr)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Recherche auto via n8n ---
  const lancerAutoRecherche = async () => {
    if (!autoSecteur || !autoDept) {
      showMsg('⚠️ Choisis un secteur ET un département.', 2500)
      return
    }
    setAutoSearching(true)
    try {
      const secteurLabel = SECTEURS.find(s => s.naf === autoSecteur)?.label || autoSecteur
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secteur: secteurLabel.toLowerCase(),
          departement: autoDept,
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()

      const nouveaux = result.nouveaux_inserees || 0
      const doublons = result.doublons_ignores || 0
      const total = result.total_scrapes || 0

      if (nouveaux === 0 && doublons > 0) {
        showMsg(`⚠️ Tous les ${doublons} prospects sont déjà en base. Essaie un autre département.`, 5000)
      } else if (nouveaux > 0) {
        showMsg(`✅ ${nouveaux} nouveau(x) prospect(s) ajouté(s) (${doublons} doublons ignorés)`, 5000)
      } else {
        showMsg(`⚠️ Aucun résultat trouvé.`, 4000)
      }

      await fetchAll()
    } catch (err) {
      showMsg(`❌ Erreur agent : ${err.message}`, 5000)
    }
    setAutoSearching(false)
  }

  // --- Import CSV ---
  const handleCSV = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const rows = parseCSV(ev.target.result)
      if (rows.length === 0) { showMsg('❌ Fichier vide ou format invalide.'); return }
      let nouveaux = 0, doublons = 0, erreurs = 0

      for (const row of rows) {
        if (!row.siret) { erreurs++; continue }
        try {
          const result = await apiPost('/prospects', {
            siret: row.siret,
            siren: row.siren || row.siret.substring(0, 9),
            nom_entreprise: row.nom || row.entreprise || 'Inconnu',
            adresse: row.adresse || null,
            code_postal: row.code_postal || row.codepostal || null,
            ville: row.ville || null,
            telephone: row.telephone || null,
            email: row.email || null,
            site_web: row.site_web || row.site || null,
            source: row.source || 'csv',
            score_qualite: parseInt(row.score_qualite) || null,
          })
          if (result.duplicate) doublons++
          else nouveaux++
        } catch (err) {
          erreurs++
        }
      }
      showMsg(`✅ Import : ${nouveaux} ajouté(s), ${doublons} doublon(s), ${erreurs} erreur(s)`, 5000)
      await fetchAll()
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const lienAnnuaire = (siren) => `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`

  // --- ENRICHISSEMENT MANUEL ---

  // Ouvre Google dans BrowserWindow Electron avec recherche pré-remplie
  const ouvrirRechercheManuelle = (prospect) => {
    if (!prospect) return
    const query = `"${prospect.nom_entreprise}" ${prospect.ville || ''} contact email`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`

    if (window.electronAPI && window.electronAPI.openSearchWindow) {
      window.electronAPI.openSearchWindow(url, prospect.id)
    } else {
      // Fallback navigateur si pas dans Electron (mode dev web pur)
      window.open(url, '_blank')
    }
  }

  // Sauvegarde des champs enrichis en base
  const sauvegarderEnrichissement = async () => {
    if (!selected) return
    setEnrichSaving(true)
    try {
      const updates = {}
      if (enrichData.email !== (selected.email || '')) updates.email = enrichData.email || null
      if (enrichData.telephone !== (selected.telephone || '')) updates.telephone = enrichData.telephone || null
      if (enrichData.site_web !== (selected.site_web || '')) updates.site_web = enrichData.site_web || null

      if (Object.keys(updates).length === 0) {
        showMsg('⚠️ Aucune modification à enregistrer', 2000)
        setEnrichSaving(false)
        return
      }

      // Si on a maintenant un email mais que email_introuvable était à true, on remet à false
      if (updates.email) {
        updates.email_introuvable = false
      }

      const result = await apiPatch(`/prospects?id=eq.${selected.id}`, updates)
      const updated = Array.isArray(result) ? result[0] : result

      // Mise à jour de l'UI
      setProspects(curr => curr.map(p => p.id === selected.id ? { ...p, ...updates } : p))
      setSelected(prev => ({ ...prev, ...updates }))
      showMsg(`✅ Contact enrichi pour ${selected.nom_entreprise}`, 3000)
    } catch (err) {
      showMsg(`❌ Erreur enregistrement : ${err.message}`, 5000)
    }
    setEnrichSaving(false)
  }

  // --- GÉNÉRATION MESSAGE IA ---

  const lancerGenerationIA = async () => {
    if (!selected) return

    // Vérification clé API présente
    const apiKey = getAgentsApiKey()
    if (!apiKey) {
      showMsg('❌ Clé Agents Doppler introuvable dans le Coffre-fort. Ajoute un compte nommé "Agents Doppler API" avec ta clé.', 6000)
      return
    }

    // Détection email manquant
    const hasEmail = selected.email && !selected.email_introuvable
    if (!hasEmail) {
      const ok = confirm(
        `${selected.nom_entreprise} n'a pas d'email connu.\n\n` +
        `Générer le message quand même (utile pour copier/coller manuellement ailleurs) ?`
      )
      if (!ok) return
    }

    setIaGenerating(true)
    setIaCopied(null)
    try {
      const config = getProjectConfig(project.id, project.label)
      const result = await genererMessageIA({
        prospectId: selected.id,
        projectConfig: config,
        allowNoEmail: !hasEmail,
      })

      const data = {
        sujet: result.sujet,
        message: result.message,
        prospect_nom: result.prospect_nom,
        tokens_used: result.tokens_used,
      }

      saveStoredMessage(selected.id, data)
      setIaMessage({ ...data, generated_at: new Date().toISOString() })
      showMsg(`✨ Message généré (${result.tokens_used} tokens)`, 3000)
    } catch (err) {
      showMsg(`❌ Erreur génération : ${err.message}`, 6000)
    }
    setIaGenerating(false)
  }

  const updateIaField = (field, value) => {
    setIaMessage(prev => {
      if (!prev) return prev
      const updated = { ...prev, [field]: value }
      // Sauve automatiquement les modifs en local
      if (selected) saveStoredMessage(selected.id, updated)
      return updated
    })
  }

  const copierTexte = (text, label) => {
    navigator.clipboard.writeText(text)
    setIaCopied(label)
    setTimeout(() => setIaCopied(null), 1500)
  }

  const supprimerMessageIa = () => {
    if (!selected) return
    if (!confirm('Supprimer le message généré ?')) return
    deleteStoredMessage(selected.id)
    setIaMessage(null)
    showMsg('🗑️ Message supprimé', 2000)
  }

  // --- ENVOI EMAIL ---

  const lancerEnvoiEmail = async () => {
    if (!selected || !iaMessage) return

    // Vérifs avant envoi
    if (!selected.email || selected.email_introuvable) {
      showMsg('❌ Pas d\'email valide pour ce prospect', 4000)
      return
    }
    if (selected.email_envoye_le) {
      showMsg('⚠️ Un email a déjà été envoyé à ce prospect', 4000)
      return
    }
    if (!iaMessage.sujet?.trim() || !iaMessage.message?.trim()) {
      showMsg('❌ Sujet et message requis', 3000)
      return
    }

    // Confirmation utilisateur
    const ok = confirm(
      `Envoyer cet email à ${selected.nom_entreprise} ?\n\n` +
      `Destinataire : ${selected.email}\n` +
      `Sujet : ${iaMessage.sujet}\n\n` +
      `L'envoi est définitif et ne pourra pas être annulé.`
    )
    if (!ok) return

    setIaSending(true)
    try {
      const result = await envoyerEmailViaAgent({
        prospectId: selected.id,
        sujet: iaMessage.sujet,
        message: iaMessage.message,
      })

      // Mise à jour locale du prospect avec les infos d'envoi
      const updates = {
        statut: 'contacte',
        contacte_le: result.envoye_le,
        email_envoye_le: result.envoye_le,
        email_resend_id: result.resend_id,
        email_sujet: iaMessage.sujet,
        email_message: iaMessage.message,
      }
      setProspects(curr => curr.map(p => p.id === selected.id ? { ...p, ...updates } : p))
      setSelected(prev => ({ ...prev, ...updates }))

      // Mise à jour locale du iaMessage pour afficher le statut "envoyé"
      setIaMessage(prev => ({ ...prev, generated_at: result.envoye_le }))

      // Le message en localStorage devient obsolète puisqu'il est maintenant en base
      deleteStoredMessage(selected.id)

      showMsg(`✅ Email envoyé à ${result.prospect_email}`, 5000)
    } catch (err) {
      showMsg(`❌ Erreur envoi : ${err.message}`, 6000)
    }
    setIaSending(false)
  }

  // ============================================
  // RENDU
  // ============================================
  if (loading) {
    return (
      <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(237,232,219,0.5)'}}>
        ⏳ Chargement des prospects depuis Pilot DB...
      </div>
    )
  }

  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 20, overflow: 'hidden'}}>

      {/* HEADER */}
      <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0}}>
        <div style={{padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'}}>
          <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>Total</p>
          <p style={{fontSize: 22, fontWeight: 800, color: '#EDE8DB', margin: 0}}>{prospectsAffiches.length}</p>
        </div>
        <div style={{padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'}}>
          <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>Clients</p>
          <p style={{fontSize: 22, fontWeight: 800, color: '#5BC78A', margin: 0}}>
            {prospectsAffiches.filter(p => p.statut === 'client').length}
          </p>
        </div>
        <div style={{padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'}}>
          <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>Score moyen</p>
          <p style={{fontSize: 22, fontWeight: 800, color: '#D4A853', margin: 0}}>
            {prospectsAffiches.length > 0 ? (totalScore / prospectsAffiches.length).toFixed(1) : '–'}
          </p>
        </div>
        <div style={{padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'}}>
          <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>Avec email</p>
          <p style={{fontSize: 22, fontWeight: 800, color: '#A85BC7', margin: 0}}>
            {prospectsAffiches.filter(p => p.email).length}
          </p>
        </div>

        <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto'}}>
          {filterSession && (
            <button onClick={() => setFilterSession(null)}
              style={{padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.4)', background: 'rgba(212,168,83,0.08)', color: '#D4A853', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'}}>
              ✕ Filtre session
            </button>
          )}
          <button onClick={() => csvRef.current?.click()}
            style={{padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(91,163,199,0.3)', background: 'rgba(91,163,199,0.06)', color: '#5BA3C7', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'}}>
            📥 Import CSV
          </button>
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{display: 'none'}}/>
          {selection.size > 0 && (
            <button onClick={supprimerSelection}
              style={{padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(199,91,78,0.4)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'}}>
              🗑️ Supprimer ({selection.size})
            </button>
          )}
          <button onClick={() => fetchAll()}
            style={{padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(237,232,219,0.5)', fontSize: 12, cursor: 'pointer'}}>
            🔄 Actualiser
          </button>

          <div style={{display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)'}}>
            <button onClick={() => setView('kanban')}
              style={{padding: '6px 10px', borderRadius: 6, border: 'none', background: view === 'kanban' ? project.color : 'transparent', color: view === 'kanban' ? '#0D1B2A' : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer'}}>
              🗂️ Kanban
            </button>
            <button onClick={() => setView('liste')}
              style={{padding: '6px 10px', borderRadius: 6, border: 'none', background: view === 'liste' ? project.color : 'transparent', color: view === 'liste' ? '#0D1B2A' : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer'}}>
              📋 Liste
            </button>
            <button onClick={() => setView('sessions')}
              style={{padding: '6px 10px', borderRadius: 6, border: 'none', background: view === 'sessions' ? project.color : 'transparent', color: view === 'sessions' ? '#0D1B2A' : 'rgba(237,232,219,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer'}}>
              🔍 Recherches ({sessions.length})
            </button>
          </div>
        </div>
      </div>

      {/* RECHERCHE AUTOMATIQUE */}
      {(view === 'kanban' || view === 'liste') && (
        <div style={{padding: '14px 18px', borderRadius: 14, background: `${project.color}08`, border: `1px solid ${project.color}20`, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, flexShrink: 0}}>
          <div style={{flex: 1, minWidth: 140}}>
            <label style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 4}}>Secteur</label>
            <select value={autoSecteur} onChange={e => setAutoSecteur(e.target.value)} style={{...iS, padding: '8px', cursor: 'pointer'}}>
              <option value="">Choisir un secteur</option>
              {SECTEURS.filter(s => s.naf).map(s => <option key={s.naf} value={s.naf}>{s.label}</option>)}
            </select>
          </div>
          <div style={{flex: 1, minWidth: 100}}>
            <label style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 4}}>Département</label>
            <select value={autoDept} onChange={e => setAutoDept(e.target.value)} style={{...iS, padding: '8px', cursor: 'pointer'}}>
              {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <button onClick={lancerAutoRecherche} disabled={autoSearching}
              style={{padding: '9px 22px', borderRadius: 10, border: 'none', background: project.color, color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: autoSearching ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: autoSearching ? 0.6 : 1}}>
              {autoSearching ? '⏳ Recherche en cours (jusqu\'à 30s)...' : '🚀 Lancer la prospection auto'}
            </button>
          </div>
        </div>
      )}

      {/* MESSAGE */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, flexShrink: 0,
          background: msg.startsWith('❌') ? 'rgba(199,91,78,0.1)' : msg.startsWith('⚠️') ? 'rgba(212,168,83,0.1)' : 'rgba(91,199,138,0.1)',
          border: `1px solid ${msg.startsWith('❌') ? 'rgba(199,91,78,0.2)' : msg.startsWith('⚠️') ? 'rgba(212,168,83,0.2)' : 'rgba(91,199,138,0.2)'}`,
          fontSize: 13, color: msg.startsWith('❌') ? '#C75B4E' : msg.startsWith('⚠️') ? '#D4A853' : '#5BC78A'
        }}>
          {msg}
        </div>
      )}

      {/* VUE KANBAN */}
      {view === 'kanban' && (
        <div style={{flex: 1, overflowX: 'auto', display: 'flex', gap: 12, paddingBottom: 8}}>
          {COLONNES.map(col => {
            const items = prospectsAffiches.filter(p => statutBaseToColonne(p.statut) === col.id)
            return (
              <div key={col.id} onDragOver={onDragOver} onDrop={(e) => onDrop(e, col)}
                style={{width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8}}>
                <div style={{padding: '8px 12px', borderRadius: 10, background: `${col.color}15`, border: `1px solid ${col.color}30`, display: 'flex', alignItems: 'center', gap: 6}}>
                  <span>{col.emoji}</span>
                  <span style={{fontSize: 12, fontWeight: 700, color: col.color}}>{col.label}</span>
                  <span style={{marginLeft: 'auto', fontSize: 11, color: 'rgba(237,232,219,0.4)'}}>{items.length}</span>
                </div>
                <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 50}}>
                  {items.map(p => {
                    const hasMessage = !!getStoredMessage(p.id)
                    const emailSent = !!p.email_envoye_le
                    return (
                      <div key={p.id} draggable onDragStart={(e) => onDragStart(e, p)} onClick={() => setSelected(p)}
                        style={{
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10, padding: '10px 12px', cursor: 'grab', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                        <p style={{fontSize: 12, fontWeight: 700, color: '#EDE8DB', margin: '0 0 3px'}}>{p.nom_entreprise}</p>
                        {p.ville && <p style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>{p.ville}{p.code_postal ? ` (${p.code_postal})` : ''}</p>}
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6}}>
                          <span style={{fontSize: 10, color: 'rgba(237,232,219,0.3)'}}>{p.source || 'manuel'}</span>
                          <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                            {emailSent && <span style={{fontSize: 10, color: '#5BC78A'}} title={`Email envoyé le ${new Date(p.email_envoye_le).toLocaleDateString('fr-FR')}`}>📤</span>}
                            {hasMessage && !emailSent && <span style={{fontSize: 10, color: '#A85BC7'}} title="Message IA généré (pas encore envoyé)">✨</span>}
                            {p.email && <span style={{fontSize: 10, color: '#5BC78A'}} title={p.email}>📧</span>}
                            {p.score_qualite && <span style={{fontSize: 11, fontWeight: 800, color: scoreColor(p.score_qualite)}}>{p.score_qualite}/5</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && <div style={{padding: 16, textAlign: 'center', color: 'rgba(237,232,219,0.2)', fontSize: 11, border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 10}}>Vide</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VUE LISTE */}
      {view === 'liste' && (
        <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6}}>
          {prospectsAffiches.length === 0
            ? <div style={{padding: 40, textAlign: 'center', color: 'rgba(237,232,219,0.3)', fontSize: 13}}>Aucun prospect. Lance une prospection auto ci-dessus.</div>
            : prospectsAffiches.map(p => {
              const colonneId = statutBaseToColonne(p.statut)
              const col = COLONNES.find(c => c.id === colonneId) || COLONNES[0]
              const hasMessage = !!getStoredMessage(p.id)
              const emailSent = !!p.email_envoye_le
              return (
                <div key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    background: selection.has(p.id) ? 'rgba(199,91,78,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selection.has(p.id) ? 'rgba(199,91,78,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10, cursor: 'pointer'
                  }}
                  onClick={() => setSelected(p)}>
                  <input type="checkbox" checked={selection.has(p.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(p.id) }}
                    onClick={e => e.stopPropagation()}
                    style={{cursor: 'pointer', accentColor: '#C75B4E', width: 14, height: 14, flexShrink: 0}}/>
                  <div style={{flex: 1, minWidth: 0}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: '#EDE8DB'}}>{p.nom_entreprise}</span>
                    {p.ville && <span style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', marginLeft: 8}}>{p.ville}</span>}
                  </div>
                  {emailSent && <span style={{fontSize: 11, color: '#5BC78A', whiteSpace: 'nowrap'}} title={`Envoyé le ${new Date(p.email_envoye_le).toLocaleDateString('fr-FR')}`}>📤</span>}
                  {hasMessage && !emailSent && <span style={{fontSize: 11, color: '#A85BC7', whiteSpace: 'nowrap'}} title="Message IA généré (pas encore envoyé)">✨</span>}
                  {p.email && <span style={{fontSize: 11, color: '#5BC78A', whiteSpace: 'nowrap'}} title={p.email}>📧 {p.email.length > 25 ? p.email.substring(0, 25) + '…' : p.email}</span>}
                  <span style={{fontSize: 10, color: col.color, background: `${col.color}15`, padding: '2px 8px', borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap'}}>
                    {col.emoji} {col.label}
                  </span>
                  {p.score_qualite && <span style={{fontSize: 12, fontWeight: 800, color: scoreColor(p.score_qualite)}}>{p.score_qualite}/5</span>}
                  <button onClick={e => { e.stopPropagation(); supprimer(p.id) }}
                    style={{background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(237,232,219,0.2)', fontSize: 14, padding: 4}}
                    onMouseEnter={e => e.currentTarget.style.color = '#C75B4E'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(237,232,219,0.2)'}>🗑️</button>
                </div>
              )
            })
          }
        </div>
      )}

      {/* VUE SESSIONS */}
      {view === 'sessions' && (
        <div style={{flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8}}>
          {sessions.length === 0
            ? <div style={{padding: 40, textAlign: 'center', color: 'rgba(237,232,219,0.3)', fontSize: 13}}>Aucune session.</div>
            : sessions.map(s => {
              const dateObj = new Date(s.created_at)
              const dateStr = dateObj.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              const nbReels = prospects.filter(p => p.session_id === s.id).length
              return (
                <div key={s.id} style={{padding: '14px 16px', background: filterSession === s.id ? `${project.color}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${filterSession === s.id ? project.color : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <p style={{fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0, flex: 1}}>{s.nom}</p>
                    <span style={{fontSize: 11, color: 'rgba(237,232,219,0.5)'}}>{dateStr}</span>
                  </div>
                  <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
                    {s.criteres && (
                      <span style={{fontSize: 11, color: 'rgba(237,232,219,0.5)'}}>
                        {s.criteres.secteur} · dept {s.criteres.departement}
                      </span>
                    )}
                    <span style={{fontSize: 11, color: '#5BC78A', background: 'rgba(91,199,138,0.08)', padding: '2px 8px', borderRadius: 8, fontWeight: 700}}>
                      {nbReels} prospect(s) en base
                    </span>
                    <button onClick={() => { setFilterSession(s.id); setView('kanban') }}
                      style={{marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', background: project.color, color: '#0D1B2A', fontSize: 11, fontWeight: 700, cursor: 'pointer'}}>
                      Voir les prospects
                    </button>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* DRAWER DETAIL PROSPECT */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'flex-end'}}>
          <div onClick={e => e.stopPropagation()}
            style={{width: 560, maxWidth: '95%', height: '100%', background: '#0D1B2A', borderLeft: `1px solid ${project.color}30`, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16}}>

            {/* Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12}}>
              <div>
                <h2 style={{fontSize: 18, fontWeight: 800, color: '#EDE8DB', margin: '0 0 4px'}}>{selected.nom_entreprise}</h2>
                {selected.ville && <p style={{fontSize: 12, color: 'rgba(237,232,219,0.5)', margin: 0}}>{selected.adresse || `${selected.code_postal || ''} ${selected.ville}`}</p>}
              </div>
              <button onClick={() => setSelected(null)} style={{background: 'transparent', border: 'none', color: 'rgba(237,232,219,0.5)', fontSize: 20, cursor: 'pointer'}}>✕</button>
            </div>

            {/* Métadonnées */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
              <div style={{padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)'}}>
                <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 2px'}}>SIRET</p>
                <p style={{fontSize: 12, color: '#EDE8DB', margin: 0, fontFamily: 'monospace'}}>{selected.siret}</p>
              </div>
              <div style={{padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)'}}>
                <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 2px'}}>SIREN</p>
                <p style={{fontSize: 12, color: '#EDE8DB', margin: 0, fontFamily: 'monospace'}}>{selected.siren}</p>
              </div>
              {selected.code_naf && (
                <div style={{padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)'}}>
                  <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 2px'}}>Code NAF</p>
                  <p style={{fontSize: 12, color: '#EDE8DB', margin: 0}}>{selected.code_naf}</p>
                </div>
              )}
              {selected.score_qualite && (
                <div style={{padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)'}}>
                  <p style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '0 0 2px'}}>Score qualité</p>
                  <p style={{fontSize: 12, color: scoreColor(selected.score_qualite), margin: 0, fontWeight: 800}}>{selected.score_qualite}/5</p>
                </div>
              )}
            </div>

            {/* SECTION ENRICHISSEMENT MANUEL */}
            <div style={{padding: '16px', borderRadius: 12, background: `${project.color}08`, border: `1px solid ${project.color}20`, display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                <p style={{fontSize: 12, fontWeight: 700, color: project.color, margin: 0}}>🔍 Enrichir le contact</p>
                <button onClick={() => ouvrirRechercheManuelle(selected)}
                  style={{padding: '6px 12px', borderRadius: 8, border: 'none', background: project.color, color: '#0D1B2A', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'}}>
                  🌐 Chercher sur Google
                </button>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                <div>
                  <label style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 3}}>📧 Email</label>
                  <input type="email" value={enrichData.email} onChange={e => setEnrichData(d => ({ ...d, email: e.target.value }))}
                    placeholder="contact@exemple.fr" style={iS}/>
                </div>
                <div>
                  <label style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 3}}>📞 Téléphone</label>
                  <input type="tel" value={enrichData.telephone} onChange={e => setEnrichData(d => ({ ...d, telephone: e.target.value }))}
                    placeholder="01 23 45 67 89" style={iS}/>
                </div>
                <div>
                  <label style={{fontSize: 10, color: 'rgba(237,232,219,0.4)', display: 'block', marginBottom: 3}}>🌐 Site web</label>
                  <input type="url" value={enrichData.site_web} onChange={e => setEnrichData(d => ({ ...d, site_web: e.target.value }))}
                    placeholder="https://www.exemple.fr" style={iS}/>
                </div>
              </div>

              <button onClick={sauvegarderEnrichissement} disabled={enrichSaving}
                style={{padding: '10px 14px', borderRadius: 8, border: 'none', background: '#5BC78A', color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: enrichSaving ? 'not-allowed' : 'pointer', opacity: enrichSaving ? 0.6 : 1}}>
                {enrichSaving ? '⏳ Enregistrement...' : '💾 Enregistrer le contact'}
              </button>
            </div>

            {/* SECTION GÉNÉRATION MESSAGE IA */}
            <div style={{padding: '16px', borderRadius: 12, background: 'rgba(168,91,199,0.08)', border: '1px solid rgba(168,91,199,0.25)', display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                <p style={{fontSize: 12, fontWeight: 700, color: '#A85BC7', margin: 0}}>
                  {selected.email_envoye_le ? '✅ Email envoyé' : '✨ Message de prospection IA'}
                </p>
                {iaMessage && (
                  <span style={{fontSize: 10, color: 'rgba(237,232,219,0.4)'}}>
                    {selected.email_envoye_le
                      ? `Envoyé le ${new Date(selected.email_envoye_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : `Généré le ${new Date(iaMessage.generated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${iaMessage.tokens_used ? ` · ${iaMessage.tokens_used} tokens` : ''}`
                    }
                  </span>
                )}
              </div>

              {!iaMessage ? (
                <button onClick={lancerGenerationIA} disabled={iaGenerating}
                  style={{padding: '12px 14px', borderRadius: 8, border: 'none', background: '#A85BC7', color: '#0D1B2A', fontSize: 12, fontWeight: 800, cursor: iaGenerating ? 'not-allowed' : 'pointer', opacity: iaGenerating ? 0.6 : 1}}>
                  {iaGenerating ? '⏳ Génération en cours (jusqu\'à 15s)...' : '✨ Générer un message personnalisé'}
                </button>
              ) : (
                <>
                  {/* Sujet (éditable si pas encore envoyé, lecture seule sinon) */}
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3}}>
                      <label style={{fontSize: 10, color: 'rgba(237,232,219,0.4)'}}>Sujet</label>
                      <button onClick={() => copierTexte(iaMessage.sujet, 'sujet')}
                        style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: iaCopied === 'sujet' ? '#5BC78A' : 'rgba(237,232,219,0.4)', padding: 0}}>
                        {iaCopied === 'sujet' ? '✅ Copié' : '📋 Copier'}
                      </button>
                    </div>
                    <input value={iaMessage.sujet} onChange={e => updateIaField('sujet', e.target.value)}
                      readOnly={!!selected.email_envoye_le}
                      style={{...iS, opacity: selected.email_envoye_le ? 0.7 : 1, cursor: selected.email_envoye_le ? 'default' : 'text'}}/>
                  </div>

                  {/* Message (éditable si pas encore envoyé, lecture seule sinon) */}
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3}}>
                      <label style={{fontSize: 10, color: 'rgba(237,232,219,0.4)'}}>Corps du message</label>
                      <button onClick={() => copierTexte(iaMessage.message, 'message')}
                        style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: iaCopied === 'message' ? '#5BC78A' : 'rgba(237,232,219,0.4)', padding: 0}}>
                        {iaCopied === 'message' ? '✅ Copié' : '📋 Copier'}
                      </button>
                    </div>
                    <textarea value={iaMessage.message} onChange={e => updateIaField('message', e.target.value)}
                      readOnly={!!selected.email_envoye_le}
                      rows={8} style={{...iS, resize: 'vertical', fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.5, opacity: selected.email_envoye_le ? 0.7 : 1, cursor: selected.email_envoye_le ? 'default' : 'text'}}/>
                  </div>

                  {/* Boutons d'action */}
                  {selected.email_envoye_le ? (
                    /* Email déjà envoyé : badge informatif + stats tracking */
                    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                      <div style={{padding: '10px 14px', borderRadius: 8, background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.25)', display: 'flex', alignItems: 'center', gap: 8}}>
                        <span style={{fontSize: 14}}>✅</span>
                        <span style={{fontSize: 12, color: '#5BC78A', fontWeight: 600}}>
                          Email envoyé à {selected.email}
                        </span>
                      </div>

                      {/* Résumé tracking Resend */}
                      {(() => {
                        const summary = summarizeEmailEvents(iaEvents)
                        if (!summary) {
                          return (
                            <div style={{padding: '8px 14px', fontSize: 11, color: 'rgba(237,232,219,0.4)', fontStyle: 'italic'}}>
                              ⏳ En attente du suivi de livraison...
                            </div>
                          )
                        }
                        // Cas bounce ou plainte spam
                        if (summary.bounced || summary.complained) {
                          return (
                            <div style={{padding: '8px 14px', borderRadius: 8, background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.25)', fontSize: 11, color: '#C75B4E', display: 'flex', alignItems: 'center', gap: 6}}>
                              <span>{summary.complained ? '⚠️' : '↩️'}</span>
                              <span style={{fontWeight: 600}}>
                                {summary.complained
                                  ? 'Email signalé comme spam par le destinataire'
                                  : `Email rejeté ${summary.bouncedAt ? timeAgo(summary.bouncedAt) : ''}`}
                              </span>
                            </div>
                          )
                        }
                        // Cas normal : delivered + opens + clicks
                        const parts = []
                        if (summary.delivered) parts.push('📬 Délivré')
                        if (summary.opens > 0) {
                          parts.push(`👀 Ouvert ${summary.opens} fois`)
                        } else if (summary.delivered) {
                          parts.push('👀 Pas encore ouvert')
                        }
                        if (summary.clicks > 0) parts.push(`🖱️ Cliqué ${summary.clicks} fois`)
                        const lastActivity = summary.lastClickAt || summary.lastOpenAt || summary.deliveredAt
                        return (
                          <div style={{padding: '8px 14px', borderRadius: 8, background: 'rgba(91,168,199,0.08)', border: '1px solid rgba(91,168,199,0.2)', fontSize: 11, color: '#9CC8DD', display: 'flex', flexDirection: 'column', gap: 3}}>
                            <span style={{fontWeight: 600}}>{parts.join(' · ')}</span>
                            {lastActivity && (
                              <span style={{fontSize: 10, color: 'rgba(237,232,219,0.4)'}}>
                                Dernière activité : {timeAgo(lastActivity)}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    /* Email pas encore envoyé : Régénérer + Envoyer + Supprimer */
                    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                      {/* Bouton Envoyer (vert, pleine largeur) — visible seulement si email présent */}
                      {selected.email && !selected.email_introuvable ? (
                        <button onClick={lancerEnvoiEmail} disabled={iaSending || iaGenerating}
                          style={{padding: '12px 14px', borderRadius: 8, border: 'none', background: '#5BC78A', color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: (iaSending || iaGenerating) ? 'not-allowed' : 'pointer', opacity: (iaSending || iaGenerating) ? 0.6 : 1}}>
                          {iaSending ? '⏳ Envoi en cours...' : `📤 Envoyer à ${selected.email}`}
                        </button>
                      ) : (
                        <div style={{padding: '10px 14px', borderRadius: 8, background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)', fontSize: 11, color: '#D4A853', textAlign: 'center'}}>
                          📭 Pas d'email — utilise « 📋 Copier » pour copier-coller manuellement
                        </div>
                      )}

                      {/* Régénérer + Supprimer */}
                      <div style={{display: 'flex', gap: 8}}>
                        <button onClick={lancerGenerationIA} disabled={iaGenerating || iaSending}
                          style={{flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(168,91,199,0.4)', background: 'rgba(168,91,199,0.1)', color: '#A85BC7', fontSize: 11, fontWeight: 700, cursor: (iaGenerating || iaSending) ? 'not-allowed' : 'pointer', opacity: (iaGenerating || iaSending) ? 0.6 : 1}}>
                          {iaGenerating ? '⏳ Régénération...' : '🔄 Régénérer'}
                        </button>
                        <button onClick={supprimerMessageIa} disabled={iaSending}
                          style={{padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(199,91,78,0.3)', background: 'transparent', color: '#C75B4E', fontSize: 11, fontWeight: 700, cursor: iaSending ? 'not-allowed' : 'pointer', opacity: iaSending ? 0.6 : 1}}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sources externes */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <p style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', margin: 0}}>Sources externes</p>
              <a href={lienAnnuaire(selected.siren)} target="_blank" rel="noopener noreferrer"
                style={{color: '#5BA3C7', fontSize: 12, textDecoration: 'none', padding: '8px 12px', borderRadius: 8, background: 'rgba(91,163,199,0.06)', border: '1px solid rgba(91,163,199,0.15)'}}>
                🔗 Voir sur Annuaire des Entreprises
              </a>
            </div>

            {selected.notes && (
              <div>
                <p style={{fontSize: 11, color: 'rgba(237,232,219,0.4)', margin: '0 0 4px'}}>Notes</p>
                <p style={{fontSize: 13, color: '#EDE8DB', margin: 0, whiteSpace: 'pre-wrap'}}>{selected.notes}</p>
              </div>
            )}

            {/* Actions footer */}
            <div style={{marginTop: 'auto', display: 'flex', gap: 8}}>
              <button onClick={() => supprimer(selected.id)}
                style={{padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(199,91,78,0.4)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 12, fontWeight: 700, cursor: 'pointer'}}>
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function scoreColor(score) {
  if (score >= 4) return '#5BC78A'
  if (score >= 3) return '#D4A853'
  return '#C75B4E'
}

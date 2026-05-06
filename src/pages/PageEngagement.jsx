import { useState, useEffect } from 'react'

// -- Constantes ---------------------------------------------------------
const ALL_PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',    icon: '💼', urlPlaceholder: 'https://www.linkedin.com/in/votre-profil/' },
  { id: 'twitter',   label: 'X / Twitter', icon: '🐦', urlPlaceholder: 'https://x.com/votre_compte' },
  { id: 'youtube',   label: 'YouTube',     icon: '🎬', urlPlaceholder: 'https://www.youtube.com/@votre_chaine/videos' },
  { id: 'facebook',  label: 'Facebook',    icon: '👥', urlPlaceholder: 'https://www.facebook.com/votre.page' },
  { id: 'instagram', label: 'Instagram',   icon: '📸', urlPlaceholder: 'https://www.instagram.com/votre_compte/' },
  { id: 'tiktok',    label: 'TikTok',      icon: '🎵', urlPlaceholder: 'https://www.tiktok.com/@votre_compte' },
  { id: 'threads',   label: 'Threads',     icon: '🧵', urlPlaceholder: 'https://www.threads.net/@votre_compte' },
]

const STORAGE_KEY = (projectId) => `pilotage_engagement_${projectId}`

function loadEngagement(projectId) {
  try {
    const s = localStorage.getItem(STORAGE_KEY(projectId))
    return s ? JSON.parse(s) : { profiles: {}, watched_channels: [], scan_history: {} }
  } catch {
    return { profiles: {}, watched_channels: [], scan_history: {} }
  }
}

function saveEngagement(projectId, data) {
  localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(data))
}

// Recupere la cle YouTube depuis le coffre-fort (premier compte trouve avec apiKey commençant par AIza)
function loadYouTubeApiKey() {
  try {
    // Cherche dans tous les coffres-forts par projet
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('pilotage_vault_')) continue
      const vault = JSON.parse(localStorage.getItem(key) || '[]')
      const found = vault.find(c =>
        (c.apiKey || c.cleApi || '').startsWith('AIza') ||
        (c.nom || '').toLowerCase().includes('youtube')
      )
      if (found && (found.apiKey || found.cleApi)) {
        return found.apiKey || found.cleApi
      }
    }
  } catch {}
  return null
}

function fmt(n) {
  return (n || 0).toLocaleString('fr-FR')
}

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'il y a moins d\'1 min'
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`
  return `il y a ${Math.floor(sec / 86400)} j`
}

// -- Composant Profil URL editor ----------------------------------------
function ProfilesEditor({ project, data, onSave }) {
  const platforms = project.reseaux || []
  const [profiles, setProfiles] = useState(data.profiles || {})

  const handleChange = (pid, val) => {
    const updated = { ...profiles, [pid]: val }
    setProfiles(updated)
  }

  const handleSave = () => {
    onSave({ ...data, profiles })
  }

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#EDE8DB',
    fontSize: 12,
    outline: 'none',
    fontFamily: "'Nunito Sans',sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: '0 0 4px' }}>🔗 URLs de tes profils</h3>
      <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', margin: '0 0 14px' }}>
        Renseigne ton profil sur chaque plateforme active du projet {project.label}. Sert au scan de tes posts.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {ALL_PLATFORMS.filter(p => platforms.includes(p.id)).map(p => (
          <div key={p.id}>
            <label style={{ fontSize: 11, color: 'rgba(237,232,219,0.5)', display: 'block', marginBottom: 4 }}>
              {p.icon} {p.label}
            </label>
            <input
              value={profiles[p.id] || ''}
              onChange={e => handleChange(p.id, e.target.value)}
              placeholder={p.urlPlaceholder}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        style={{
          marginTop: 14,
          padding: '8px 18px',
          borderRadius: 8,
          border: 'none',
          background: project.color,
          color: '#0D1B2A',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        💾 Enregistrer les URLs
      </button>
    </div>
  )
}

// -- Onglet 1 : Mes posts -----------------------------------------------
function TabMyPosts({ project, data, onUpdate }) {
  const [scanning, setScanning] = useState(null) // platform en cours de scan
  const [filter, setFilter] = useState('all')    // 'all' | platform id
  const platforms = project.reseaux || []

  const scanPlatform = async (platform) => {
    const url = data.profiles?.[platform]
    if (!url) {
      alert(`Renseigne d'abord l'URL de ton profil ${platform}.`)
      return
    }
    if (!window.electronAPI?.scanPlatformPosts) {
      alert('Fonction scan disponible uniquement en mode Electron.')
      return
    }

    setScanning(platform)
    try {
      const result = await window.electronAPI.scanPlatformPosts(platform, url)
      if (result.success) {
        const newScanHistory = {
          ...(data.scan_history || {}),
          [platform]: {
            scanned_at: result.scanned_at,
            posts: result.posts || [],
          },
        }
        onUpdate({ ...data, scan_history: newScanHistory })
      } else {
        alert(`Erreur scan ${platform} : ${result.error}`)
      }
    } catch (e) {
      alert(`Erreur scan ${platform} : ${e.message}`)
    }
    setScanning(null)
  }

  const scanAll = async () => {
    for (const p of platforms) {
      if (data.profiles?.[p]) {
        await scanPlatform(p)
      }
    }
  }

  // Aplatit tous les posts pour affichage tableau
  const allPosts = []
  for (const [plt, info] of Object.entries(data.scan_history || {})) {
    if (filter !== 'all' && filter !== plt) continue
    for (const post of (info.posts || [])) {
      allPosts.push({ ...post, platform: plt, scanned_at: info.scanned_at })
    }
  }
  // Tri par engagement total decroissant
  allPosts.sort((a, b) => {
    const eA = (a.likes || 0) + (a.comments || 0) + (a.shares || 0) + (a.views || 0) / 100
    const eB = (b.likes || 0) + (b.comments || 0) + (b.shares || 0) + (b.views || 0) / 100
    return eB - eA
  })

  return (
    <div>
      <ProfilesEditor project={project} data={data} onSave={onUpdate} />

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>🔄 Scanner mes publications</h3>
          <button
            onClick={scanAll}
            disabled={scanning !== null}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: scanning ? `${project.color}40` : project.color,
              color: '#0D1B2A',
              fontSize: 12,
              fontWeight: 800,
              cursor: scanning ? 'not-allowed' : 'pointer',
            }}
          >
            {scanning ? `⏳ Scan ${scanning}...` : '🚀 Tout scanner'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {ALL_PLATFORMS.filter(p => platforms.includes(p.id)).map(p => {
            const hist = data.scan_history?.[p.id]
            const count = hist?.posts?.length || 0
            const isScanning = scanning === p.id
            return (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#EDE8DB' }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', marginBottom: 8 }}>
                  {count} post{count > 1 ? 's' : ''} · {timeSince(hist?.scanned_at)}
                </div>
                <button
                  onClick={() => scanPlatform(p.id)}
                  disabled={isScanning || !data.profiles?.[p.id]}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: 7,
                    border: `1px solid ${data.profiles?.[p.id] ? project.color : 'rgba(255,255,255,0.1)'}`,
                    background: 'transparent',
                    color: data.profiles?.[p.id] ? project.color : 'rgba(237,232,219,0.3)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: isScanning || !data.profiles?.[p.id] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isScanning ? '⏳...' : data.profiles?.[p.id] ? '🔄 Scanner' : '🔗 URL manquante'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {allPosts.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>
              📊 Mes posts ({allPosts.length})
            </h3>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                background: '#1a1d24',
                color: '#EDE8DB',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <option value="all">Toutes plateformes</option>
              {Object.keys(data.scan_history || {}).map(plt => (
                <option key={plt} value={plt}>{ALL_PLATFORMS.find(p => p.id === plt)?.label || plt}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
            {allPosts.map((post, i) => {
              const plt = ALL_PLATFORMS.find(p => p.id === post.platform)
              return (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: 14,
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px',
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: project.color }}>
                        {plt?.icon} {plt?.label}
                      </span>
                      {post.date && <span style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)' }}>· {post.date}</span>}
                    </div>
                    <p style={{
                      fontSize: 12,
                      color: 'rgba(237,232,219,0.7)',
                      lineHeight: 1.6,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 80,
                      overflow: 'hidden',
                    }}>
                      {post.text || '(sans texte)'}
                    </p>
                    {post.link && (
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: project.color, textDecoration: 'none', marginTop: 6, display: 'inline-block' }}
                      >
                        🔗 Voir le post
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignContent: 'start' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE8DB' }}>{fmt(post.likes)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>👍 likes</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE8DB' }}>{fmt(post.comments)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>💬 com.</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE8DB' }}>{fmt(post.shares)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>🔁 partages</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDE8DB' }}>{fmt(post.views)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>👁 vues</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allPosts.length === 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '2px dashed rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 40,
          textAlign: 'center',
          color: 'rgba(237,232,219,0.4)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 13, margin: 0 }}>Aucun post scanné pour ce projet.</p>
          <p style={{ fontSize: 11, margin: '4px 0 0', color: 'rgba(237,232,219,0.3)' }}>
            Renseigne tes URLs de profil et lance un scan.
          </p>
        </div>
      )}
    </div>
  )
}

// -- Onglet 2 : Veille YouTube ------------------------------------------
function TabYouTubeWatch({ project, data, onUpdate }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [openingId, setOpeningId] = useState(null)
  const [apiKey, setApiKey] = useState(loadYouTubeApiKey())
  const [manualKey, setManualKey] = useState('')

  useEffect(() => {
    setApiKey(loadYouTubeApiKey())
  }, [])

  const watched = data.watched_channels || []

  const addChannel = async () => {
    if (!input.trim()) return
    if (!apiKey) {
      alert('Clé API YouTube introuvable. Ajoute-la d\'abord dans le Coffre-fort.')
      return
    }
    if (!window.electronAPI?.getYouTubeChannelStats) {
      alert('Fonctionnalité disponible uniquement en mode Electron.')
      return
    }

    setLoading(true)
    try {
      const result = await window.electronAPI.getYouTubeChannelStats(input.trim(), apiKey)
      if (result.success) {
        const newChannel = {
          id: result.channel.id,
          title: result.channel.title,
          thumbnail: result.channel.thumbnail,
          subscribers: result.channel.subscribers,
          total_views: result.channel.total_views,
          total_videos: result.channel.total_videos,
          stats: result.stats,
          added_at: new Date().toISOString(),
        }
        const exists = watched.find(c => c.id === newChannel.id)
        const updated = exists
          ? watched.map(c => c.id === newChannel.id ? newChannel : c)
          : [...watched, newChannel]
        onUpdate({ ...data, watched_channels: updated })
        setInput('')
      } else {
        alert(`Erreur : ${result.error || 'Chaîne introuvable'}`)
      }
    } catch (e) {
      alert(`Erreur : ${e.message}`)
    }
    setLoading(false)
  }

  const refreshChannel = async (channelId) => {
    if (!apiKey) return
    setLoading(true)
    try {
      const result = await window.electronAPI.getYouTubeChannelStats(channelId, apiKey)
      if (result.success) {
        const updated = watched.map(c => c.id === channelId ? {
          ...c,
          title: result.channel.title,
          thumbnail: result.channel.thumbnail,
          subscribers: result.channel.subscribers,
          total_views: result.channel.total_views,
          total_videos: result.channel.total_videos,
          stats: result.stats,
          updated_at: new Date().toISOString(),
        } : c)
        onUpdate({ ...data, watched_channels: updated })
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const removeChannel = (channelId) => {
    if (!confirm('Retirer cette chaîne de la veille ?')) return
    onUpdate({ ...data, watched_channels: watched.filter(c => c.id !== channelId) })
  }

  const openWithOverlay = async (channelId) => {
    if (!apiKey) return
    setOpeningId(channelId)
    try {
      const channelUrl = `https://www.youtube.com/channel/${channelId}`
      await window.electronAPI.openYouTubeWithOverlay(channelUrl, apiKey)
    } catch (e) {
      alert(`Erreur ouverture : ${e.message}`)
    }
    setOpeningId(null)
  }

  if (!apiKey) {
    return (
      <div style={{
        background: 'rgba(212,168,83,0.08)',
        border: '1px solid rgba(212,168,83,0.3)',
        borderRadius: 14,
        padding: 24,
        marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D4A853', margin: '0 0 8px' }}>⚠️ Clé API YouTube manquante</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.6)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Pour utiliser la veille YouTube, ajoute ta clé API YouTube Data v3 dans le module <strong>Coffre-fort</strong> (compte avec apiKey commençant par <code>AIza...</code>).
          Ou colle-la temporairement ici (elle sera utilisée pour cette session uniquement) :
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={manualKey}
            onChange={e => setManualKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#EDE8DB',
              fontSize: 12,
              outline: 'none',
              fontFamily: "'Nunito Sans',sans-serif",
            }}
          />
          <button
            onClick={() => { if (manualKey.trim()) setApiKey(manualKey.trim()) }}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#D4A853',
              color: '#0D1B2A',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Utiliser
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: '0 0 4px' }}>👁 Surveiller une chaîne YouTube</h3>
        <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', margin: '0 0 14px' }}>
          Colle l'URL de la chaîne, le @handle ou le channel ID (UCxxxxx).
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addChannel() }}
            placeholder="https://youtube.com/@nom-chaine ou @nom-chaine ou UCxxxxxxx"
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#EDE8DB',
              fontSize: 12,
              outline: 'none',
              fontFamily: "'Nunito Sans',sans-serif",
            }}
          />
          <button
            onClick={addChannel}
            disabled={loading || !input.trim()}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: loading || !input.trim() ? `${project.color}40` : project.color,
              color: '#0D1B2A',
              fontSize: 12,
              fontWeight: 800,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳' : '➕ Ajouter'}
          </button>
        </div>
      </div>

      {watched.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '2px dashed rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 40,
          textAlign: 'center',
          color: 'rgba(237,232,219,0.4)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📺</div>
          <p style={{ fontSize: 13, margin: 0 }}>Aucune chaîne surveillée pour ce projet.</p>
          <p style={{ fontSize: 11, margin: '4px 0 0', color: 'rgba(237,232,219,0.3)' }}>
            Ajoute des chaînes concurrentes ou inspirantes pour suivre leurs stats.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {watched.map(ch => (
            <div
              key={ch.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {ch.thumbnail && (
                  <img src={ch.thumbnail} alt={ch.title} style={{ width: 48, height: 48, borderRadius: '50%' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ch.title}
                  </h4>
                  <p style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)', margin: '2px 0 0' }}>
                    {fmt(ch.subscribers)} abonnés · {fmt(ch.total_videos)} vidéos
                  </p>
                </div>
                <button
                  onClick={() => removeChannel(ch.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(237,232,219,0.3)',
                    fontSize: 12,
                    padding: 4,
                  }}
                  title="Retirer de la veille"
                >
                  🗑
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 7, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: project.color }}>{fmt(ch.stats?.avg_views_last_30d)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>vues moy. 30j</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 7, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: project.color }}>{ch.stats?.videos_last_30d || 0}</div>
                  <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>vidéos / 30j</div>
                </div>
              </div>

              {ch.stats?.top_videos?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Top vidéos
                  </p>
                  {ch.stats.top_videos.slice(0, 3).map(v => (
                    <a
                      key={v.id}
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#EDE8DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(237,232,219,0.4)' }}>
                        {fmt(v.views)} vues
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {ch.stats?.top_tags?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tags fréquents
                  </p>
                  <div>
                    {ch.stats.top_tags.slice(0, 6).map(t => (
                      <span
                        key={t.tag}
                        style={{
                          display: 'inline-block',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(237,232,219,0.7)',
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 10,
                          margin: '2px 4px 2px 0',
                        }}
                      >
                        {t.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => openWithOverlay(ch.id)}
                  disabled={openingId === ch.id}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: 7,
                    border: 'none',
                    background: project.color,
                    color: '#0D1B2A',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: openingId === ch.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {openingId === ch.id ? '⏳' : '🚀 Ouvrir avec stats'}
                </button>
                <button
                  onClick={() => refreshChannel(ch.id)}
                  disabled={loading}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 7,
                    border: `1px solid ${project.color}`,
                    background: 'transparent',
                    color: project.color,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                  title="Rafraîchir les stats"
                >
                  🔄
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Composant principal ------------------------------------------------
export default function PageEngagement({ project }) {
  const [tab, setTab] = useState('myposts')
  const [data, setData] = useState(loadEngagement(project.id))

  useEffect(() => {
    setData(loadEngagement(project.id))
  }, [project.id])

  const update = (newData) => {
    setData(newData)
    saveEngagement(project.id, newData)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <button
          onClick={() => setTab('myposts')}
          style={{
            padding: '8px 18px',
            borderRadius: 20,
            border: `1px solid ${tab === 'myposts' ? project.color : 'rgba(255,255,255,0.1)'}`,
            background: tab === 'myposts' ? `${project.color}20` : 'transparent',
            color: tab === 'myposts' ? project.color : 'rgba(237,232,219,0.5)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          📊 Mes posts
        </button>
        <button
          onClick={() => setTab('youtube')}
          style={{
            padding: '8px 18px',
            borderRadius: 20,
            border: `1px solid ${tab === 'youtube' ? project.color : 'rgba(255,255,255,0.1)'}`,
            background: tab === 'youtube' ? `${project.color}20` : 'transparent',
            color: tab === 'youtube' ? project.color : 'rgba(237,232,219,0.5)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          👁 Veille YouTube
        </button>
      </div>

      {tab === 'myposts' && <TabMyPosts project={project} data={data} onUpdate={update} />}
      {tab === 'youtube' && <TabYouTubeWatch project={project} data={data} onUpdate={update} />}
    </div>
  )
}

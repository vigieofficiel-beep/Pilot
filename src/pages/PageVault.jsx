import { useState, useEffect } from 'react'

const CATEGORIES = [
  { id: 'reseaux',    label: 'Réseaux sociaux', emoji: '📱' },
  { id: 'dev',        label: 'Dev & Hosting',   emoji: '💻' },
  { id: 'ia',         label: 'IA & APIs',        emoji: '🤖' },
  { id: 'finance',    label: 'Finance & Paiement',emoji: '💳' },
  { id: 'email',      label: 'Email & Marketing', emoji: '📧' },
  { id: 'design',     label: 'Design & Médias',   emoji: '🎨' },
  { id: 'autre',      label: 'Autre',             emoji: '📦' },
]

const EMPTY_COMPTE = {
  id: null, nom: '', url: '', login: '', password: '', api_key: '',
  cout_mensuel: '', categorie: 'dev', notes: '', projet: 'tous', actif: true
}

function masquer(str) {
  if (!str) return '—'
  return str.slice(0, 4) + '•'.repeat(Math.min(str.length - 4, 12))
}

export default function PageVault({ project, projects }) {
  const STORAGE_KEY = 'pilotage_vault'

  const [comptes, setComptes] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })
  const [showForm,    setShowForm]    = useState(false)
  const [editCompte,  setEditCompte]  = useState({ ...EMPTY_COMPTE })
  const [editId,      setEditId]      = useState(null)
  const [search,      setSearch]      = useState('')
  const [filterCat,   setFilterCat]   = useState('tous')
  const [showApiOnly, setShowApiOnly] = useState(false) // NOUVEAU : filtre clés API
  const [revealed,    setRevealed]    = useState({})
  const [copied,      setCopied]      = useState(null)
  const [msg,         setMsg]         = useState(null)

  const save = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setComptes(data)
    // NOUVEAU : déclenche un event pour que les autres modules
    // (ceux qui utilisent useApiKey) se mettent à jour
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(data),
    }))
  }

  const totalMensuel = comptes
    .filter(c => c.actif)
    .reduce((acc, c) => acc + (parseFloat(c.cout_mensuel) || 0), 0)

  // NOUVEAU : compte les clés API disponibles
  const totalApiKeys = comptes.filter(c => c.api_key && c.api_key.trim()).length

  const filtered = comptes.filter(c => {
    const matchSearch = !search ||
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.url?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'tous' || c.categorie === filterCat
    const matchProjet = c.projet === 'tous' || c.projet === project.id
    // NOUVEAU : filtre clés API
    const matchApi = !showApiOnly || (c.api_key && c.api_key.trim())
    return matchSearch && matchCat && matchProjet && matchApi
  })

  const openNew = () => {
    setEditCompte({ ...EMPTY_COMPTE, projet: project.id })
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (c) => {
    setEditCompte({ ...c })
    setEditId(c.id)
    setShowForm(true)
  }

  const sauvegarder = () => {
    if (!editCompte.nom.trim()) return
    let updated
    if (editId) {
      updated = comptes.map(c => c.id === editId ? { ...editCompte, id: editId } : c)
    } else {
      updated = [...comptes, { ...editCompte, id: Date.now() }]
    }
    save(updated)
    setShowForm(false)
    setMsg({ text: editId ? '✅ Compte mis à jour !' : '✅ Compte ajouté !', ok: true })
    setTimeout(() => setMsg(null), 2000)
  }

  const supprimer = (id) => {
    if (!confirm('Supprimer ce compte ?')) return
    save(comptes.filter(c => c.id !== id))
  }

  const toggleReveal = (id) => setRevealed(p => ({ ...p, [id]: !p[id] }))

  const copier = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const iS = { width:'100%', padding:'9px 12px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#EDE8DB', fontSize:12, outline:'none', fontFamily:"'Nunito Sans',sans-serif", boxSizing:'border-box' }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── FORMULAIRE AJOUT/EDIT ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if(e.target===e.currentTarget) setShowForm(false) }}>
          <div style={{ background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:560, padding:28, maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#EDE8DB', marginBottom:20 }}>
              {editId ? '✏️ Modifier le compte' : '➕ Nouveau compte'}
            </h3>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Nom *</label>
                <input value={editCompte.nom} onChange={e => setEditCompte(p=>({...p,nom:e.target.value}))} placeholder="Ex: fal.ai, OpenAI, Anthropic..." style={iS}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>URL</label>
                <input value={editCompte.url} onChange={e => setEditCompte(p=>({...p,url:e.target.value}))} placeholder="https://fal.ai" style={iS}/>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Login / Email</label>
                <input value={editCompte.login} onChange={e => setEditCompte(p=>({...p,login:e.target.value}))} placeholder="email@exemple.com" style={iS}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>🔒 Mot de passe</label>
                <input type="password" value={editCompte.password} onChange={e => setEditCompte(p=>({...p,password:e.target.value}))} placeholder="••••••••" style={iS}/>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>
                🔑 Clé API
                <span style={{ fontSize:10, color:'rgba(237,232,219,0.3)', marginLeft:8, fontWeight:'normal' }}>
                  (utilisée par les modules Pilot via le hook useApiKey)
                </span>
              </label>
              <input value={editCompte.api_key} onChange={e => setEditCompte(p=>({...p,api_key:e.target.value}))} placeholder="sk-..., key_..., rpa_..." style={iS}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Catégorie</label>
                <select value={editCompte.categorie} onChange={e => setEditCompte(p=>({...p,categorie:e.target.value}))} style={{ ...iS, cursor:'pointer' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Projet lié</label>
                <select value={editCompte.projet} onChange={e => setEditCompte(p=>({...p,projet:e.target.value}))} style={{ ...iS, cursor:'pointer' }}>
                  <option value="tous">🌐 Tous (transversal)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Coût/mois (€)</label>
                <input type="number" value={editCompte.cout_mensuel} onChange={e => setEditCompte(p=>({...p,cout_mensuel:e.target.value}))} placeholder="0" style={iS}/>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:4 }}>Notes</label>
              <textarea value={editCompte.notes} onChange={e => setEditCompte(p=>({...p,notes:e.target.value}))}
                placeholder="Infos utiles, plan, date renouvellement..."
                rows={2} style={{ ...iS, resize:'vertical' }}/>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={sauvegarder}
                style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:project.color, color:'#0D1B2A', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                💾 Sauvegarder
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ padding:'10px 20px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', fontSize:13, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div style={{ padding:'8px 16px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize:11, color:'rgba(237,232,219,0.4)' }}>Total mensuel</span>
            <div style={{ fontSize:20, fontWeight:800, color: totalMensuel > 150 ? '#C75B4E' : '#5BC78A' }}>
              {totalMensuel.toFixed(2)} €
            </div>
          </div>
          <div style={{ padding:'8px 16px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize:11, color:'rgba(237,232,219,0.4)' }}>Comptes</span>
            <div style={{ fontSize:20, fontWeight:800, color:'#EDE8DB' }}>{comptes.length}</div>
          </div>
          {/* NOUVEAU : badge clés API */}
          <div style={{ padding:'8px 16px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize:11, color:'rgba(237,232,219,0.4)' }}>🔑 Clés API</span>
            <div style={{ fontSize:20, fontWeight:800, color:'#5BC78A' }}>{totalApiKeys}</div>
          </div>
        </div>
        <button onClick={openNew}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', background:project.color, color:'#0D1B2A', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
          ➕ Ajouter un compte
        </button>
      </div>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(91,199,138,0.1)', border:'1px solid rgba(91,199,138,0.2)', fontSize:13, color:'#5BC78A' }}>
          {msg.text}
        </div>
      )}

      {/* ── FILTRES ── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', flexShrink:0, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
          style={{ ...iS, width:200, padding:'7px 12px' }}/>

        {/* NOUVEAU : toggle filtre clés API */}
        <button onClick={() => setShowApiOnly(!showApiOnly)}
          style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${showApiOnly?'#5BC78A':'rgba(255,255,255,0.1)'}`, background:showApiOnly?'rgba(91,199,138,0.15)':'transparent', color:showApiOnly?'#5BC78A':'rgba(237,232,219,0.5)', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          🔑 Avec clé API ({totalApiKeys})
        </button>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)' }} />

        <button onClick={() => setFilterCat('tous')}
          style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${filterCat==='tous'?project.color:'rgba(255,255,255,0.1)'}`, background:filterCat==='tous'?`${project.color}20`:'transparent', color:filterCat==='tous'?project.color:'rgba(237,232,219,0.4)', fontSize:11, fontWeight:700, cursor:'pointer' }}>
          Tous ({comptes.length})
        </button>
        {CATEGORIES.map(c => {
          const count = comptes.filter(x => x.categorie === c.id).length
          if (count === 0) return null
          return (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${filterCat===c.id?project.color:'rgba(255,255,255,0.1)'}`, background:filterCat===c.id?`${project.color}20`:'transparent', color:filterCat===c.id?project.color:'rgba(237,232,219,0.4)', fontSize:11, fontWeight:filterCat===c.id?700:400, cursor:'pointer' }}>
              {c.emoji} {c.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── LISTE ── */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'rgba(237,232,219,0.3)', fontSize:13 }}>
              {comptes.length === 0
                ? <>Aucun compte enregistré.<br/>Commence par ajouter fal.ai, OpenAI, RunPod... 🔐</>
                : showApiOnly
                  ? 'Aucun compte avec clé API pour cette sélection.'
                  : 'Aucun compte pour cette sélection.'}
            </div>
          : filtered.map(c => {
              const cat = CATEGORIES.find(x => x.id === c.categorie)
              const proj = projects.find(p => p.id === c.projet)
              const isRevealed = revealed[c.id]
              const hasApiKey = c.api_key && c.api_key.trim()
              return (
                <div key={c.id} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${hasApiKey ? 'rgba(91,199,138,0.15)' : 'rgba(255,255,255,0.07)'}`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:14 }}>

                  {/* Icône catégorie */}
                  <div style={{ width:36, height:36, borderRadius:10, background:`${project.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {cat?.emoji || '📦'}
                  </div>

                  {/* Infos principales */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'#EDE8DB' }}>{c.nom}</span>
                      {/* NOUVEAU : badge clé API verte si présente */}
                      {hasApiKey && (
                        <span style={{ fontSize:10, color:'#5BC78A', background:'rgba(91,199,138,0.15)', padding:'1px 8px', borderRadius:10, fontWeight:700 }}>
                          🔑 API
                        </span>
                      )}
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer"
                          style={{ fontSize:11, color:project.color, textDecoration:'none', background:`${project.color}15`, padding:'1px 8px', borderRadius:10 }}>
                          🔗 Ouvrir
                        </a>
                      )}
                      {c.projet === 'tous' ? (
                        <span style={{ fontSize:10, color:'rgba(237,232,219,0.5)', background:'rgba(255,255,255,0.05)', padding:'1px 8px', borderRadius:10 }}>
                          🌐 Transversal
                        </span>
                      ) : proj && (
                        <span style={{ fontSize:10, color:proj.color, background:`${proj.color}15`, padding:'1px 8px', borderRadius:10 }}>
                          {proj.emoji} {proj.label}
                        </span>
                      )}
                      {c.cout_mensuel && parseFloat(c.cout_mensuel) > 0 && (
                        <span style={{ fontSize:10, color:'#D4A853', background:'rgba(212,168,83,0.1)', padding:'1px 8px', borderRadius:10 }}>
                          {c.cout_mensuel}€/mois
                        </span>
                      )}
                    </div>

                    <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                      {c.login && (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.3)' }}>Login:</span>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.6)', fontFamily:'monospace' }}>{c.login}</span>
                          <button onClick={() => copier(c.login, `login_${c.id}`)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color: copied===`login_${c.id}` ? '#5BC78A' : 'rgba(237,232,219,0.3)', padding:0 }}>
                            {copied===`login_${c.id}` ? '✅' : '📋'}
                          </button>
                        </div>
                      )}
                      {c.password && (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.3)' }}>MDP:</span>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.6)', fontFamily:'monospace' }}>
                            {isRevealed ? c.password : masquer(c.password)}
                          </span>
                          <button onClick={() => toggleReveal(c.id)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'rgba(237,232,219,0.3)', padding:0 }}>
                            {isRevealed ? '🙈' : '👁️'}
                          </button>
                          <button onClick={() => copier(c.password, `pwd_${c.id}`)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color: copied===`pwd_${c.id}` ? '#5BC78A' : 'rgba(237,232,219,0.3)', padding:0 }}>
                            {copied===`pwd_${c.id}` ? '✅' : '📋'}
                          </button>
                        </div>
                      )}
                      {hasApiKey && (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.3)' }}>API:</span>
                          <span style={{ fontSize:11, color:'rgba(237,232,219,0.6)', fontFamily:'monospace' }}>
                            {isRevealed ? c.api_key : masquer(c.api_key)}
                          </span>
                          <button onClick={() => copier(c.api_key, `api_${c.id}`)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color: copied===`api_${c.id}` ? '#5BC78A' : 'rgba(237,232,219,0.3)', padding:0 }}>
                            {copied===`api_${c.id}` ? '✅' : '📋'}
                          </button>
                        </div>
                      )}
                    </div>

                    {c.notes && (
                      <p style={{ fontSize:11, color:'rgba(237,232,219,0.3)', marginTop:4, fontStyle:'italic' }}>{c.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button onClick={() => openEdit(c)}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(237,232,219,0.5)', fontSize:11, cursor:'pointer' }}>
                      ✏️
                    </button>
                    <button onClick={() => supprimer(c.id)}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(199,91,78,0.2)', background:'transparent', color:'#C75B4E', fontSize:11, cursor:'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}

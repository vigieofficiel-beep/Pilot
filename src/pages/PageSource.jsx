import { useState } from 'react'

// ── TENDANCES POLITIQUES JOURNAUX ────────────────────────────────
// Mapping journal -> couleur + label politique. Servira au filtre Tendance
// et au surlignage des bordures gauche des résultats.
const TENDANCES = {
  "L'Humanité":         { couleur:'#C75B4E', label:'Communiste / ouvrier' },
  'Le Populaire':       { couleur:'#EA4B71', label:'Socialiste' },
  'Le Temps':           { couleur:'#9CA3AF', label:'Centre / libéral' },
  'Le Figaro':          { couleur:'#5BA3C7', label:'Conservateur' },
  "L'Action Française": { couleur:'#8B5A2B', label:'Extrême droite' },
  'Le Petit Journal':   { couleur:'#D4A853', label:'Populaire' },
  'Je Suis Partout':    { couleur:'#6B3410', label:'Extrême droite' },
}

// ── SOURCES DOCUMENTAIRES ────────────────────────────────────────
// Sources hardcodées (préconfigurées par Pilot) + futures sources custom
// ajoutées manuellement par l'utilisateur (URL + clé API + nom).
const SOURCES_HARDCODEES = [
  { id:'gallica', label:'Gallica (BnF)', type:'sru', actif:true, url:'https://gallica.bnf.fr/SRU' },
]

// ── EXEMPLES DE RÉSULTATS (squelette non fonctionnel) ────────────
const RESULTATS_EXEMPLES = [
  {
    id:1,
    titre:'Le scandale Stavisky éclabousse la République',
    journal:"L'Humanité",
    date:'12 janv 1934',
    snippet:"Les révélations sur l'escroquerie de Sacha Stavisky ébranlent les milieux politiques et financiers parisiens. La presse ouvrière dénonce un système de corruption généralisé...",
    url:'https://gallica.bnf.fr/...',
  },
  {
    id:2,
    titre:'Affaire Stavisky : nouvelles révélations',
    journal:'Le Figaro',
    date:'13 janv 1934',
    snippet:"L'enquête révèle des ramifications jusqu'au plus haut niveau de l'État. Les magistrats poursuivent leurs investigations avec une discrétion remarquée...",
    url:'https://gallica.bnf.fr/...',
  },
  {
    id:3,
    titre:'Honte sur la République parlementaire',
    journal:"L'Action Française",
    date:'14 janv 1934',
    snippet:"Encore un scandale qui démontre la corruption généralisée du régime. Maurras appelle à la mobilisation des ligues face à la décomposition du système...",
    url:'https://gallica.bnf.fr/...',
  },
]

const FAVORIS_EXEMPLES = [
  { id:101, titre:'La marche des fascistes', journal:"L'Humanité", date:'7 fév 1934' },
  { id:102, titre:'Daladier démissionne',    journal:'Le Temps',   date:'8 fév 1934' },
]

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────
export default function PageSource({ project }) {
  const [query,          setQuery]          = useState('')
  const [dateDebut,      setDateDebut]      = useState('1900')
  const [dateFin,        setDateFin]        = useState('1945')
  const [journal,        setJournal]        = useState('Tous')
  const [source,         setSource]         = useState('gallica')
  const [tendances,      setTendances]      = useState([])
  const [filtresOuverts, setFiltresOuverts] = useState(true)
  const [sourcesModal,   setSourcesModal]   = useState(false)

  const tendancePour = (j) => TENDANCES[j] || { couleur:'#6B7280', label:'Inconnu' }

  return (
    <div style={{display:'flex',gap:20,height:'100%'}}>

      {/* ───── MODALE GESTION SOURCES ───── */}
      {sourcesModal && (
        <div
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{if(e.target===e.currentTarget)setSourcesModal(false)}}
        >
          <div style={{background:'#1a1d24',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:'100%',maxWidth:560,padding:28,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:'#EDE8DB',margin:0}}>📰 Sources documentaires</h3>
              <button onClick={()=>setSourcesModal(false)} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',color:'rgba(237,232,219,0.6)',fontSize:12}}>✕</button>
            </div>

            <p style={{fontSize:12,color:'rgba(237,232,219,0.5)',marginBottom:14,lineHeight:1.6}}>
              Sources préconfigurées par Pilot + ajout manuel de tes propres sources (URL + clé API + nom).
            </p>

            <p style={{fontSize:10,fontWeight:700,color:'rgba(237,232,219,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 8px'}}>Préconfigurées</p>

            {SOURCES_HARDCODEES.map(s => (
              <div key={s.id} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:'#EDE8DB',margin:'0 0 2px'}}>
                    {s.label}
                    <span style={{fontSize:10,color:project.color,marginLeft:6,fontWeight:400}}>● Préconfiguré</span>
                  </p>
                  <p style={{fontSize:11,color:'rgba(237,232,219,0.4)',margin:0}}>{s.url}</p>
                </div>
                <span style={{fontSize:10,color:'#5BC78A',fontWeight:700}}>{s.actif?'Actif':'Inactif'}</span>
              </div>
            ))}

            <p style={{fontSize:10,fontWeight:700,color:'rgba(237,232,219,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',margin:'18px 0 8px'}}>Mes sources custom</p>

            <div style={{background:'rgba(255,255,255,0.02)',border:'1px dashed rgba(255,255,255,0.1)',borderRadius:10,padding:'20px 14px',textAlign:'center',marginBottom:10}}>
              <p style={{fontSize:12,color:'rgba(237,232,219,0.4)',margin:'0 0 4px'}}>Aucune source custom pour l'instant.</p>
              <p style={{fontSize:10,color:'rgba(237,232,219,0.3)',margin:0,lineHeight:1.5}}>
                Tu pourras ajouter d'autres archives accessibles via API (RetroNews, Europeana, archives municipales, etc.).
              </p>
            </div>

            <button disabled style={{width:'100%',padding:'11px',borderRadius:10,border:`1px dashed ${project.color}40`,background:'transparent',color:`${project.color}80`,fontSize:13,fontWeight:700,cursor:'not-allowed'}}>
              + Ajouter une source custom (bientôt)
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ COLONNE GAUCHE ═══════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:14,overflow:'hidden'}}>

        {/* HEADER */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:700,color:'#EDE8DB',margin:'0 0 2px'}}>📰 Source</h3>
            <p style={{fontSize:11,color:'rgba(237,232,219,0.4)',margin:0}}>Archives presse française · Gallica BnF + sources custom</p>
          </div>
          <button
            onClick={()=>setSourcesModal(true)}
            style={{padding:'7px 14px',borderRadius:10,border:`1px solid ${project.color}40`,background:`${project.color}15`,color:project.color,fontSize:12,fontWeight:700,cursor:'pointer'}}
          >
            ⚙️ Gérer les sources
          </button>
        </div>

        {/* BARRE DE RECHERCHE + FILTRES */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:20,flexShrink:0}}>

          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Rechercher un sujet, un nom, un événement…"
              style={{flex:1,padding:'12px 16px',borderRadius:10,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:14,outline:'none',fontFamily:"'Nunito Sans',sans-serif"}}
            />
            <button
              disabled
              style={{padding:'12px 22px',borderRadius:10,border:'none',background:`${project.color}40`,color:'#0D1B2A',fontSize:13,fontWeight:800,cursor:'not-allowed'}}
              title="Pipeline Gallica à brancher (étape suivante)"
            >
              🔍 Chercher
            </button>
          </div>

          <button
            onClick={()=>setFiltresOuverts(!filtresOuverts)}
            style={{background:'transparent',border:'none',color:'rgba(237,232,219,0.5)',fontSize:11,fontWeight:700,cursor:'pointer',padding:0,marginBottom:filtresOuverts?14:0}}
          >
            {filtresOuverts?'▼':'▶'} Filtres avancés
          </button>

          {filtresOuverts && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:10,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Période</label>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input
                    type="number"
                    value={dateDebut}
                    onChange={e=>setDateDebut(e.target.value)}
                    min="1800" max="2025"
                    style={{flex:1,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:12,outline:'none'}}
                  />
                  <span style={{fontSize:11,color:'rgba(237,232,219,0.3)'}}>→</span>
                  <input
                    type="number"
                    value={dateFin}
                    onChange={e=>setDateFin(e.target.value)}
                    min="1800" max="2025"
                    style={{flex:1,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:12,outline:'none'}}
                  />
                </div>
              </div>

              <div>
                <label style={{fontSize:10,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Journal</label>
                <select
                  value={journal}
                  onChange={e=>setJournal(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:12,outline:'none'}}
                >
                  <option value="Tous">Tous les journaux</option>
                  {Object.keys(TENDANCES).map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:10,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Source</label>
                <select
                  value={source}
                  onChange={e=>setSource(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:12,outline:'none'}}
                >
                  {SOURCES_HARDCODEES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:10,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Tendance politique</label>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {['Gauche','Centre','Droite'].map(t => (
                    <button
                      key={t}
                      onClick={()=>setTendances(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                      style={{padding:'5px 10px',borderRadius:14,border:`1px solid ${tendances.includes(t)?project.color:'rgba(255,255,255,0.1)'}`,background:tendances.includes(t)?`${project.color}20`:'transparent',color:tendances.includes(t)?project.color:'rgba(237,232,219,0.5)',fontSize:10,fontWeight:700,cursor:'pointer'}}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LABEL RESULTATS */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,padding:'0 4px'}}>
          <p style={{fontSize:11,fontWeight:700,color:'rgba(237,232,219,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',margin:0}}>
            Résultats ({RESULTATS_EXEMPLES.length} exemples)
          </p>
          <p style={{fontSize:10,color:'rgba(212,168,83,0.7)',margin:0}}>⚠️ Données fictives — pipeline Gallica à brancher</p>
        </div>

        {/* LISTE RÉSULTATS */}
        <div style={{display:'flex',flexDirection:'column',gap:8,overflowY:'auto',paddingRight:4}}>
          {RESULTATS_EXEMPLES.map(r => {
            const t = tendancePour(r.journal)
            return (
              <div
                key={r.id}
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px',borderLeft:`4px solid ${t.couleur}`}}
              >
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6,gap:10}}>
                  <h4 style={{fontSize:14,fontWeight:700,color:'#EDE8DB',margin:0,lineHeight:1.4,flex:1}}>{r.titre}</h4>
                  <button title="Ajouter aux favoris" style={{background:'transparent',border:'none',color:'rgba(237,232,219,0.3)',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>☆</button>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontSize:11,flexWrap:'wrap'}}>
                  <span style={{color:t.couleur,fontWeight:700}}>● {r.journal}</span>
                  <span style={{color:'rgba(237,232,219,0.3)'}}>·</span>
                  <span style={{color:'rgba(237,232,219,0.5)'}}>{r.date}</span>
                  <span style={{color:'rgba(237,232,219,0.3)'}}>·</span>
                  <span style={{fontSize:10,color:'rgba(237,232,219,0.4)',background:'rgba(255,255,255,0.04)',padding:'1px 6px',borderRadius:6}}>{t.label}</span>
                </div>

                <p style={{fontSize:12,color:'rgba(237,232,219,0.6)',lineHeight:1.6,margin:'0 0 10px'}}>{r.snippet}</p>

                <div style={{display:'flex',gap:6}}>
                  <button style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${project.color}40`,background:`${project.color}10`,color:project.color,fontSize:10,fontWeight:700,cursor:'pointer'}}>📖 Lire sur Gallica</button>
                  <button style={{padding:'5px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(237,232,219,0.5)',fontSize:10,cursor:'pointer'}}>📋 Copier citation</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════ COLONNE DROITE : FAVORIS ═══════════════ */}
      <div style={{width:280,display:'flex',flexDirection:'column',gap:10,overflowY:'auto',flexShrink:0}}>

        <h3 style={{fontSize:11,fontWeight:700,color:'rgba(237,232,219,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',margin:0}}>
          ⭐ Favoris ({FAVORIS_EXEMPLES.length})
        </h3>

        {FAVORIS_EXEMPLES.map(f => {
          const t = tendancePour(f.journal)
          return (
            <div
              key={f.id}
              style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'10px 12px',borderLeft:`3px solid ${t.couleur}`}}
            >
              <p style={{fontSize:12,fontWeight:700,color:'#EDE8DB',margin:'0 0 4px',lineHeight:1.4}}>{f.titre}</p>
              <p style={{fontSize:10,color:'rgba(237,232,219,0.4)',margin:0}}>● {f.journal} · {f.date}</p>
            </div>
          )
        })}

        <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'8px 0'}}/>

        <p style={{fontSize:10,fontWeight:700,color:'rgba(237,232,219,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 4px'}}>Actions</p>

        <button disabled style={{padding:'10px 12px',borderRadius:10,border:'none',background:`${project.color}30`,color:`${project.color}`,fontSize:12,fontWeight:700,cursor:'not-allowed',textAlign:'left'}}>
          ✨ Générer rapport IA
        </button>
        <button disabled style={{padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.03)',color:'rgba(237,232,219,0.4)',fontSize:12,fontWeight:700,cursor:'not-allowed',textAlign:'left'}}>
          📄 Exporter Markdown
        </button>
        <button disabled style={{padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.03)',color:'rgba(237,232,219,0.4)',fontSize:12,fontWeight:700,cursor:'not-allowed',textAlign:'left'}}>
          📝 Ajouter au script
        </button>

        <div style={{marginTop:'auto',padding:'10px 12px',background:'rgba(212,168,83,0.08)',border:'1px solid rgba(212,168,83,0.2)',borderRadius:10}}>
          <p style={{fontSize:10,fontWeight:700,color:'#D4A853',margin:'0 0 4px'}}>💡 Squelette UI</p>
          <p style={{fontSize:10,color:'rgba(237,232,219,0.5)',margin:0,lineHeight:1.5}}>
            Tous les boutons sont visuels. Prochaine session : branchement Gallica SRU + favoris persistants.
          </p>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'

const PLATFORMS = ['linkedin', 'facebook', 'discord', 'youtube']

const DEFAULT_CONFIG = {
  nom: '', activite: '', audience: '', ton: 'professionnel', ton_custom: '',
  mots_inclure: '', mots_exclure: '', bio_publique: '', bio_privee: '',
  prompt_linkedin: '', prompt_facebook: '', prompt_discord: '', prompt_youtube: '',
  contexte_global: '',
}

const TON_OPTIONS = [
  { val: 'professionnel', label: '👔 Professionnel' },
  { val: 'decontracte',   label: '😊 Décontracté'   },
  { val: 'expert',        label: '🎓 Expert'          },
  { val: 'visionnaire',   label: '🚀 Visionnaire'     },
  { val: 'direct',        label: '⚡ Direct & Frank'  },
  { val: 'pedagogique',   label: '📚 Pédagogique'    },
]

const iS = {
  width:'100%', padding:'10px 14px', borderRadius:8,
  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
  color:'#EDE8DB', fontSize:13, outline:'none',
  fontFamily:"'Nunito Sans',sans-serif", boxSizing:'border-box', lineHeight:1.6
}

export default function PagePersonnalisation({ project }) {
  const storageKey = `pilotage_config_${project.id}`
  const [config, setConfig] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG }
    catch { return DEFAULT_CONFIG }
  })
  const [saved, setSaved]               = useState(false)
  const [activeSection, setActiveSection] = useState('fiche')

  useEffect(() => {
    try { const s = localStorage.getItem(`pilotage_config_${project.id}`); setConfig(s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG) }
    catch { setConfig(DEFAULT_CONFIG) }
  }, [project.id])

  const update = (key, val) => setConfig(p => ({ ...p, [key]: val }))

  const sauvegarder = () => {
    localStorage.setItem(storageKey, JSON.stringify(config))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const SECTIONS = [
    { id:'fiche',   label:'👤 Fiche projet' },
    { id:'prompts', label:'🤖 Prompts IA'   },
    { id:'avance',  label:'⚙️ Avancé'       },
  ]

  return (
    <div style={{ display:'flex', gap:24, height:'100%' }}>
      {/* Sous-nav */}
      <div style={{ width:180, flexShrink:0 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{ padding:'9px 14px', borderRadius:10, border:'none', background:activeSection===s.id?`${project.color}20`:'transparent', color:activeSection===s.id?project.color:'rgba(237,232,219,0.5)', fontSize:12, fontWeight:activeSection===s.id?700:400, cursor:'pointer', textAlign:'left', borderLeft:activeSection===s.id?`2px solid ${project.color}`:'2px solid transparent' }}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={sauvegarder}
          style={{ width:'100%', marginTop:16, padding:'10px', borderRadius:10, border:'none', background:saved?'#5BC78A':project.color, color:'#0D1B2A', fontSize:12, fontWeight:800, cursor:'pointer', transition:'all 0.2s' }}>
          {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
        <div style={{ marginTop:16, padding:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10 }}>
          <p style={{ fontSize:10, fontWeight:700, color:'rgba(237,232,219,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Prompt actif</p>
          <p style={{ fontSize:10, color:'rgba(237,232,219,0.4)', lineHeight:1.5 }}>
            {config.contexte_global ? config.contexte_global.slice(0,80)+'...' : 'Aucun contexte défini'}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ── FICHE PROJET ── */}
        {activeSection === 'fiche' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:16 }}>👤 Mon identité</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:6 }}>Nom / Pseudo / Marque</label>
                  <input value={config.nom} onChange={e => update('nom', e.target.value)}
                    placeholder="Ex: Clara Martin, Studio Nexum..." style={iS}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:6 }}>Mon entreprise ou ma chaîne</label>
                  <input value={config.activite} onChange={e => update('activite', e.target.value)}
                    placeholder="Ex: Agence Lumio, Chaîne TechVision..." style={iS}/>
                </div>
              </div>
            </div>

            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:12 }}>🎯 Mon audience</h3>
              <textarea value={config.audience} onChange={e => update('audience', e.target.value)}
                placeholder="Ex: Entrepreneurs et freelances qui veulent développer leur visibilité en ligne"
                rows={3} style={{ ...iS, resize:'vertical' }}/>
            </div>

            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:14 }}>🎙️ Ton de communication</h3>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                {TON_OPTIONS.map(t => (
                  <button key={t.val} onClick={() => update('ton', t.val)}
                    style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${config.ton===t.val?project.color:'rgba(255,255,255,0.1)'}`, background:config.ton===t.val?`${project.color}20`:'transparent', color:config.ton===t.val?project.color:'rgba(237,232,219,0.5)', fontSize:12, fontWeight:config.ton===t.val?700:400, cursor:'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:6 }}>
                  ✏️ Ton sur-mesure (optionnel — remplace le ton choisi ci-dessus)
                </label>
                <textarea value={config.ton_custom} onChange={e => update('ton_custom', e.target.value)}
                  placeholder="Ex: Sec et factuel, comme un comptable allemand. Pas d'emojis, phrases courtes."
                  rows={2} style={{ ...iS, resize:'vertical' }}/>
                {config.ton_custom && (
                  <p style={{ fontSize:10, color:'#5BC78A', marginTop:6 }}>
                    ✨ Ton sur-mesure actif — il prendra le pas sur le bouton sélectionné.
                  </p>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:6 }}>✅ Mots clés à utiliser</label>
                  <input value={config.mots_inclure} onChange={e => update('mots_inclure', e.target.value)}
                    placeholder="Ex: croissance, impact, communauté..." style={iS}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)', display:'block', marginBottom:6 }}>❌ Mots à éviter</label>
                  <input value={config.mots_exclure} onChange={e => update('mots_exclure', e.target.value)}
                    placeholder="Ex: révolutionnaire, incroyable, game-changer..." style={iS}/>
                </div>
              </div>
            </div>

            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:14 }}>📋 Description du projet</h3>
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)' }}>🌐 Bio publique</label>
                  <span style={{ fontSize:10, background:'rgba(91,199,138,0.1)', color:'#5BC78A', padding:'1px 8px', borderRadius:10 }}>Visible dans les posts</span>
                </div>
                <textarea value={config.bio_publique} onChange={e => update('bio_publique', e.target.value)}
                  placeholder="Ex: J'accompagne les créateurs à développer leur présence en ligne avec des outils IA..."
                  rows={3} style={{ ...iS, resize:'vertical' }}/>
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <label style={{ fontSize:11, color:'rgba(237,232,219,0.4)' }}>🔒 Notes privées</label>
                  <span style={{ fontSize:10, background:'rgba(212,168,83,0.1)', color:'#D4A853', padding:'1px 8px', borderRadius:10 }}>Contexte IA uniquement</span>
                </div>
                <textarea value={config.bio_privee} onChange={e => update('bio_privee', e.target.value)}
                  placeholder="Ex: Objectif 5000€ MRR d'ici septembre, focus sur les créateurs solo et TPE..."
                  rows={3} style={{ ...iS, resize:'vertical' }}/>
              </div>
            </div>
          </div>
        )}

        {/* ── PROMPTS IA ── */}
        {activeSection === 'prompts' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:8 }}>🌐 Contexte global</h3>
              <p style={{ fontSize:12, color:'rgba(237,232,219,0.4)', marginBottom:12 }}>Injecté dans TOUS tes posts, toutes plateformes.</p>
              <textarea value={config.contexte_global} onChange={e => update('contexte_global', e.target.value)}
                placeholder={`Ex: Je dirige ${project.label}, une activité dédiée à [décrire]. Mon approche est [ton style]. Je m'adresse à [audience] qui cherche à [objectif].`}
                rows={5} style={{ ...iS, resize:'vertical' }}/>
            </div>
            {PLATFORMS.map(p => (
              <div key={p} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:8 }}>
                  {p==='linkedin'?'💼':p==='facebook'?'👥':p==='discord'?'🎮':'🎬'} {p.charAt(0).toUpperCase()+p.slice(1)}
                </h3>
                <textarea value={config[`prompt_${p}`]} onChange={e => update(`prompt_${p}`, e.target.value)}
                  placeholder={
                    p==='linkedin' ? 'Ex: Paragraphes courts, 1 idée par ligne, termine par une question ouverte à la communauté...'
                    : p==='facebook' ? 'Ex: Storytelling humain, ton chaleureux, 2-3 emojis max, invite au partage...'
                    : p==='discord' ? 'Ex: Direct et technique, **points clés en gras**, invite à la discussion dans le fil...'
                    : 'Ex: Accroche forte en 5 secondes, structure problème → solution → résultat, CTA abonnement...'
                  }
                  rows={3} style={{ ...iS, resize:'vertical' }}/>
              </div>
            ))}
          </div>
        )}

        {/* ── AVANCÉ ── */}
        {activeSection === 'avance' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#EDE8DB', marginBottom:8 }}>📊 Aperçu du prompt LinkedIn</h3>
              <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:10, padding:14, fontSize:11, color:'rgba(237,232,219,0.6)', lineHeight:1.7, fontFamily:'monospace', whiteSpace:'pre-wrap' }}>
{`Projet : ${project.label}
Identité : ${config.nom||'(non renseigné)'}
Entreprise / Chaîne : ${config.activite||'(non renseigné)'}
Audience : ${config.audience||'(non renseigné)'}
Ton : ${config.ton_custom || config.ton}
Mots clés : ${config.mots_inclure||'aucun'}
Mots exclus : ${config.mots_exclure||'aucun'}

Contexte global :
${config.contexte_global||'(non défini)'}

Règles LinkedIn :
${config.prompt_linkedin||'(règles par défaut)'}`}
              </div>
            </div>
            <div style={{ background:'rgba(199,91,78,0.05)', border:'1px solid rgba(199,91,78,0.15)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'#C75B4E', marginBottom:8 }}>🔄 Réinitialiser</h3>
              <button onClick={() => { if(confirm('Réinitialiser la configuration de '+project.label+' ?')) { setConfig(DEFAULT_CONFIG); localStorage.removeItem(storageKey) }}}
                style={{ padding:'8px 20px', borderRadius:8, border:'1px solid rgba(199,91,78,0.3)', background:'rgba(199,91,78,0.1)', color:'#C75B4E', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Réinitialiser {project.label}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

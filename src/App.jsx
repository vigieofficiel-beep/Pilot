import { useState, useEffect } from 'react'
import PagePersonnalisation from './pages/PagePersonnalisation'
import PageVault from './pages/PageVault'
import PageMonitoring from './pages/PageMonitoring'
import PageFinances from './pages/PageFinances'
import PageSAV from './pages/PageSAV'
import PageProspects from './pages/PageProspects'
import PageCalendrier from './pages/PageCalendrier'
import PageTemplates, { saveTemplate } from './pages/PageTemplates'
import LicenceModal from './pages/LicenceModal'
import PageEngagement from './pages/PageEngagement'
import PageAssistant from './pages/PageAssistant'
import PageStudIA from './pages/PageStudIA'

const PROJECTS_DEFAULT = [
  { id:'vigie',        label:'Vigie',        color:'#5BA3C7', emoji:'🛡️', reseaux:['linkedin','facebook','discord','youtube'] },
  { id:'dimensyon',    label:'DimenSyon',    color:'#00BCD4', emoji:'🎬', reseaux:['youtube','discord','linkedin'] },
  { id:'evolusyon',    label:'EvoluSyon',    color:'#5BC78A', emoji:'🎮', reseaux:['discord','twitter','linkedin'] },
  { id:'alimentasyon', label:'AlimentaSyon', color:'#D4A853', emoji:'🍽️', reseaux:['facebook','instagram','linkedin'] },
]

const ALL_PLATFORMS = [
  { id:'linkedin',  label:'LinkedIn',    icon:'💼' },
  { id:'facebook',  label:'Facebook',    icon:'👥' },
  { id:'discord',   label:'Discord',     icon:'🎮' },
  { id:'youtube',   label:'YouTube',     icon:'🎬' },
  { id:'twitter',   label:'X / Twitter', icon:'🐦' },
  { id:'instagram', label:'Instagram',   icon:'📸' },
  { id:'tiktok',    label:'TikTok',      icon:'🎵' },
  { id:'threads',   label:'Threads',     icon:'🧵' },
]

const PALETTE = [
  '#5BA3C7','#00BCD4','#5BC78A','#D4A853','#C75B4E',
  '#A85BC7','#EA4B71','#10a37f','#635BFF','#FF6B35',
  '#FF8C42','#FFE66D','#4ECDC4','#45B7D1','#96CEB4',
]

const BG_THEMES = [
  { id:'midnight',  label:'Midnight',   bg:'#0D1B2A' },
  { id:'obsidian',  label:'Obsidian',   bg:'#0f0f13' },
  { id:'slate',     label:'Slate',      bg:'#141a24' },
  { id:'forest',    label:'Forest',     bg:'#0d1f1a' },
  { id:'charcoal',  label:'Charcoal',   bg:'#1a1a1a' },
  { id:'navy',      label:'Navy',       bg:'#0a1628' },
  { id:'plum',      label:'Plum',       bg:'#1a0d24' },
  { id:'carbon',    label:'Carbon',     bg:'#111318' },
]

const TABS = [
  { id:'contenu',          label:'Contenu',          emoji:'✍️' },
  { id:'studia',           label:"Stud'IA",          emoji:'🎬' },
  { id:'templates',        label:'Templates',         emoji:'📚' },
  { id:'calendrier',       label:'Calendrier',        emoji:'📅' },
  { id:'monitoring',       label:'Alertes & Coûts',  emoji:'📊' },
  { id:'vault',            label:'Coffre-fort',       emoji:'🔐' },
  { id:'finances',         label:'Finances',          emoji:'💰' },
  { id:'sav',              label:'SAV',               emoji:'💬' },
  { id:'prospects',        label:'Prospects',         emoji:'🎯' },
  { id:'engagement',       label:'Engagement',        emoji:'💞' },
  { id:'assistant',        label:'Assistant',         emoji:'🗓️' },
  { id:'personnalisation', label:'Personnalisation',  emoji:'⚙️' },
]

const ACTIVE_TABS = ['contenu','studia','templates','personnalisation','vault','monitoring','finances','sav','prospects','engagement','calendrier','assistant']
const STORAGE_KEY_PROJECTS = 'pilotage_projects'
const STORAGE_KEY_THEME    = 'pilotage_theme'

function loadProjects() {
  try { const s = localStorage.getItem(STORAGE_KEY_PROJECTS); return s ? JSON.parse(s) : PROJECTS_DEFAULT }
  catch { return PROJECTS_DEFAULT }
}

function getConfig(projectId) {
  try { const s = localStorage.getItem(`pilotage_config_${projectId}`); return s ? JSON.parse(s) : {} }
  catch { return {} }
}

// ── HISTORIQUE INTELLIGENT ────────────────────────────────────────
// Récupère les N derniers posts du projet + plateforme
// Sources : pilotage_templates (sauvegardés) + pilotage_calendrier (publiés)
function loadHistorique(projectId, platform, limit = 5) {
  const posts = []

  // 1. Templates sauvegardés pour ce projet + plateforme
  try {
    const templates = JSON.parse(localStorage.getItem('pilotage_templates') || '[]')
    templates
      .filter(t => t.projectId === projectId && t.platform === platform)
      .slice(0, limit)
      .forEach(t => posts.push(t.contenu))
  } catch {}

  // 2. Posts publiés dans le calendrier pour ce projet + plateforme
  try {
    const cal = JSON.parse(localStorage.getItem('pilotage_calendrier') || '[]')
    cal
      .filter(e => e.projectId === projectId && e.platform === platform && e.statut === 'publie')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit)
      .forEach(e => posts.push(e.contenu))
  } catch {}

  // Déduplique et limite
  return [...new Set(posts)].slice(0, limit)
}

function buildPrompt(project, platform, idea) {
  const cfg = getConfig(project.id)
  const parts = [
    cfg.contexte_global && `Contexte : ${cfg.contexte_global}`,
    cfg.nom             && `Identité : ${cfg.nom}`,
    cfg.activite        && `Entreprise / Chaîne : ${cfg.activite}`,
    cfg.audience        && `Audience : ${cfg.audience}`,
    cfg.ton             && `Ton : ${cfg.ton}`,
    cfg.mots_inclure    && `Mots à utiliser : ${cfg.mots_inclure}`,
    cfg.mots_exclure    && `Mots à éviter : ${cfg.mots_exclure}`,
    cfg.bio_publique    && `Bio publique : ${cfg.bio_publique}`,
  ].filter(Boolean).join('\n')

  const defaultRules = {
    linkedin:`Ton professionnel, flèches →, paragraphes courts, termine par "— ${cfg.nom||'[Votre nom]'}"`,
    facebook:'Ton accessible, quelques emojis, storytelling humain',
    discord:'Ton communauté, **gras** pour les points clés, technique si pertinent',
    youtube:'Script court, accroche forte en 5 secondes, structure AIDA',
    twitter:'Tweet percutant, max 280 caractères, hashtags pertinents',
    instagram:'Caption visuelle, emojis, hashtags en fin de post',
    tiktok:'Script vidéo courte, accroche 3 secondes, tendance actuelle',
    threads:'Ton décontracté, réflexion du moment, conversationnel',
  }

  // Historique : posts précédents pour éviter répétitions et apprendre le style
  const historique = loadHistorique(project.id, platform)
  const historiqueSection = historique.length > 0
    ? `\nHISTORIQUE DE TES DERNIERS POSTS ${platform.toUpperCase()} (à analyser pour apprendre ton style ET éviter toute répétition de formulation, accroche, ou structure) :\n${historique.map((h, i) => `[Post ${i + 1}] ${h.slice(0, 300)}${h.length > 300 ? '...' : ''}`).join('\n---\n')}\nIMPORTANT : Ne réutilise JAMAIS la même accroche, structure ou formulation que ces posts précédents.`
    : ''

  return `Tu es un expert en création de contenu pour réseaux sociaux.
Projet : ${project.label} ${project.emoji}
${parts}
Plateforme : ${platform.toUpperCase()}
${cfg[`prompt_${platform}`] || defaultRules[platform] || 'Ton adapté à la plateforme'}${historiqueSection}
Idée : "${idea}"
Génère un post ${platform} percutant et authentique, dans le style appris ci-dessus.
Réponds UNIQUEMENT avec le post final, sans explication.`
}

async function publierPost(platform, contenu) {
  if (window.electronAPI?.publishPost) {
    await window.electronAPI.publishPost(platform, contenu)
    return
  }
  navigator.clipboard.writeText(contenu)
  const urls = {
    linkedin:'https://www.linkedin.com/feed/', facebook:'https://www.facebook.com/',
    discord:'https://discord.com/channels/@me', youtube:'https://studio.youtube.com/',
    twitter:'https://twitter.com/compose/tweet', instagram:'https://www.instagram.com/',
    tiktok:'https://www.tiktok.com/upload', threads:'https://www.threads.net/',
  }
  window.open(urls[platform] || urls.linkedin, '_blank')
}

function ThemeModal({ currentTheme, onSelect, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#1a1d24',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:'100%',maxWidth:420,padding:28}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#EDE8DB',marginBottom:20}}>🎨 Couleur de fond</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          {BG_THEMES.map(t => (
            <button key={t.id} onClick={() => { onSelect(t); onClose() }}
              style={{padding:'14px 16px',borderRadius:12,border:`2px solid ${currentTheme.id===t.id?'#EDE8DB':'rgba(255,255,255,0.1)'}`,background:t.bg,cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all 0.15s'}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:t.bg,border:'2px solid rgba(255,255,255,0.2)'}}/>
              <span style={{fontSize:12,fontWeight:currentTheme.id===t.id?700:400,color:'#EDE8DB'}}>{t.label}</span>
              {currentTheme.id===t.id && <span style={{marginLeft:'auto',fontSize:12}}>✓</span>}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(237,232,219,0.5)',fontSize:13,cursor:'pointer'}}>Fermer</button>
      </div>
    </div>
  )
}

function ProjetModal({ projet, onSave, onClose }) {
  const isNew = !projet.id
  const [form, setForm] = useState(projet.id ? {...projet} : {id:Date.now().toString(),label:'',emoji:'🚀',color:'#5BA3C7',reseaux:['linkedin']})
  const toggleReseau = (id) => setForm(p=>({...p,reseaux:p.reseaux.includes(id)?p.reseaux.filter(r=>r!==id):[...p.reseaux,id]}))
  const iS = {width:'100%',padding:'9px 12px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:13,outline:'none',fontFamily:"'Nunito Sans',sans-serif",boxSizing:'border-box'}
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#1a1d24',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:'100%',maxWidth:500,padding:28,maxHeight:'90vh',overflowY:'auto'}}>
        <h3 style={{fontSize:16,fontWeight:700,color:'#EDE8DB',marginBottom:20}}>{isNew?'➕ Nouveau projet':`✏️ Modifier ${projet.label}`}</h3>
        <div style={{display:'grid',gridTemplateColumns:'60px 1fr',gap:10,marginBottom:14}}>
          <div><label style={{fontSize:11,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4}}>Emoji</label><input value={form.emoji} onChange={e=>setForm(p=>({...p,emoji:e.target.value}))} style={{...iS,textAlign:'center',fontSize:22,padding:'6px'}}/></div>
          <div>
            <label style={{fontSize:11,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:4}}>Nom du projet *</label>
            <input value={form.label} onChange={e=>setForm(p=>({...p,label:e.target.value}))} placeholder="Ex: Mon entreprise ou ma chaîne" style={iS}/>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:8}}>Couleur</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>{PALETTE.map(c=><button key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{width:28,height:28,borderRadius:'50%',background:c,border:`3px solid ${form.color===c?'#EDE8DB':'transparent'}`,cursor:'pointer',outline:'none'}}/>)}</div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <input type="color" value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))} style={{width:40,height:32,borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',cursor:'pointer',padding:2}}/>
            <input value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))} style={{...iS,width:110,fontSize:12}} placeholder="#5BA3C7"/>
            <div style={{width:32,height:32,borderRadius:8,background:form.color,flexShrink:0}}/>
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:'rgba(237,232,219,0.4)',display:'block',marginBottom:8}}>Réseaux actifs</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{ALL_PLATFORMS.map(p=><button key={p.id} onClick={()=>toggleReseau(p.id)} style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${form.reseaux.includes(p.id)?form.color:'rgba(255,255,255,0.1)'}`,background:form.reseaux.includes(p.id)?`${form.color}20`:'transparent',color:form.reseaux.includes(p.id)?form.color:'rgba(237,232,219,0.5)',fontSize:12,fontWeight:form.reseaux.includes(p.id)?700:400,cursor:'pointer'}}>{p.icon} {p.label}</button>)}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{if(!form.label.trim())return;onSave(form)}} style={{flex:1,padding:'10px',borderRadius:10,border:'none',background:form.color,color:'#0D1B2A',fontSize:13,fontWeight:800,cursor:'pointer'}}>💾 Sauvegarder</button>
          <button onClick={onClose} style={{padding:'10px 20px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(237,232,219,0.5)',fontSize:13,cursor:'pointer'}}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

function ScorePanel({ post, project, onClose, onRewrite }) {
  const [score,setScore]=useState(null),[loading,setLoading]=useState(false),[rewrite,setRewrite]=useState(null),[rewLoading,setRewLoading]=useState(false)
  const analyser=async()=>{setLoading(true);try{const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-4o',max_tokens:400,response_format:{type:'json_object'},messages:[{role:'user',content:`Expert marketing. Analyse ce post ${post.platform}.\nPOST:${post.contenu}\nJSON:{"score_global":8,"accroche":{"note":8,"ok":true,"commentaire":"..."},"longueur":{"note":9,"ok":true,"commentaire":"..."},"cta":{"note":7,"ok":true,"commentaire":"..."},"ton":{"note":8,"ok":true,"commentaire":"..."},"originalite":{"note":7,"ok":true,"commentaire":"..."},"suggestion_globale":"..."}`}]})});const d=await res.json();setScore(JSON.parse(d.choices[0].message.content))}catch(e){console.error(e)}setLoading(false)}
  const ameliorer=async()=>{setRewLoading(true);try{const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-4o',max_tokens:600,messages:[{role:'user',content:`Expert copywriting ${post.platform}. Réécris en améliorant accroche, CTA, impact. Garde le sens.\nORIGINAL:${post.contenu}\nUNIQUEMENT le post réécrit.`}]})});const d=await res.json();setRewrite(d.choices[0].message.content.trim())}catch(e){console.error(e)}setRewLoading(false)}
  const sc=(n)=>n>=8?'#5BC78A':n>=6?'#D4A853':'#C75B4E'
  const criterias=score?[{label:'Accroche',data:score.accroche},{label:'Longueur',data:score.longueur},{label:'CTA',data:score.cta},{label:'Ton',data:score.ton},{label:'Originalité',data:score.originalite}]:[]
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#1a1d24',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:'100%',maxWidth:560,padding:28,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{fontSize:16,fontWeight:700,color:'#EDE8DB',margin:0}}>🎯 Score — {post.platform}</h3><button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',color:'rgba(237,232,219,0.6)',fontSize:12}}>✕</button></div>
        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:14,marginBottom:16,fontSize:12,color:'rgba(237,232,219,0.6)',lineHeight:1.6,whiteSpace:'pre-wrap',maxHeight:100,overflow:'hidden'}}>{post.contenu}</div>
        {!score&&<button onClick={analyser} disabled={loading} style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:loading?`${project.color}40`:project.color,color:'#0D1B2A',fontSize:13,fontWeight:800,cursor:loading?'not-allowed':'pointer',marginBottom:16}}>{loading?'⏳ Analyse...':'🔍 Analyser ce post'}</button>}
        {score&&<>
          <div style={{textAlign:'center',marginBottom:16,padding:'14px',background:`${sc(score.score_global)}15`,border:`1px solid ${sc(score.score_global)}30`,borderRadius:12}}><div style={{fontSize:48,fontWeight:900,color:sc(score.score_global),lineHeight:1}}>{score.score_global}</div><div style={{fontSize:12,color:'rgba(237,232,219,0.5)',marginTop:4}}>Score global / 10</div></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>{criterias.map(({label,data})=>data&&(<div key={label} style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:'10px 14px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:12,fontWeight:700,color:'#EDE8DB'}}>{data.ok?'✅':'⚠️'} {label}</span><span style={{fontSize:13,fontWeight:800,color:sc(data.note)}}>{data.note}/10</span></div><div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,marginBottom:6}}><div style={{width:`${data.note*10}%`,height:'100%',background:sc(data.note),borderRadius:2}}/></div><p style={{fontSize:11,color:'rgba(237,232,219,0.4)',margin:0}}>{data.commentaire}</p></div>))}</div>
          {score.suggestion_globale&&<div style={{background:'rgba(212,168,83,0.08)',border:'1px solid rgba(212,168,83,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#D4A853'}}>💡 {score.suggestion_globale}</div>}
          {!rewrite&&<button onClick={ameliorer} disabled={rewLoading} style={{width:'100%',padding:'10px',borderRadius:10,border:`1px solid ${project.color}`,background:'transparent',color:project.color,fontSize:12,fontWeight:700,cursor:rewLoading?'not-allowed':'pointer',marginBottom:8}}>{rewLoading?'⏳ Réécriture...':'✨ Améliorer automatiquement'}</button>}
          {rewrite&&<div style={{background:'rgba(91,199,138,0.05)',border:'1px solid rgba(91,199,138,0.2)',borderRadius:10,padding:14}}><p style={{fontSize:11,fontWeight:700,color:'#5BC78A',marginBottom:8}}>✨ Version améliorée :</p><p style={{fontSize:12,color:'rgba(237,232,219,0.8)',lineHeight:1.6,margin:'0 0 10px',whiteSpace:'pre-wrap'}}>{rewrite}</p><button onClick={()=>{onRewrite(rewrite);onClose()}} style={{width:'100%',padding:'8px',borderRadius:8,border:'none',background:'#5BC78A',color:'#0D1B2A',fontSize:12,fontWeight:800,cursor:'pointer'}}>✅ Utiliser cette version</button></div>}
        </>}
      </div>
    </div>
  )
}

function RepurposePanel({ project, onClose, onAddPosts }) {
  const [source,setSource]=useState(''),[loading,setLoading]=useState(false),[results,setResults]=useState([])
  const platforms=project.reseaux||['linkedin','facebook','discord','youtube']
  const plt_icon=ALL_PLATFORMS.reduce((acc,p)=>({...acc,[p.id]:p.icon}),{})
  const repurposer=async()=>{if(!source.trim())return;setLoading(true);setResults([]);try{const cfg=getConfig(project.id);for(const plt of platforms){const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-4o',max_tokens:600,messages:[{role:'user',content:`Expert repurposing pour ${plt}.\nProjet: ${project.label}\n${cfg.nom?`Identité: ${cfg.nom}`:''}\nSOURCE: ${source}\nUNIQUEMENT le post.`}]})});const d=await res.json();setResults(prev=>[...prev,{id:Date.now()+Math.random(),platform:plt,contenu:d.choices[0].message.content.trim(),date:new Date().toLocaleDateString('fr-FR'),statut:'brouillon'}])}}catch(e){console.error(e)}setLoading(false)}
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#1a1d24',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,width:'100%',maxWidth:760,padding:28,marginTop:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><div><h3 style={{fontSize:16,fontWeight:700,color:'#EDE8DB',margin:'0 0 4px'}}>♻️ Mode Repurpose</h3><p style={{fontSize:12,color:'rgba(237,232,219,0.4)',margin:0}}>Article / Vidéo / PDF → {platforms.length} posts</p></div><button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',color:'rgba(237,232,219,0.6)',fontSize:12}}>✕</button></div>
        <textarea value={source} onChange={e=>setSource(e.target.value)} placeholder="Colle ici ton contenu source..." rows={7} style={{width:'100%',padding:'12px 14px',borderRadius:10,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:13,outline:'none',resize:'vertical',fontFamily:"'Nunito Sans',sans-serif",boxSizing:'border-box',lineHeight:1.6,marginBottom:12}}/>
        <button onClick={repurposer} disabled={loading||!source.trim()} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:loading||!source.trim()?`${project.color}40`:project.color,color:'#0D1B2A',fontSize:14,fontWeight:800,cursor:loading||!source.trim()?'not-allowed':'pointer',marginBottom:20}}>{loading?`⏳ Génération...`:`♻️ Générer ${platforms.length} posts`}</button>
        {results.length>0&&<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>{results.map(r=><div key={r.id} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:14}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span>{plt_icon[r.platform]||'📱'}</span><span style={{fontSize:11,fontWeight:700,color:project.color,textTransform:'uppercase'}}>{r.platform}</span></div><p style={{fontSize:12,color:'rgba(237,232,219,0.7)',lineHeight:1.6,margin:'0 0 10px',whiteSpace:'pre-wrap',maxHeight:120,overflow:'hidden'}}>{r.contenu}</p><button onClick={()=>navigator.clipboard.writeText(r.contenu)} style={{width:'100%',padding:'6px',borderRadius:7,border:'none',background:project.color,color:'#0D1B2A',fontSize:11,fontWeight:700,cursor:'pointer'}}>📋 Copier</button></div>)}</div><button onClick={()=>{onAddPosts(results);onClose()}} style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:'#5BC78A',color:'#0D1B2A',fontSize:13,fontWeight:800,cursor:'pointer'}}>✅ Ajouter tous à ma liste</button></>}
      </div>
    </div>
  )
}

function TabContenu({ project, onGoToTemplates }) {
  const platforms=project.reseaux||['linkedin','facebook','discord','youtube']
  const plt_icon=ALL_PLATFORMS.reduce((acc,p)=>({...acc,[p.id]:p.icon}),{})
  const [prompt,setPrompt]=useState(''),[loading,setLoading]=useState(false),[genAll,setGenAll]=useState(false)
  const [posts,setPosts]=useState([]),[platform,setPlatform]=useState(platforms[0]||'linkedin')
  const [analysing,setAnalysing]=useState(null),[repurpose,setRepurpose]=useState(false)
  const [publishing,setPublishing]=useState(null)
  const [savedId,setSavedId]=useState(null) // id du post récemment sauvegardé comme template

  useEffect(()=>{if(!platforms.includes(platform))setPlatform(platforms[0])},[project.id])

  const generer=async(plt=platform,clearPrompt=true)=>{if(!prompt.trim())return;setLoading(true);try{const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-4o',max_tokens:800,messages:[{role:'user',content:buildPrompt(project,plt,prompt)}]})});const d=await res.json();setPosts(prev=>[{id:Date.now()+Math.random(),platform:plt,contenu:d.choices[0].message.content.trim(),date:new Date().toLocaleDateString('fr-FR'),statut:'brouillon'},...prev]);if(clearPrompt)setPrompt('')}catch(e){console.error(e)}setLoading(false)}
  const genererTout=async()=>{if(!prompt.trim())return;setGenAll(true);for(const plt of platforms)await generer(plt,false);setPrompt('');setGenAll(false)}
  const copier=(c)=>navigator.clipboard.writeText(c)
  const supprimer=(id)=>setPosts(prev=>prev.filter(p=>p.id!==id))
  const rewrite=(id,c)=>setPosts(prev=>prev.map(p=>p.id===id?{...p,contenu:c}:p))
  const addPosts=(np)=>setPosts(prev=>[...np,...prev])
  const publier=async(p)=>{setPublishing(p.id);try{await publierPost(p.platform,p.contenu);setPosts(prev=>prev.map(x=>x.id===p.id?{...x,statut:'publie'}:x))}catch(e){console.error(e)}setPublishing(null)}

  const sauvegarderTemplate = (p) => {
    saveTemplate({
      platform:     p.platform,
      contenu:      p.contenu,
      label:        `${p.platform} — ${p.date}`,
      projectId:    project.id,
      projectLabel: project.label,
    })
    setSavedId(p.id)
    setTimeout(() => setSavedId(null), 2500)
  }

  return(
    <div style={{display:'flex',gap:24,height:'100%'}}>
      {analysing&&<ScorePanel post={analysing} project={project} onClose={()=>setAnalysing(null)} onRewrite={(c)=>rewrite(analysing.id,c)}/>}
      {repurpose&&<RepurposePanel project={project} onClose={()=>setRepurpose(false)} onAddPosts={addPosts}/>}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:14}}>
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><h3 style={{fontSize:14,fontWeight:700,color:'#EDE8DB',margin:0}}>🤖 Génération IA</h3><button onClick={()=>setRepurpose(true)} style={{padding:'6px 14px',borderRadius:20,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.04)',color:'rgba(237,232,219,0.6)',fontSize:11,fontWeight:700,cursor:'pointer'}}>♻️ Repurpose</button></div>
          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>{platforms.map(p=><button key={p} onClick={()=>setPlatform(p)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${platform===p?project.color:'rgba(255,255,255,0.1)'}`,background:platform===p?`${project.color}20`:'transparent',color:platform===p?project.color:'rgba(237,232,219,0.5)',fontSize:11,fontWeight:700,cursor:'pointer'}}>{plt_icon[p]||'📱'} {p}</button>)}</div>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={`Décris ton idée pour ${project.label}...`} rows={5} style={{width:'100%',padding:'12px 14px',borderRadius:10,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#EDE8DB',fontSize:13,outline:'none',resize:'vertical',fontFamily:"'Nunito Sans',sans-serif",boxSizing:'border-box',lineHeight:1.6}}/>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button onClick={()=>generer(platform,true)} disabled={loading||!prompt.trim()} style={{flex:1,padding:'11px',borderRadius:10,border:'none',background:loading||!prompt.trim()?`${project.color}40`:project.color,color:'#0D1B2A',fontSize:13,fontWeight:800,cursor:loading||!prompt.trim()?'not-allowed':'pointer'}}>{loading?'⏳ Génération...':`✨ Générer ${platform}`}</button>
            <button onClick={genererTout} disabled={genAll||!prompt.trim()} style={{padding:'11px 16px',borderRadius:10,border:`1px solid ${project.color}`,background:'transparent',color:project.color,fontSize:12,fontWeight:700,cursor:genAll||!prompt.trim()?'not-allowed':'pointer',whiteSpace:'nowrap'}}>{genAll?'⏳...':'🌐 Tout générer'}</button>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,0.02)',border:'2px dashed rgba(255,255,255,0.08)',borderRadius:14,padding:20,textAlign:'center',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'} onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}><div style={{fontSize:28,marginBottom:6}}>📎</div><p style={{fontSize:13,color:'rgba(237,232,219,0.4)',margin:0}}>Glisse tes fichiers ici</p><p style={{fontSize:11,color:'rgba(237,232,219,0.2)',margin:'4px 0 0'}}>Images · Vidéos · PDF · Documents</p></div>
      </div>
      <div style={{width:340,display:'flex',flexDirection:'column',gap:10,overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'rgba(237,232,219,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',margin:0}}>Posts générés {posts.length>0&&`(${posts.length})`}</h3>
          {posts.length>0&&(
            <button onClick={onGoToTemplates} style={{fontSize:10,color:project.color,background:`${project.color}15`,border:`1px solid ${project.color}30`,padding:'2px 8px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              📚 Voir mes templates
            </button>
          )}
        </div>
        {posts.length===0?<div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:24,textAlign:'center',color:'rgba(237,232,219,0.3)',fontSize:13}}>Aucun post encore.<br/>Génère ton premier post ✨</div>:posts.map(p=>(
          <div key={p.id} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${p.statut==='publie'?'rgba(91,199,138,0.3)':'rgba(255,255,255,0.07)'}`,borderRadius:12,padding:14,flexShrink:0}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:project.color,textTransform:'uppercase'}}>{plt_icon[p.platform]||'📱'} {p.platform}</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {savedId===p.id&&<span style={{fontSize:9,color:'#D4A853',fontWeight:700}}>💾 Sauvegardé !</span>}
                {p.statut==='publie'&&<span style={{fontSize:9,color:'#5BC78A',fontWeight:700}}>✅ Publié</span>}
                <span style={{fontSize:10,color:'rgba(237,232,219,0.3)'}}>{p.date}</span>
              </div>
            </div>
            <p style={{fontSize:12,color:'rgba(237,232,219,0.75)',lineHeight:1.6,margin:'0 0 10px',whiteSpace:'pre-wrap',maxHeight:140,overflow:'hidden'}}>{p.contenu}</p>
            <div style={{display:'flex',gap:5}}>
              <button onClick={()=>copier(p.contenu)} style={{flex:1,padding:'6px',borderRadius:7,border:'none',background:project.color,color:'#0D1B2A',fontSize:11,fontWeight:700,cursor:'pointer'}}>📋 Copier</button>
              <button onClick={()=>setAnalysing(p)} style={{padding:'6px 8px',borderRadius:7,border:`1px solid ${project.color}40`,background:`${project.color}10`,color:project.color,fontSize:11,cursor:'pointer'}} title="Score">🎯</button>
              <button onClick={()=>sauvegarderTemplate(p)} title="Sauvegarder comme template" style={{padding:'6px 8px',borderRadius:7,border:'1px solid rgba(212,168,83,0.3)',background:'rgba(212,168,83,0.08)',color:'#D4A853',fontSize:11,cursor:'pointer'}}>💾</button>
              <button onClick={()=>publier(p)} disabled={publishing===p.id} style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(91,199,138,0.4)',background:'rgba(91,199,138,0.1)',color:'#5BC78A',fontSize:11,fontWeight:700,cursor:publishing===p.id?'not-allowed':'pointer'}}>{publishing===p.id?'⏳':'🚀 Publier'}</button>
              <button onClick={()=>supprimer(p.id)} style={{padding:'6px 8px',borderRadius:7,border:'1px solid rgba(199,91,78,0.2)',background:'transparent',color:'#C75B4E',fontSize:11,cursor:'pointer'}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────────
export default function App() {
  const [licenceOk,     setLicenceOk]     = useState(null)
  const [projects,      setProjects]      = useState(loadProjects)
  const [activeProject, setActiveProject] = useState(loadProjects()[0]?.id||'vigie')
  const [activeTab,     setActiveTab]     = useState('contenu')
  const [projetModal,   setProjetModal]   = useState(null)
  const [themeModal,    setThemeModal]    = useState(false)
  const [theme,         setTheme]         = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY_THEME); return s ? JSON.parse(s) : BG_THEMES[0] }
    catch { return BG_THEMES[0] }
  })

  useEffect(() => {
    const check = async () => {
      if (window.electronAPI?.checkLicence) {
        const ok = await window.electronAPI.checkLicence()
        setLicenceOk(ok)
      } else {
        setLicenceOk(true)
      }
    }
    check()
  }, [])

  const project = projects.find(p=>p.id===activeProject)||projects[0]
  const selectTheme = (t) => { setTheme(t); localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(t)) }
  const saveProjects = (p) => { localStorage.setItem(STORAGE_KEY_PROJECTS,JSON.stringify(p)); setProjects(p) }
  const handleSaveProjet = (form) => {
    const exists=projects.find(p=>p.id===form.id)
    let updated
    if(exists) updated=projects.map(p=>p.id===form.id?form:p)
    else { updated=[...projects,form]; setActiveProject(form.id) }
    saveProjects(updated); setProjetModal(null)
  }
  const supprimerProjet=(id)=>{if(projects.length<=1)return;if(!confirm('Supprimer ?'))return;const updated=projects.filter(p=>p.id!==id);saveProjects(updated);if(activeProject===id)setActiveProject(updated[0].id)}

  if (licenceOk === null) return (
    <div style={{background:'#0D1B2A',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito Sans',sans-serif"}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:16}}>🧭</div>
        <p style={{color:'rgba(237,232,219,0.3)',fontSize:13}}>Chargement...</p>
      </div>
    </div>
  )

  if (!licenceOk) return <LicenceModal onActivated={() => setLicenceOk(true)} />

  return (
    <div style={{fontFamily:"'Nunito Sans',sans-serif",background:theme.bg,color:'#EDE8DB',height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,opacity:0.035,backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,backgroundRepeat:'repeat',backgroundSize:'128px'}}/>

      {projetModal&&<ProjetModal projet={projetModal==='new'?{}:projetModal} onSave={handleSaveProjet} onClose={()=>setProjetModal(null)}/>}
      {themeModal&&<ThemeModal currentTheme={theme} onSelect={selectTheme} onClose={()=>setThemeModal(false)}/>}

      <div style={{height:52,background:'rgba(0,0,0,0.35)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',flexShrink:0,position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${project.color},${theme.bg})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{project.emoji}</div>
          <span style={{fontFamily:"'Georgia',serif",fontSize:16,fontWeight:700,color:'#EDE8DB',letterSpacing:'0.02em'}}>Pilot</span>
          <span style={{fontSize:11,color:'rgba(237,232,219,0.3)',background:'rgba(255,255,255,0.05)',padding:'2px 8px',borderRadius:10}}>Syon</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setThemeModal(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',cursor:'pointer',color:'rgba(237,232,219,0.5)',fontSize:11}}>
            🎨 <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:theme.bg,border:'1px solid rgba(255,255,255,0.3)'}}/>
          </button>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#5BC78A'}}/>
            <span style={{fontSize:11,color:'rgba(237,232,219,0.3)'}}>v1.0.0</span>
          </div>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative',zIndex:1}}>
        <div style={{width:200,background:'rgba(0,0,0,0.25)',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',padding:'16px 10px',gap:4,flexShrink:0,overflowY:'auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 8px',marginBottom:8}}>
            <p style={{fontSize:9,fontWeight:700,color:'rgba(237,232,219,0.25)',textTransform:'uppercase',letterSpacing:'0.1em',margin:0}}>Projets</p>
            <button onClick={()=>setProjetModal('new')} style={{background:'transparent',border:'none',cursor:'pointer',color:'rgba(237,232,219,0.3)',fontSize:16,lineHeight:1,padding:0}} onMouseEnter={e=>e.currentTarget.style.color='#EDE8DB'} onMouseLeave={e=>e.currentTarget.style.color='rgba(237,232,219,0.3)'}>+</button>
          </div>
          {projects.map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:2}}>
              <button onClick={()=>setActiveProject(p.id)} style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:10,border:'none',background:activeProject===p.id?`${p.color}18`:'transparent',cursor:'pointer',textAlign:'left',borderLeft:activeProject===p.id?`3px solid ${p.color}`:'3px solid transparent',transition:'all 0.15s'}}>
                <span style={{fontSize:15}}>{p.emoji}</span>
                <span style={{fontSize:12,fontWeight:activeProject===p.id?700:500,color:activeProject===p.id?p.color:'rgba(237,232,219,0.5)'}}>{p.label}</span>
              </button>
              <button onClick={()=>setProjetModal(p)} style={{background:'transparent',border:'none',cursor:'pointer',color:'rgba(237,232,219,0.2)',fontSize:11,padding:'4px',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.color='rgba(237,232,219,0.6)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(237,232,219,0.2)'}>✏️</button>
              {projects.length>1&&<button onClick={()=>supprimerProjet(p.id)} style={{background:'transparent',border:'none',cursor:'pointer',color:'rgba(237,232,219,0.2)',fontSize:11,padding:'4px',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.color='#C75B4E'} onMouseLeave={e=>e.currentTarget.style.color='rgba(237,232,219,0.2)'}>🗑️</button>}
            </div>
          ))}
          <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'12px 0'}}/>
          <p style={{fontSize:9,fontWeight:700,color:'rgba(237,232,219,0.25)',textTransform:'uppercase',letterSpacing:'0.1em',padding:'0 8px',marginBottom:8}}>Modules</p>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',background:activeTab===t.id?'rgba(255,255,255,0.07)':'transparent',cursor:'pointer',textAlign:'left',transition:'all 0.15s',borderLeft:activeTab===t.id&&ACTIVE_TABS.includes(t.id)?`3px solid ${project.color}`:'3px solid transparent'}}>
              <span style={{fontSize:14}}>{t.emoji}</span>
              <span style={{fontSize:12,fontWeight:activeTab===t.id?700:400,color:activeTab===t.id?'#EDE8DB':'rgba(237,232,219,0.4)'}}>{t.label}</span>
            </button>
          ))}
          <div style={{marginTop:'auto',padding:'12px 8px 0'}}>
            <div style={{padding:'10px 12px',borderRadius:10,background:`${project.color}10`,border:`1px solid ${project.color}20`}}>
              <p style={{fontSize:10,color:project.color,fontWeight:700,margin:'0 0 2px'}}>{project.emoji} {project.label}</p>
              <p style={{fontSize:10,color:'rgba(237,232,219,0.3)',margin:0}}>{(project.reseaux||[]).length} réseau{(project.reseaux||[]).length>1?'x':''} actif{(project.reseaux||[]).length>1?'s':''}</p>
            </div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'16px 24px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>{TABS.find(t=>t.id===activeTab)?.emoji}</span>
            <h2 style={{fontFamily:"'Georgia',serif",fontSize:20,fontWeight:700,color:'#EDE8DB',margin:0}}>{TABS.find(t=>t.id===activeTab)?.label}</h2>
            <span style={{fontSize:11,background:`${project.color}15`,border:`1px solid ${project.color}30`,padding:'2px 10px',borderRadius:20,color:project.color}}>{project.emoji} {project.label}</span>
          </div>
          <div style={{flex:1,padding:24,overflowY:'auto'}}>
            {activeTab==='contenu'          && <TabContenu project={project} onGoToTemplates={()=>setActiveTab('templates')}/>}
            {activeTab==='studia'           && <PageStudIA project={project}/>}
            {activeTab==='templates'        && <PageTemplates project={project}/>}
            {activeTab==='calendrier'       && <PageCalendrier project={project} projects={projects}/>}
            {activeTab==='personnalisation' && <PagePersonnalisation project={project}/>}
            {activeTab==='vault'            && <PageVault project={project} projects={projects}/>}
            {activeTab==='monitoring'       && <PageMonitoring project={project}/>}
            {activeTab==='finances'         && <PageFinances project={project}/>}
            {activeTab==='sav'             && <PageSAV project={project}/>}
            {activeTab==='prospects'        && <PageProspects project={project}/>}
            {activeTab==='engagement'       && <PageEngagement project={project}/>}
            {activeTab==='assistant'        && <PageAssistant project={project}/>}
          </div>
        </div>
      </div>

      <style>{`
  *{box-sizing:border-box;margin:0;padding:0;}
  body{overflow:hidden;}
  ::-webkit-scrollbar{width:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
  button,textarea,input,select{font-family:'Nunito Sans',sans-serif;}
  select, select option {
    background-color: #1a1d24 !important;
    color: #EDE8DB !important;
  }
  select {
    border: 1px solid rgba(255,255,255,0.1) !important;
    padding: 6px 10px;
    border-radius: 8px;
  }
`}</style>
    </div>
  )
}

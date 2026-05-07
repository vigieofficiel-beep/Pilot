import { useState } from 'react'

const STUDIA_COLOR = '#7F77DD'

const TABS = [
  { id: 'voix',    label: 'Clone IA voix',       emoji: '🎙️', subtitle: 'Cloner ta voix et générer des audios' },
  { id: 'images',  label: 'Photos & Images IA',  emoji: '🖼️', subtitle: 'Générer des images par lot' },
  { id: 'cinema',  label: 'Studio Cinéma',       emoji: '🎬', subtitle: 'Vidéos longues 3-12 min, montage auto' },
  { id: 'shorts',  label: 'Tutos vidéo courts',  emoji: '⚡', subtitle: 'Shorts 30s-2min vertical 9:16' },
]

const iS = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDE8DB', fontSize: 13, outline: 'none',
  fontFamily: "'Nunito Sans',sans-serif", boxSizing: 'border-box', lineHeight: 1.6,
}

// ── ONGLET 1 : CLONE IA VOIX ──────────────────────────────────────
function TabVoix({ project }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, height: '100%' }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎤 Mes voix clonées</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Phase 1 frontend mocké — aucune voix encore. Phase 3 : XTTS sur RunPod)
        </p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>✨ Générer un audio</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Form de génération à venir — texte → audio synthétisé)
        </p>
      </div>
    </div>
  )
}

// ── ONGLET 2 : PHOTOS & IMAGES IA ─────────────────────────────────
function TabImages({ project }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🎨 Générer des images</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Form style/format/prompt à venir — Phase 4 : SDXL sur RunPod)
        </p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>🖼️ Galerie</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Aucune image générée encore)
        </p>
      </div>
    </div>
  )
}

// ── ONGLET 3 : STUDIO CINÉMA ──────────────────────────────────────
function TabCinema({ project }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📝 Brief vidéo</h3>
          <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
            (Form complet à venir — sujet, durée, voix, style visuel, B-roll auto)
          </p>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{ aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
            <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.3)' }}>
              🎬 Lecteur vidéo HTML5 (à venir Phase 7)
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 8 }}>📌 Annotations</h3>
        <p style={{ fontSize: 11, color: 'rgba(237,232,219,0.4)', marginBottom: 16, lineHeight: 1.5 }}>
          Clique sur la vidéo à un instant T pour annoter et demander une régénération ciblée.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.3)', textAlign: 'center', padding: '40px 0', fontStyle: 'italic' }}>
          (Aucune annotation pour l'instant)
        </p>
      </div>
    </div>
  )
}

// ── ONGLET 4 : TUTOS COURTS ───────────────────────────────────────
function TabShorts({ project }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>⚡ Nouveau short (vertical 9:16)</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Form sujet + style visuel à venir — Phase 6)
        </p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#EDE8DB', marginBottom: 16 }}>📱 Mes shorts</h3>
        <p style={{ fontSize: 12, color: 'rgba(237,232,219,0.4)', textAlign: 'center', padding: '40px 0' }}>
          (Aucun short généré encore)
        </p>
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

      {/* Bandeau onglets en haut */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0,
      }}>
        {TABS.map(t => {
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                border: 'none',
                background: 'transparent',
                color: isActive ? STUDIA_COLOR : 'rgba(237,232,219,0.45)',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s',
                borderBottom: isActive ? `2px solid ${STUDIA_COLOR}` : '2px solid transparent',
                marginBottom: -1,
              }}>
              <span style={{ marginRight: 6 }}>{t.emoji}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Sous-titre de l'onglet actif */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 12,
          background: `${STUDIA_COLOR}15`, color: STUDIA_COLOR,
          border: `1px solid ${STUDIA_COLOR}30`, fontWeight: 700,
        }}>
          Stud'IA
        </span>
        <span style={{ fontSize: 12, color: 'rgba(237,232,219,0.5)' }}>
          {tab?.subtitle}
        </span>
      </div>

      {/* Contenu de l'onglet */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'voix'   && <TabVoix project={project} />}
        {activeTab === 'images' && <TabImages project={project} />}
        {activeTab === 'cinema' && <TabCinema project={project} />}
        {activeTab === 'shorts' && <TabShorts project={project} />}
      </div>
    </div>
  )
}

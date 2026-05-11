/**
 * DriveModal.jsx — Modal de configuration Google Drive pour Pilot Stud'IA
 *
 * Calque du pattern OpenAIKeyModal mais pour OAuth Google Drive.
 *
 * 3 etats possibles :
 *  - NON CONFIGURE : pas de google-client-secret.json -> instructions pour le placer
 *  - CONFIGURE NON CONNECTE : JSON present mais aucun token -> bouton "Connecter"
 *  - CONNECTE : utilisateur autorise -> affiche email + bouton "Deconnecter"
 *
 * Toute la logique passe par window.electronAPI.drive.* qu'on a defini hier.
 */

import { useState, useEffect } from 'react'

const STUDIA_COLOR = '#7F77DD'

const iS = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDE8DB', fontSize: 13, outline: 'none',
  fontFamily: "'Nunito Sans',sans-serif", boxSizing: 'border-box', lineHeight: 1.6,
}

export default function DriveModal({ onClose, onChanged }) {
  const [configured, setConfigured] = useState(false)
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const refresh = async () => {
    try {
      const cfg = await window.electronAPI.drive.isConfigured()
      setConfigured(cfg)
      if (cfg) {
        const conn = await window.electronAPI.drive.isConnected()
        setConnected(conn)
        if (conn) {
          const acc = await window.electronAPI.drive.getConnectedAccount()
          setAccount(acc)
        } else {
          setAccount(null)
        }
      } else {
        setConnected(false)
        setAccount(null)
      }
    } catch (err) {
      console.error('[DriveModal] refresh error:', err)
      setError(err.message || String(err))
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const connecter = async () => {
    setBusy(true)
    setBusyLabel('⏳ Ouverture du navigateur pour autorisation Google...')
    setError(null)
    try {
      const result = await window.electronAPI.drive.startOAuthFlow()
      if (result.success) {
        setSuccessMsg(`✅ Compte connecté : ${result.email}`)
        await refresh()
        if (onChanged) onChanged()
      } else {
        setError(result.error || 'Erreur de connexion')
      }
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
    setBusyLabel('')
  }

  const deconnecter = async () => {
    if (!confirm('Déconnecter Pilot de ton Google Drive ?\n\nLes fichiers déjà uploadés restent sur ton Drive, seul l\'accès est révoqué.')) return
    setBusy(true)
    setBusyLabel('⏳ Révocation du token...')
    setError(null)
    try {
      await window.electronAPI.drive.disconnect()
      setSuccessMsg('🔌 Déconnecté de Google Drive')
      await refresh()
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
    setBusyLabel('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 540, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EDE8DB', margin: 0 }}>☁️ Google Drive</h3>
          {!busy && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'rgba(237,232,219,0.6)', fontSize: 12 }}>✕</button>}
        </div>

        {/* Bandeau info BYOK */}
        <div style={{ background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.7)', lineHeight: 1.6 }}>
          💡 <strong>Pilot uploade tes fichiers directement</strong> de ton PC vers ton Drive. Aucun token ne transite par les serveurs Doppler. L'arborescence créée sera <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>Pilot/{'{ProjetID}'}/Stud'IA/...</code>
        </div>

        {/* Etat de chargement initial */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'rgba(237,232,219,0.5)' }}>
            ⏳ Vérification de l'état...
          </div>
        )}

        {/* CAS 1 : NON CONFIGURE */}
        {!loading && !configured && (
          <>
            <div style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: '#D4A853', lineHeight: 1.6 }}>
              ⚠️ <strong>Drive non configuré.</strong> Place ton fichier <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>google-client-secret.json</code> obtenu sur <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: STUDIA_COLOR }}>Google Cloud Console</a> dans :
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6, marginTop: 8, fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                %APPDATA%\pilot\google-client-secret.json
              </div>
            </div>
            <details style={{ fontSize: 12, color: 'rgba(237,232,219,0.6)', marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 600 }}>📋 Procédure rapide (cliquer pour déplier)</summary>
              <ol style={{ lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
                <li>Aller sur <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: STUDIA_COLOR }}>console.cloud.google.com</a></li>
                <li>Créer un projet (nom au choix, ex: "Pilot Drive")</li>
                <li>Activer l'API Google Drive</li>
                <li>OAuth consent screen : type Externe, scope <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 3px', borderRadius: 3 }}>drive.file</code>, ajouter ton email en utilisateur de test</li>
                <li>Identifiants → Créer un client OAuth → Type "Application de bureau"</li>
                <li>Télécharger le JSON → renommer en <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 3px', borderRadius: 3 }}>google-client-secret.json</code></li>
                <li>Placer dans <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 3px', borderRadius: 3 }}>%APPDATA%\pilot\</code></li>
                <li>Cliquer sur le bouton "🔄 Vérifier" ci-dessous</li>
              </ol>
            </details>
            <button onClick={refresh} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#EDE8DB', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Vérifier à nouveau
            </button>
          </>
        )}

        {/* CAS 2 : CONFIGURE MAIS NON CONNECTE */}
        {!loading && configured && !connected && (
          <>
            <div style={{ background: 'rgba(91,199,138,0.08)', border: '1px solid rgba(91,199,138,0.3)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: '#5BC78A', lineHeight: 1.6 }}>
              ✅ Configuration détectée. Il reste à autoriser Pilot à accéder à ton compte Google.
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(237,232,219,0.6)', lineHeight: 1.6 }}>
              <strong style={{ color: '#EDE8DB' }}>Ce qui va se passer :</strong>
              <ol style={{ lineHeight: 1.8, paddingLeft: 20, marginTop: 8, marginBottom: 0 }}>
                <li>Pilot ouvre une page Google dans ton navigateur</li>
                <li>Tu choisis ton compte et tu autorises Pilot</li>
                <li>Tu vois "Pilot connecté à Google Drive" et tu reviens ici</li>
              </ol>
            </div>
            {busy && (
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11, color: '#D4A853', textAlign: 'center' }}>
                {busyLabel}
              </div>
            )}
            <button onClick={connecter} disabled={busy} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: busy ? `${STUDIA_COLOR}40` : STUDIA_COLOR, color: '#0D1B2A', fontSize: 13, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? '⏳ Connexion en cours...' : '🔐 Connecter mon compte Google'}
            </button>
          </>
        )}

        {/* CAS 3 : CONNECTE */}
        {!loading && configured && connected && (
          <>
            <div style={{ background: 'rgba(91,199,138,0.08)', border: '1px solid rgba(91,199,138,0.3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#5BC78A20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#5BC78A' }}>Connecté</div>
                  <div style={{ fontSize: 11, color: 'rgba(237,232,219,0.7)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📧 {account?.email || '...'}
                  </div>
                  {account?.name && <div style={{ fontSize: 10, color: 'rgba(237,232,219,0.4)' }}>{account.name}</div>}
                </div>
              </div>
              <a href="https://drive.google.com/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 11, color: STUDIA_COLOR, textDecoration: 'none' }}>
                ↗ Ouvrir Google Drive dans le navigateur
              </a>
            </div>
            {busy && (
              <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11, color: '#D4A853', textAlign: 'center' }}>
                {busyLabel}
              </div>
            )}
            <button onClick={deconnecter} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(199,91,78,0.3)', background: 'rgba(199,91,78,0.08)', color: '#C75B4E', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              🔌 Déconnecter
            </button>
          </>
        )}

        {/* Messages d'erreur / succes */}
        {error && (
          <div style={{ background: 'rgba(199,91,78,0.1)', border: '1px solid rgba(199,91,78,0.3)', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12, color: '#C75B4E' }}>
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(91,199,138,0.1)', border: '1px solid rgba(91,199,138,0.3)', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12, color: '#5BC78A' }}>
            {successMsg}
          </div>
        )}
      </div>
    </div>
  )
}

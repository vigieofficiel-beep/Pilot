// Preload script execute dans la fenetre YouTube de la veille
// Recoit les stats via window.PILOT_OVERLAY_DATA et injecte le bandeau

const { ipcRenderer } = require('electron')

console.log('[Pilot Overlay Preload] Script charge')

// Demande les donnees au main process
async function getDataAndInject() {
  try {
    const data = await ipcRenderer.invoke('pilot-overlay-get-data')
    if (!data) {
      console.warn('[Pilot Overlay Preload] Pas de donnees recues')
      return
    }
    injectOverlay(data.stats, data.channel)
  } catch (e) {
    console.error('[Pilot Overlay Preload] Erreur recuperation donnees:', e)
  }
}

function injectOverlay(stats, channel) {
  if (!document.body) {
    setTimeout(() => injectOverlay(stats, channel), 500)
    return
  }

  const existing = document.getElementById('pilot-yt-overlay')
  if (existing) existing.remove()

  const C = channel || {}
  const S = stats || {}
  const fmt = (n) => (n || 0).toLocaleString('fr-FR')

  const ov = document.createElement('div')
  ov.id = 'pilot-yt-overlay'
  ov.style.cssText = 'position:fixed;top:60px;right:20px;width:340px;max-height:calc(100vh - 80px);overflow-y:auto;background:#0D1B2A;color:#e2e8f0;border:1px solid #1f2733;border-radius:12px;padding:18px;z-index:99999;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);'

  const hdr = document.createElement('div')
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #1f2733;padding-bottom:10px;'
  const hdrLeft = document.createElement('div')
  hdrLeft.style.cssText = 'display:flex;align-items:center;gap:10px;'
  if (C.thumbnail) {
    const img = document.createElement('img')
    img.src = C.thumbnail
    img.style.cssText = 'width:36px;height:36px;border-radius:50%;'
    hdrLeft.appendChild(img)
  }
  const hdrText = document.createElement('div')
  const hdrTitle = document.createElement('div')
  hdrTitle.style.cssText = 'font-weight:700;font-size:14px;'
  hdrTitle.textContent = C.title || ''
  const hdrSubtitle = document.createElement('div')
  hdrSubtitle.style.cssText = 'color:#94a3b8;font-size:11px;'
  hdrSubtitle.textContent = 'Pilot Engagement'
  hdrText.appendChild(hdrTitle)
  hdrText.appendChild(hdrSubtitle)
  hdrLeft.appendChild(hdrText)
  const closeBtn = document.createElement('button')
  closeBtn.textContent = 'x'
  closeBtn.style.cssText = 'background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:22px;line-height:1;padding:0 4px;'
  closeBtn.addEventListener('click', () => ov.remove())
  hdr.appendChild(hdrLeft)
  hdr.appendChild(closeBtn)
  ov.appendChild(hdr)

  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;'
  const tile = (label, value, color) => {
    const t = document.createElement('div')
    t.style.cssText = 'background:#0a1320;padding:10px;border-radius:8px;'
    const l = document.createElement('div')
    l.style.cssText = 'color:#94a3b8;font-size:11px;'
    l.textContent = label
    const v = document.createElement('div')
    v.style.cssText = 'font-size:18px;font-weight:700;color:' + color + ';'
    v.textContent = value
    t.appendChild(l); t.appendChild(v)
    return t
  }
  grid.appendChild(tile('Abonnes', fmt(C.subscribers), '#ec4899'))
  grid.appendChild(tile('Vues totales', fmt(C.total_views), '#ec4899'))
  grid.appendChild(tile('Vues moy. 30j', fmt(S.avg_views_last_30d), '#22c55e'))
  grid.appendChild(tile('Videos / 30j', String(S.videos_last_30d || 0), '#22c55e'))
  ov.appendChild(grid)

  const topSec = document.createElement('div')
  topSec.style.cssText = 'margin-bottom:14px;'
  const topTitle = document.createElement('div')
  topTitle.style.cssText = 'color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:6px;'
  topTitle.textContent = 'Top videos'
  topSec.appendChild(topTitle)
  if (S.top_videos && S.top_videos.length) {
    S.top_videos.forEach(v => {
      const row = document.createElement('div')
      row.style.cssText = 'padding:6px 0;border-bottom:1px solid #1f2733;'
      const a = document.createElement('a')
      a.href = v.link
      a.target = '_blank'
      a.style.cssText = 'color:#ec4899;font-size:12px;text-decoration:none;line-height:1.3;display:block;'
      a.textContent = (v.title || '').slice(0, 70)
      const meta = document.createElement('div')
      meta.style.cssText = 'color:#94a3b8;font-size:11px;margin-top:2px;'
      meta.textContent = fmt(v.views) + ' vues'
      row.appendChild(a); row.appendChild(meta)
      topSec.appendChild(row)
    })
  } else {
    const empty = document.createElement('div')
    empty.style.cssText = 'color:#64748b;font-size:11px;'
    empty.textContent = 'Aucune video recente'
    topSec.appendChild(empty)
  }
  ov.appendChild(topSec)

  const tagSec = document.createElement('div')
  const tagTitle = document.createElement('div')
  tagTitle.style.cssText = 'color:#94a3b8;font-size:12px;font-weight:600;margin-bottom:6px;'
  tagTitle.textContent = 'Tags les plus utilises'
  tagSec.appendChild(tagTitle)
  const tagWrap = document.createElement('div')
  if (S.top_tags && S.top_tags.length) {
    S.top_tags.forEach(t => {
      const sp = document.createElement('span')
      sp.style.cssText = 'background:#1f2733;color:#cbd5e1;padding:3px 8px;border-radius:12px;font-size:11px;margin:2px;display:inline-block;'
      sp.textContent = t.tag + ' (' + t.count + ')'
      tagWrap.appendChild(sp)
    })
  } else {
    const empty = document.createElement('span')
    empty.style.cssText = 'color:#64748b;font-size:11px;'
    empty.textContent = 'Aucun tag detecte'
    tagWrap.appendChild(empty)
  }
  tagSec.appendChild(tagWrap)
  ov.appendChild(tagSec)

  document.body.appendChild(ov)
  console.log('[Pilot Overlay Preload] Bandeau injecte avec succes')
}

// Tentative immediate + retry sur changements de page (YouTube SPA)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', getDataAndInject)
} else {
  getDataAndInject()
}

// Reinjection sur changements d'URL (YouTube est une SPA)
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(getDataAndInject, 1000)
  }
}).observe(document.body || document.documentElement, { subtree: true, childList: true })

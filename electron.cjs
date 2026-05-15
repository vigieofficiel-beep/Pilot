const { app, BrowserWindow, ipcMain, session, net, dialog, shell, Menu } = require('electron')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const http = require('http')
const { URL } = require('url')
const driveModule = require('./drive.cjs')

let mainWindow
let browserWindows = {}
let searchWindow = null
let scanWindow = null
let overlayWindow = null
let overlayData = null  // Stocke les donnees pour le preload

// ═══════════════════════════════════════════════════════════════════════════
// MENU CONTEXTUEL CLIC DROIT (Couper / Copier / Coller / Selectionner tout)
// ═══════════════════════════════════════════════════════════════════════════
// S'applique a toutes les fenetres Pilot (principale + fenetres reseaux sociaux).
// Affiche un menu adapte au contexte :
//  - Champ editable + selection : Couper/Copier/Coller/Tout selectionner
//  - Champ editable sans selection : Coller/Tout selectionner
//  - Texte selectionne (non editable) : Copier
//  - En dev : Inspecter l'element
// ═══════════════════════════════════════════════════════════════════════════

function attachContextMenu(win) {
  if (!win || win.isDestroyed()) return
  win.webContents.on('context-menu', (event, params) => {
    const { isEditable, selectionText, x, y } = params
    const hasSelection = selectionText && selectionText.trim().length > 0
    const isDev = !app.isPackaged

    const template = []

    if (isEditable) {
      template.push(
        { label: 'Annuler', role: 'undo', enabled: params.editFlags.canUndo },
        { label: 'Refaire', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: 'Couper', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copier', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Coller', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Tout selectionner', role: 'selectAll' },
      )
    } else if (hasSelection) {
      template.push(
        { label: 'Copier', role: 'copy' },
        { type: 'separator' },
        { label: 'Tout selectionner', role: 'selectAll' },
      )
    } else {
      template.push(
        { label: 'Tout selectionner', role: 'selectAll' },
      )
    }

    if (isDev) {
      template.push(
        { type: 'separator' },
        { label: 'Inspecter l\'element', click: () => win.webContents.inspectElement(x, y) },
      )
    }

    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: win })
  })
}

// -- SYSTEME LICENCE -----------------------------------------------------
const LICENCE_FILE = path.join(app.getPath('userData'), 'licence.json')
const LICENCE_SALT = 'pilotage-syon-2025-lucien'

function hashCode(code) {
  return crypto.createHmac('sha256', LICENCE_SALT).update(code.trim().toUpperCase()).digest('hex')
}

const VALID_HASHES = [
  hashCode('PLTG-DEV0-0000-0001'),
  hashCode('PLTG-DEV0-0000-0002'),
  hashCode('PLTG-EARL-Y001-2025'),
  hashCode('PLTG-EARL-Y002-2025'),
  hashCode('PLTG-EARL-Y003-2025'),
  hashCode('PLTG-EARL-Y004-2025'),
  hashCode('PLTG-EARL-Y005-2025'),
  hashCode('PLTG-AGCE-A001-2025'),
  hashCode('PLTG-AGCE-A002-2025'),
  hashCode('PLTG-FREE-DEMO-2025'),
]

function isLicenceActive() {
  try {
    if (!fs.existsSync(LICENCE_FILE)) return false
    const data = JSON.parse(fs.readFileSync(LICENCE_FILE, 'utf8'))
    return data.activated === true && VALID_HASHES.includes(data.hash)
  } catch { return false }
}

function activateLicence(code) {
  const hash = hashCode(code)
  if (!VALID_HASHES.includes(hash)) return false
  try {
    fs.writeFileSync(LICENCE_FILE, JSON.stringify({
      activated: true,
      hash,
      code: code.substring(0, 4) + '-****-****-' + code.slice(-4),
      date: new Date().toISOString(),
    }))
    return true
  } catch { return false }
}

function getLicenceInfo() {
  try {
    if (!fs.existsSync(LICENCE_FILE)) return null
    return JSON.parse(fs.readFileSync(LICENCE_FILE, 'utf8'))
  } catch { return null }
}

ipcMain.handle('check-licence', () => isLicenceActive())
ipcMain.handle('activate-licence', (_, code) => activateLicence(code))
ipcMain.handle('get-licence-info', () => getLicenceInfo())

// Handler pour le preload script de l'overlay
ipcMain.handle('pilot-overlay-get-data', () => overlayData)

// -- FENETRE PRINCIPALE --------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Pilotage Syon',
    backgroundColor: '#0D1B2A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'default',
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  attachContextMenu(mainWindow)

  mainWindow.on('closed', () => { mainWindow = null })
}

// -- PUBLICATION RESEAUX SOCIAUX ----------------------------------------
ipcMain.handle('publish-post', async (event, { platform, contenu }) => {
  const urls = {
    linkedin:  'https://www.linkedin.com/feed/',
    facebook:  'https://www.facebook.com/',
    discord:   'https://discord.com/channels/@me',
    youtube:   'https://studio.youtube.com/',
    twitter:   'https://twitter.com/compose/tweet',
    instagram: 'https://www.instagram.com/',
    tiktok:    'https://www.tiktok.com/upload',
    threads:   'https://www.threads.net/',
  }

  const url = urls[platform] || urls.linkedin

  if (browserWindows[platform] && !browserWindows[platform].isDestroyed()) {
    browserWindows[platform].focus()
    try {
      await browserWindows[platform].webContents.executeJavaScript(buildScript(platform, contenu))
    } catch(e) { console.error(e) }
    return { success: true }
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: `Publier sur ${platform} - Pilotage`,
    backgroundColor: '#0D1B2A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      webSecurity: false,
      partition: `persist:pilotage_${platform}`,
    },
  })

  attachContextMenu(win)
  browserWindows[platform] = win
  win.on('closed', () => { delete browserWindows[platform] })

  await win.loadURL(url, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  })

  win.webContents.on('did-finish-load', async () => {
    await win.webContents.executeJavaScript(`
      navigator.clipboard.writeText(${JSON.stringify(contenu)}).catch(()=>{})
    `).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 2500))
    try {
      await win.webContents.executeJavaScript(buildScript(platform, contenu))
    } catch(e) { console.error('Injection error:', e) }
  })

  return { success: true }
})

function buildScript(platform, contenu) {
  const escaped = JSON.stringify(contenu)
  const scripts = {
    linkedin: `(function(){const btn=document.querySelector('[data-control-name="share.sharebox_prompt_button"],.share-box-feed-entry__trigger,button.artdeco-button--muted');if(btn)btn.click();setTimeout(()=>{const ed=document.querySelector('.ql-editor[contenteditable="true"],[data-placeholder][contenteditable="true"],[role="textbox"][contenteditable="true"]');if(ed){ed.focus();ed.innerHTML='';document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}},1800)})();`,
    facebook: `(function(){const btn=document.querySelector('[aria-label="Creer une publication"],[data-testid="status-attachment-mentions-input"]');if(btn)btn.click();setTimeout(()=>{const ed=document.querySelector('[contenteditable="true"][role="textbox"],[data-lexical-editor="true"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}},1800)})();`,
    discord:  `(function(){const ed=document.querySelector('[data-slate-editor="true"],[role="textbox"][contenteditable="true"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
    twitter:  `(function(){const ed=document.querySelector('[data-testid="tweetTextarea_0"],[contenteditable="true"][role="textbox"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
    youtube:  `(function(){const ed=document.querySelector('#description-textarea,ytcp-mention-textbox [contenteditable="true"],textarea[aria-label]');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    instagram:`(function(){const ed=document.querySelector('textarea[aria-label],[contenteditable="true"]');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(ed,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    tiktok:   `(function(){const ed=document.querySelector('[contenteditable="true"],textarea');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    threads:  `(function(){const ed=document.querySelector('[contenteditable="true"][role="textbox"],textarea');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
  }
  return scripts[platform] || `(function(){const ed=document.querySelector('[contenteditable="true"],textarea');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`
}

// -- FENETRE DE RECHERCHE MANUELLE (enrichissement prospects) -----------
ipcMain.handle('open-search-window', async (event, { url, prospectId }) => {
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.focus()
    await searchWindow.loadURL(url, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    })
    return { success: true }
  }

  searchWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Recherche prospect - Pilotage',
    backgroundColor: '#0D1B2A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: 'persist:pilotage_search',
    },
  })

  attachContextMenu(searchWindow)
  searchWindow.on('closed', () => { searchWindow = null })

  await searchWindow.loadURL(url, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  })

  return { success: true }
})

// -- PHASE 7B - SCAN POSTS PERSONNELS PAR PLATEFORME --------------------
const SCAN_SCRIPTS = {
  linkedin: `(async function(){
    const posts = [];
    const articles = document.querySelectorAll('div.feed-shared-update-v2, article.feed-shared-update-v2, div[data-urn*="urn:li:activity"]');
    articles.forEach(a => {
      const txt = (a.querySelector('.feed-shared-update-v2__description, .update-components-text')?.innerText || '').trim();
      const likes = parseInt((a.querySelector('.social-details-social-counts__reactions-count, [aria-label*="reaction"]')?.innerText || '0').replace(/\\D/g,'')) || 0;
      const comments = parseInt((a.querySelector('.social-details-social-counts__comments, [aria-label*="comment"]')?.innerText || '0').replace(/\\D/g,'')) || 0;
      const link = a.querySelector('a[href*="/feed/update/"]')?.href || '';
      const date = a.querySelector('.update-components-actor__sub-description, time')?.innerText?.trim() || '';
      if (txt) posts.push({ text: txt.slice(0, 300), likes, comments, shares: 0, views: 0, link, date });
    });
    return posts.slice(0, 30);
  })();`,
  twitter: `(async function(){
    const posts = [];
    document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
      const txt = (a.querySelector('[data-testid="tweetText"]')?.innerText || '').trim();
      const link = a.querySelector('a[href*="/status/"]')?.href || '';
      const date = a.querySelector('time')?.getAttribute('datetime') || '';
      let likes=0, comments=0, retweets=0, views=0;
      a.querySelectorAll('[data-testid="reply"] span, [data-testid="retweet"] span, [data-testid="like"] span, a[href$="/analytics"] span').forEach((el, i) => {
        const n = parseInt((el.innerText || '0').replace(/\\D/g, '')) || 0;
        if (i===0) comments=n; else if (i===1) retweets=n; else if (i===2) likes=n; else if (i===3) views=n;
      });
      if (txt) posts.push({ text: txt.slice(0, 300), likes, comments, shares: retweets, views, link, date });
    });
    return posts.slice(0, 30);
  })();`,
  facebook: `(async function(){
    const posts = [];
    document.querySelectorAll('div[role="article"]').forEach(a => {
      const txt = (a.querySelector('div[data-ad-preview="message"], div[dir="auto"]')?.innerText || '').trim();
      const reactions = parseInt((a.querySelector('span[aria-label*="reaction"], span[aria-label*="J\\'aime"]')?.innerText || '0').replace(/\\D/g,'')) || 0;
      const link = a.querySelector('a[href*="/posts/"], a[href*="/permalink/"]')?.href || '';
      const date = a.querySelector('a[role="link"] span')?.innerText || '';
      if (txt && txt.length > 10) posts.push({ text: txt.slice(0, 300), likes: reactions, comments: 0, shares: 0, views: 0, link, date });
    });
    return posts.slice(0, 30);
  })();`,
  instagram: `(async function(){
    const posts = [];
    document.querySelectorAll('article a[href*="/p/"], a[href*="/p/"]').forEach(a => {
      const link = a.href;
      const img = a.querySelector('img');
      const alt = img?.alt || '';
      if (link && !posts.find(p => p.link === link)) {
        posts.push({ text: alt.slice(0, 300), likes: 0, comments: 0, shares: 0, views: 0, link, date: '' });
      }
    });
    return posts.slice(0, 30);
  })();`,
  tiktok: `(async function(){
    const posts = [];
    document.querySelectorAll('div[data-e2e="user-post-item"]').forEach(a => {
      const link = a.querySelector('a')?.href || '';
      const views = parseInt((a.querySelector('[data-e2e="video-views"]')?.innerText || '0').replace(/\\D/g,'')) || 0;
      const desc = a.querySelector('img')?.alt || '';
      if (link) posts.push({ text: desc.slice(0, 300), likes: 0, comments: 0, shares: 0, views, link, date: '' });
    });
    return posts.slice(0, 30);
  })();`,
  threads: `(async function(){
    const posts = [];
    document.querySelectorAll('div[data-pressable-container]').forEach(a => {
      const txt = (a.querySelector('span[dir]')?.innerText || '').trim();
      const link = a.querySelector('a[href*="/post/"]')?.href || '';
      if (txt) posts.push({ text: txt.slice(0, 300), likes: 0, comments: 0, shares: 0, views: 0, link, date: '' });
    });
    return posts.slice(0, 30);
  })();`,
  youtube: `(async function(){
    const posts = [];
    document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer').forEach(a => {
      const title = (a.querySelector('#video-title, h3 a')?.innerText || '').trim();
      const link = a.querySelector('a#video-title, a#thumbnail')?.href || '';
      const views = (a.querySelector('#metadata-line span:first-child')?.innerText || '');
      const date = (a.querySelector('#metadata-line span:nth-child(2)')?.innerText || '');
      const v = parseInt((views || '0').replace(/\\D/g,'')) || 0;
      if (title) posts.push({ text: title.slice(0, 300), likes: 0, comments: 0, shares: 0, views: v, link, date });
    });
    return posts.slice(0, 30);
  })();`,
}

ipcMain.handle('scan-platform-posts', async (event, { platform, profileUrl }) => {
  if (!SCAN_SCRIPTS[platform]) {
    return { success: false, error: 'Plateforme non supportee', posts: [] }
  }
  if (!profileUrl) {
    return { success: false, error: 'URL de profil manquante', posts: [] }
  }

  let finalUrl = profileUrl
  if (platform === 'youtube' && !finalUrl.includes('/videos') && !finalUrl.includes('/shorts') && !finalUrl.includes('/streams')) {
    finalUrl = finalUrl.replace(/\/$/, '') + '/videos'
  }

  if (scanWindow && !scanWindow.isDestroyed()) {
    scanWindow.close()
    scanWindow = null
  }

  scanWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: `Scan ${platform} - Pilotage`,
    backgroundColor: '#0D1B2A',
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      webSecurity: false,
      partition: `persist:pilotage_${platform}`,
    },
  })

  attachContextMenu(scanWindow)

  return new Promise((resolve) => {
    let resolved = false
    const finish = (result) => {
      if (resolved) return
      resolved = true
      setTimeout(() => {
        if (scanWindow && !scanWindow.isDestroyed()) {
          try { scanWindow.close() } catch (e) {}
        }
      }, 800)
      resolve(result)
    }

    scanWindow.on('closed', () => {
      scanWindow = null
      finish({ success: false, error: 'Fenetre fermee avant scan', posts: [] })
    })

    scanWindow.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 4500))
      try {
        await scanWindow.webContents.executeJavaScript(`
          (async function(){
            for (let i = 0; i < 5; i++) {
              window.scrollTo(0, document.body.scrollHeight);
              await new Promise(r => setTimeout(r, 1200));
            }
            window.scrollTo(0, 0);
          })();
        `)
      } catch (e) { /* ignore */ }

      try {
        const posts = await scanWindow.webContents.executeJavaScript(SCAN_SCRIPTS[platform])
        finish({ success: true, posts: posts || [], scanned_at: new Date().toISOString() })
      } catch (e) {
        finish({ success: false, error: String(e), posts: [] })
      }
    })

    scanWindow.loadURL(finalUrl, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }).catch(e => finish({ success: false, error: String(e), posts: [] }))
  })
})

// -- PHASE 7B - YOUTUBE DATA API v3 -------------------------------------
async function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url })
    let data = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString() })
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(data) })
        } catch (e) {
          resolve({ status: response.statusCode, body: { raw: data } })
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

async function resolveChannelId(input, apiKey) {
  if (/^UC[\w-]{22}$/.test(input)) return input

  let handle = null
  let username = null
  const m1 = input.match(/youtube\.com\/(channel\/)(UC[\w-]{22})/)
  if (m1) return m1[2]
  const m2 = input.match(/youtube\.com\/@([\w.-]+)/)
  if (m2) handle = m2[1]
  const m3 = input.match(/youtube\.com\/(c|user)\/([\w.-]+)/)
  if (m3) username = m3[2]
  if (!handle && !username) {
    if (input.startsWith('@')) handle = input.slice(1)
    else handle = input
  }

  const q = handle || username
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(q)}&maxResults=1&key=${apiKey}`
  const res = await httpsGetJson(searchUrl)
  if (res.status === 200 && res.body.items?.length) {
    return res.body.items[0].snippet.channelId || res.body.items[0].id?.channelId
  }
  throw new Error('Chaine introuvable : ' + input)
}

async function fetchChannelData(input, apiKey) {
  const channelId = await resolveChannelId(input, apiKey)

  const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`
  const chRes = await httpsGetJson(chUrl)
  if (chRes.status !== 200 || !chRes.body.items?.length) {
    throw new Error('Chaine non trouvee')
  }
  const channel = chRes.body.items[0]
  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads

  let videos = []
  if (uploadsId) {
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50&key=${apiKey}`
    const plRes = await httpsGetJson(plUrl)
    const videoIds = (plRes.body.items || []).map(it => it.contentDetails?.videoId).filter(Boolean)

    if (videoIds.length) {
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
      const vRes = await httpsGetJson(vUrl)
      videos = (vRes.body.items || []).map(v => ({
        id: v.id,
        title: v.snippet?.title,
        published_at: v.snippet?.publishedAt,
        tags: v.snippet?.tags || [],
        views: parseInt(v.statistics?.viewCount) || 0,
        likes: parseInt(v.statistics?.likeCount) || 0,
        comments: parseInt(v.statistics?.commentCount) || 0,
        duration: v.contentDetails?.duration,
        thumbnail: v.snippet?.thumbnails?.medium?.url,
        link: `https://www.youtube.com/watch?v=${v.id}`,
      }))
    }
  }

  const last30 = videos.filter(v => {
    const d = new Date(v.published_at)
    return (Date.now() - d.getTime()) < 30 * 24 * 3600 * 1000
  })
  const avgViews30 = last30.length ? Math.round(last30.reduce((s, v) => s + v.views, 0) / last30.length) : 0

  const tagCount = {}
  videos.forEach(v => (v.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 }))
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, c]) => ({ tag: t, count: c }))

  const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5)

  return {
    channel: {
      id: channelId,
      title: channel.snippet?.title,
      description: channel.snippet?.description,
      thumbnail: channel.snippet?.thumbnails?.medium?.url,
      subscribers: parseInt(channel.statistics?.subscriberCount) || 0,
      total_views: parseInt(channel.statistics?.viewCount) || 0,
      total_videos: parseInt(channel.statistics?.videoCount) || 0,
      published_at: channel.snippet?.publishedAt,
    },
    stats: {
      avg_views_last_30d: avgViews30,
      videos_last_30d: last30.length,
      top_videos: topVideos,
      top_tags: topTags,
    },
    videos,
  }
}

ipcMain.handle('youtube-channel-stats', async (event, { input, apiKey }) => {
  if (!apiKey) return { success: false, error: 'Cle API manquante' }
  try {
    const data = await fetchChannelData(input, apiKey)
    return { success: true, ...data }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// -- PHASE 7B - YOUTUBE OVERLAY (via preload script) --------------------
ipcMain.handle('youtube-overlay', async (event, { channelUrl, apiKey }) => {
  if (!apiKey) return { success: false, error: 'Cle API YouTube manquante' }

  let data
  try {
    data = await fetchChannelData(channelUrl, apiKey)
  } catch (e) {
    return { success: false, error: String(e) }
  }

  // Stocke les donnees pour que le preload script puisse les recuperer
  overlayData = { stats: data.stats, channel: data.channel }

  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()

  overlayWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Veille YouTube - Pilotage',
    backgroundColor: '#0D1B2A',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      partition: 'persist:pilotage_youtube',
      preload: path.join(__dirname, 'youtube-overlay-preload.cjs'),
    },
  })

  attachContextMenu(overlayWindow)
  overlayWindow.on('closed', () => { overlayWindow = null })

  await overlayWindow.loadURL(channelUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  })

  return { success: true }
})

// ═══════════════════════════════════════════════════════════════════════════
// STUD'IA IMAGES - GPT IMAGE 1 (OpenAI) - Pattern adapte de GeoWorld V3.1
// ═══════════════════════════════════════════════════════════════════════════
//
// 2 modes :
//  - generate : prompt seul (texte -> image)            ~$0.04 / image (1024x1024)
//  - edit     : photo + prompt (img2img)                ~$0.06 / image (1024x1024)
//
// Stockage local :
//  - openai-config.json  : cle API utilisateur (BYOK)
//  - studia-usage.json   : compteur cumule + historique
//  - studia-images/      : fichiers PNG generes
//
// La cle API ne transite jamais par un serveur Doppler.
// ═══════════════════════════════════════════════════════════════════════════

const USER_DATA_DIR = app.getPath('userData')
const OPENAI_KEY_FILE = path.join(USER_DATA_DIR, 'openai-config.json')
const STUDIA_USAGE_FILE = path.join(USER_DATA_DIR, 'studia-usage.json')
const STUDIA_IMAGES_DIR = path.join(USER_DATA_DIR, 'studia-images')

try { if (!fs.existsSync(STUDIA_IMAGES_DIR)) fs.mkdirSync(STUDIA_IMAGES_DIR, { recursive: true }) } catch {}

function loadOpenAIConfig() {
  if (fs.existsSync(OPENAI_KEY_FILE)) {
    try { return JSON.parse(fs.readFileSync(OPENAI_KEY_FILE, 'utf8')) }
    catch { return {} }
  }
  return {}
}

function saveOpenAIConfig(config) {
  fs.writeFileSync(OPENAI_KEY_FILE, JSON.stringify(config, null, 2), 'utf8')
}

function loadStudiaUsage() {
  if (fs.existsSync(STUDIA_USAGE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STUDIA_USAGE_FILE, 'utf8')) }
    catch { return { totalSpent: 0, generations: [] } }
  }
  return { totalSpent: 0, generations: [] }
}

function saveStudiaUsage(usage) {
  fs.writeFileSync(STUDIA_USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8')
}

// Helper : telechargement HTTP avec User-Agent et suivi des redirections
function fetchWithRedirects(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsedUrl
    try { parsedUrl = new URL(url) } catch (e) {
      return reject(new Error('URL invalide: ' + url))
    }
    const protocol = parsedUrl.protocol === 'https:' ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Pilot-Doppler/1.0',
        'Accept': 'image/*,*/*'
      }
    }

    const req = protocol.request(options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        let nextUrl = res.headers.location
        if (nextUrl.startsWith('/')) {
          nextUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${nextUrl}`
        }
        return fetchWithRedirects(nextUrl, redirectsLeft - 1).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} sur ${parsedUrl.hostname}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.end()
  })
}

// Verifier si la cle API est configuree
ipcMain.handle('studia:hasOpenAIKey', async () => {
  const cfg = loadOpenAIConfig()
  return !!cfg.apiKey
})

// Stocker la cle API
ipcMain.handle('studia:setOpenAIKey', async (event, apiKey) => {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
    return { success: false, error: 'Cle invalide (doit commencer par sk-)' }
  }
  const cfg = loadOpenAIConfig()
  cfg.apiKey = apiKey.trim()
  cfg.savedAt = new Date().toISOString()
  saveOpenAIConfig(cfg)
  return { success: true }
})

// Supprimer la cle
ipcMain.handle('studia:clearOpenAIKey', async () => {
  saveOpenAIConfig({})
  return { success: true }
})

// Recuperer les stats d'usage cumulees
ipcMain.handle('studia:getUsage', async () => loadStudiaUsage())

// Reinitialiser le compteur d'usage
ipcMain.handle('studia:resetUsage', async () => {
  saveStudiaUsage({ totalSpent: 0, generations: [] })
  return { success: true }
})

// Generer une image GPT (txt2img ou img2img)
// Params attendus :
//   { projectId, prompt, mode, photoDataUrl?, size? }
//   - mode = 'generate' (txt2img) ou 'edit' (img2img)
//   - photoDataUrl : data URL base64 si mode='edit' (uploaded depuis le renderer)
//   - size : '1024x1024' (defaut), '1536x1024' (paysage), '1024x1536' (portrait)
ipcMain.handle('studia:generateImage', async (event, params) => {
  const cfg = loadOpenAIConfig()
  if (!cfg.apiKey) {
    return { success: false, error: 'Cle API OpenAI non configuree' }
  }

  const {
    projectId = 'default',
    prompt,
    mode = 'generate',
    photoDataUrl = null,
    size = '1024x1024'
  } = params || {}

  if (!prompt || typeof prompt !== 'string') {
    return { success: false, error: 'Prompt manquant' }
  }

  try {
    let resultBuffer = null
    let cost = 0

    if (mode === 'edit' && photoDataUrl) {
      // ---- Mode IMG2IMG : POST /v1/images/edits (multipart) ----

      // Decoder le dataURL recu du renderer
      const m = photoDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!m) return { success: false, error: 'Format image invalide (attendu : data:image/...;base64,...)' }
      const mimeType = m[1]
      const imgBuffer = Buffer.from(m[2], 'base64')

      // Determiner extension/filename (OpenAI accepte png, jpg, webp)
      const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }
      const ext = extMap[mimeType] || 'png'

      // Construction multipart manuelle (pas de dependance externe)
      const boundary = '----PilotFormBoundary' + Date.now().toString(16)
      const CRLF = '\r\n'

      function partText(name, value) {
        return Buffer.from(
          `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
          `${value}${CRLF}`,
          'utf8'
        )
      }

      function partFile(name, filename, contentType, buf) {
        return Buffer.concat([
          Buffer.from(
            `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}` +
            `Content-Type: ${contentType}${CRLF}${CRLF}`,
            'utf8'
          ),
          buf,
          Buffer.from(CRLF, 'utf8')
        ])
      }

      const bodyParts = [
        partText('model', 'gpt-image-1'),
        partFile('image', `ref.${ext}`, mimeType, imgBuffer),
        partText('prompt', prompt),
        partText('size', size),
        partText('n', '1'),
        Buffer.from(`--${boundary}--${CRLF}`, 'utf8')
      ]
      const bodyBuf = Buffer.concat(bodyParts)

      const apiResp = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.openai.com',
          path: '/v1/images/edits',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyBuf.length
          },
          timeout: 120000
        }, (res) => {
          const chunks = []
          res.on('data', c => chunks.push(c))
          res.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString())
              if (res.statusCode !== 200) {
                reject(new Error(data.error?.message || `HTTP ${res.statusCode}`))
              } else {
                resolve(data)
              }
            } catch (e) {
              reject(new Error('Reponse JSON invalide'))
            }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout OpenAI (120s)')) })
        req.write(bodyBuf)
        req.end()
      })

      const imgData = apiResp.data?.[0]
      if (!imgData) throw new Error("Pas d'image dans la reponse")

      if (imgData.b64_json) {
        resultBuffer = Buffer.from(imgData.b64_json, 'base64')
      } else if (imgData.url) {
        resultBuffer = await fetchWithRedirects(imgData.url)
      } else {
        throw new Error('Format de reponse OpenAI inconnu')
      }

      cost = 0.06

    } else {
      // ---- Mode TXT2IMG : POST /v1/images/generations ----

      const body = JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size,
        n: 1
      })

      const apiResp = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.openai.com',
          path: '/v1/images/generations',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          },
          timeout: 120000
        }, (res) => {
          const chunks = []
          res.on('data', c => chunks.push(c))
          res.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString())
              if (res.statusCode !== 200) {
                reject(new Error(data.error?.message || `HTTP ${res.statusCode}`))
              } else {
                resolve(data)
              }
            } catch (e) {
              reject(new Error('Reponse JSON invalide'))
            }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout OpenAI (120s)')) })
        req.write(body)
        req.end()
      })

      const imgData = apiResp.data?.[0]
      if (!imgData) throw new Error("Pas d'image dans la reponse")

      if (imgData.b64_json) {
        resultBuffer = Buffer.from(imgData.b64_json, 'base64')
      } else if (imgData.url) {
        resultBuffer = await fetchWithRedirects(imgData.url)
      } else {
        throw new Error('Format de reponse OpenAI inconnu')
      }

      cost = 0.04
    }

    // Sauvegarder localement
    const filename = `${projectId}-${mode}-${Date.now()}.png`
    const filepath = path.join(STUDIA_IMAGES_DIR, filename)
    fs.writeFileSync(filepath, resultBuffer)
    const fileUrl = `file://${filepath.replace(/\\/g, '/')}`
    const dataUrl = `data:image/png;base64,${resultBuffer.toString('base64')}`

    // Mettre a jour les stats d'usage
    const usage = loadStudiaUsage()
    usage.totalSpent = (usage.totalSpent || 0) + cost
    usage.generations = usage.generations || []
    usage.generations.unshift({
      projectId,
      mode,
      cost,
      prompt: prompt.slice(0, 200),
      filename,
      fileUrl,
      timestamp: new Date().toISOString()
    })
    if (usage.generations.length > 500) usage.generations = usage.generations.slice(0, 500)
    saveStudiaUsage(usage)

    return {
      success: true,
      fileUrl,
      dataUrl,
      filename,
      filepath,
      cost,
      totalSpent: usage.totalSpent,
      mode
    }

  } catch (err) {
    console.error('[studia:generateImage] erreur:', err)
    return { success: false, error: err.message || String(err) }
  }
})

// Telecharger une image generee vers un emplacement choisi par l'utilisateur
ipcMain.handle('studia:exportImage', async (event, params) => {
  const { sourceFileUrl, suggestedName } = params || {}
  if (!sourceFileUrl) return { success: false, error: 'sourceFileUrl manquant' }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exporter l'image",
    defaultPath: suggestedName || `pilot-image-${Date.now()}.png`,
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }

  try {
    if (sourceFileUrl.startsWith('file://')) {
      const localPath = sourceFileUrl.replace(/^file:\/\//, '')
      fs.copyFileSync(localPath, result.filePath)
      return { success: true, path: result.filePath }
    }
    return { success: false, error: 'URL non supportee (file:// requis)' }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Ouvrir le dossier studia-images dans l'explorateur
ipcMain.handle('studia:revealImagesFolder', async () => {
  shell.openPath(STUDIA_IMAGES_DIR)
  return { success: true, path: STUDIA_IMAGES_DIR }
})
// Ouvrir une image generee avec l'application par defaut Windows
ipcMain.handle('studia:openImage', async (event, fileUrl) => {
  if (!fileUrl?.startsWith('file://')) return { success: false, error: 'URL invalide' }
  try {
    const localPath = fileUrl.replace(/^file:\/\//, '')
    if (!fs.existsSync(localPath)) return { success: false, error: 'Fichier introuvable' }
    await shell.openPath(localPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
// Supprimer une image generee
ipcMain.handle('studia:deleteImage', async (event, fileUrl) => {
  if (!fileUrl?.startsWith('file://')) return { success: false, error: 'URL invalide' }
  try {
    const localPath = fileUrl.replace(/^file:\/\//, '')
    if (localPath.startsWith(STUDIA_IMAGES_DIR) && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath)
    }
    // Retirer aussi de l'historique
    const usage = loadStudiaUsage()
    usage.generations = (usage.generations || []).filter(g => g.fileUrl !== fileUrl)
    saveStudiaUsage(usage)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─────────────────────────────────────────────────────────────
// HANDLER GENERIQUE BYOK OpenAI
// Params : { systemPrompt, userPrompt, modele?, temperature?, maxTokens?, jsonMode? }
// Retour : { success, content, usage?, cost_eur?, error? }
// ─────────────────────────────────────────────────────────────
ipcMain.handle('studia:callOpenAI', async (event, params) => {
  const cfg = loadOpenAIConfig()
  if (!cfg.apiKey) {
    return { success: false, error: 'Cle API OpenAI non configuree' }
  }

  const {
    systemPrompt = 'Tu es un assistant utile.',
    userPrompt,
    modele = 'gpt-4o',
    temperature = 0.3,
    maxTokens = 4000,
    jsonMode = false,
  } = params || {}

  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.length < 5) {
    return { success: false, error: 'userPrompt manquant ou trop court' }
  }

  // Securite contexte
  const userTrunc = userPrompt.slice(0, 120000)

  const bodyObj = {
    model: modele,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userTrunc },
    ],
    temperature,
    max_tokens: maxTokens,
  }
  if (jsonMode) bodyObj.response_format = { type: 'json_object' }

  const body = JSON.stringify(bodyObj)

  try {
    const apiResp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.apiKey}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 120000,
      }, (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString())
            if (res.statusCode !== 200) {
              reject(new Error(data.error?.message || `HTTP ${res.statusCode}`))
            } else {
              resolve(data)
            }
          } catch (e) {
            reject(new Error('Reponse JSON invalide OpenAI'))
          }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout OpenAI (120s)')) })
      req.write(body)
      req.end()
    })

    const content = apiResp.choices?.[0]?.message?.content || ''
    const usage = apiResp.usage || {}

    // Calcul cout EUR (gpt-4o : 2.50$/1M input, 10$/1M output, 1 EUR ~ 1.08$)
    const inputTokens  = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0
    const costUSD = (inputTokens * 2.5 / 1_000_000) + (outputTokens * 10 / 1_000_000)
    const costEUR = costUSD / 1.08

    // Maj compteur conso si la fonction existe
    if (typeof updateOpenAIConsumption === 'function') {
      try { updateOpenAIConsumption(costEUR) } catch (e) {}
    }

    return {
      success: true,
      content,
      usage,
      cost_eur: costEUR,
      cost_usd: costUSD,
      modele,
    }
  } catch (err) {
    console.error('[studia:callOpenAI] Erreur:', err.message)
    return { success: false, error: err.message }
  }
})
// Analyser un transcript YouTube via GPT-4o (BYOK pur, cle ne transite pas par VPS)
// Params attendus :
//   { texte, titre?, auteur?, modele? }
ipcMain.handle('studia:analyzeTranscript', async (event, params) => {
  const cfg = loadOpenAIConfig()
  if (!cfg.apiKey) {
    return { success: false, error: 'Cle API OpenAI non configuree' }
  }

  const {
    texte,
    titre = null,
    auteur = null,
    modele = 'gpt-4o'
  } = params || {}

  if (!texte || typeof texte !== 'string' || texte.length < 50) {
    return { success: false, error: 'Texte trop court (minimum 50 caracteres)' }
  }

  // Limite contexte GPT-4o : ~128k tokens. On limite a 120k chars pour rester safe.
  let texteAnalyse = texte.slice(0, 120000)
  if (texte.length > 120000) {
    texteAnalyse += `\n\n[Transcript tronque pour analyse, longueur originale : ${texte.length} chars]`
  }

  let contexte = ''
  if (titre)  contexte += `Titre video : ${titre}\n`
  if (auteur) contexte += `Chaine YouTube : ${auteur}\n`
  if (contexte) contexte = 'Contexte :\n' + contexte + '\n'

  const systemPrompt = `Tu es un analyste expert de contenus video. Tu vas analyser un transcript YouTube et produire une analyse structuree au format JSON strict.

Tu dois retourner UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte autour) avec cette structure exacte :

{
  "resume_court": "Resume en 2-3 phrases maximum, factuel et synthetique.",
  "resume_detaille": "Resume en 1 paragraphe (5-8 phrases) couvrant les points principaux.",
  "chapitres": [
    {
      "titre": "Titre court du chapitre",
      "debut_approximatif": "12:35 ou null si tu ne peux pas estimer",
      "description_courte": "1-2 phrases sur ce chapitre"
    }
  ],
  "themes": ["theme1", "theme2", "theme3"],
  "sentiment": "positif|neutre|negatif|mixte",
  "sentiment_description": "Explication courte du sentiment general",
  "citations_marquantes": ["Citation impactante 1", "Citation impactante 2"]
}

Regles :
- 3 a 6 chapitres maximum, en francais
- 5 a 10 themes (mots-cles courts)
- 3 a 5 citations marquantes maximum, courtes (max 25 mots), reprises QUASI VERBATIM du transcript
- Sois factuel, ne pas inventer ce qui n'est pas dans le transcript
- Reponds en FRANCAIS quelle que soit la langue du transcript`

  const userPrompt = `${contexte}Transcript a analyser :\n\n${texteAnalyse}\n\nProduis ton analyse au format JSON strict comme demande dans le system prompt.`

  const body = JSON.stringify({
    model: modele,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  try {
    const apiResp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.apiKey}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 120000,
      }, (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString())
            if (res.statusCode !== 200) {
              reject(new Error(data.error?.message || `HTTP ${res.statusCode}`))
            } else {
              resolve(data)
            }
          } catch (e) {
            reject(new Error('Reponse JSON invalide'))
          }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout OpenAI (120s)')) })
      req.write(body)
      req.end()
    })

    const rawContent = apiResp.choices?.[0]?.message?.content
    if (!rawContent) {
      return { success: false, error: 'Reponse OpenAI vide' }
    }

    let analyse
    try {
      analyse = JSON.parse(rawContent)
    } catch (e) {
      return { success: false, error: 'Reponse GPT mal formee (JSON invalide)' }
    }

    // Calcul cout (gpt-4o : 2.5$ in, 10$ out / 1M tokens)
    const tokensIn  = apiResp.usage?.prompt_tokens     || 0
    const tokensOut = apiResp.usage?.completion_tokens || 0
    const tokensTotal = tokensIn + tokensOut
    const coutUsd = (tokensIn / 1_000_000) * 2.5 + (tokensOut / 1_000_000) * 10.0
    const coutEur = Math.round(coutUsd * 0.93 * 10000) / 10000  // 4 decimales

    // Mettre a jour les stats d'usage cumulees (meme compteur que les images)
    const usage = loadStudiaUsage()
    usage.totalSpent = (usage.totalSpent || 0) + coutUsd
    usage.generations = usage.generations || []
    usage.generations.unshift({
      type: 'transcript_analysis',
      cost: coutUsd,
      tokens: tokensTotal,
      modele,
      timestamp: new Date().toISOString(),
    })
    if (usage.generations.length > 500) usage.generations = usage.generations.slice(0, 500)
    saveStudiaUsage(usage)

    return {
      success: true,
      resume_court:          analyse.resume_court          || '',
      resume_detaille:       analyse.resume_detaille       || '',
      chapitres:             analyse.chapitres             || [],
      themes:                analyse.themes                || [],
      sentiment:             analyse.sentiment             || 'neutre',
      sentiment_description: analyse.sentiment_description || '',
      citations_marquantes:  analyse.citations_marquantes  || [],
      nb_tokens_utilises:    tokensTotal,
      cout_estime_eur:       coutEur,
      cout_usd:              coutUsd,
      totalSpent:            usage.totalSpent,
    }

  } catch (err) {
    console.error('[studia:analyzeTranscript] erreur:', err)
    return { success: false, error: err.message || String(err) }
  }
})
// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE OAUTH (Phase 4c) - BYOK pure
// ═══════════════════════════════════════════════════════════════════════════
//
// Tokens stockes dans userData/google-oauth.json (jamais sur VPS Doppler).
// Le client_secret JSON Google est dans userData/google-client-secret.json.
//
// Workflow utilisateur :
//  1. drive:isConfigured  -> verifie que google-client-secret.json existe
//  2. drive:isConnected   -> verifie qu'un token utilisateur est present
//  3. drive:startOAuthFlow -> lance le flow OAuth loopback (1er login)
//  4. drive:uploadFile    -> upload un fichier dans Drive sous Pilot/{projectId}/...
//  5. drive:disconnect    -> revoque le token et supprime le fichier
//
// Toute la logique est dans drive.cjs.
// ═══════════════════════════════════════════════════════════════════════════

ipcMain.handle('drive:isConfigured', async () => {
  return driveModule.isConfigured()
})

ipcMain.handle('drive:isConnected', async () => {
  return driveModule.isConnected()
})

ipcMain.handle('drive:getConnectedAccount', async () => {
  return await driveModule.getConnectedAccount()
})

ipcMain.handle('drive:saveClientSecret', async (event, jsonContent) => {
  return driveModule.saveClientSecret(jsonContent)
})

ipcMain.handle('drive:startOAuthFlow', async () => {
  return await driveModule.startOAuthFlow()
})

ipcMain.handle('drive:disconnect', async () => {
  return await driveModule.disconnect()
})

ipcMain.handle('drive:uploadFile', async (event, args) => {
  return await driveModule.uploadFile(args)
})

// -- LIFECYCLE -----------------------------------------------------------
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })

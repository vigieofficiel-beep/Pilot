const { app, BrowserWindow, ipcMain, session, net } = require('electron')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')

let mainWindow
let browserWindows = {}
let searchWindow = null
let scanWindow = null
let overlayWindow = null
let overlayData = null  // Stocke les donnees pour le preload

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

  overlayWindow.on('closed', () => { overlayWindow = null })

  await overlayWindow.loadURL(channelUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  })

  return { success: true }
})

// -- LIFECYCLE -----------------------------------------------------------
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })

const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')

let mainWindow
let browserWindows = {}
let searchWindow = null  // Fenêtre dédiée à la recherche manuelle

// ── SYSTÈME LICENCE ───────────────────────────────────────────────
const LICENCE_FILE = path.join(app.getPath('userData'), 'licence.json')
const LICENCE_SALT = 'pilotage-syon-2025-lucien'

function hashCode(code) {
  return crypto.createHmac('sha256', LICENCE_SALT).update(code.trim().toUpperCase()).digest('hex')
}

// Codes valides — tu peux en ajouter autant que tu veux
// Format : PLTG-XXXX-XXXX-XXXX
const VALID_HASHES = [
  hashCode('PLTG-DEV0-0000-0001'), // Code développeur (toi)
  hashCode('PLTG-DEV0-0000-0002'), // Code test
  hashCode('PLTG-EARL-Y001-2025'), // Early adopter 1
  hashCode('PLTG-EARL-Y002-2025'), // Early adopter 2
  hashCode('PLTG-EARL-Y003-2025'), // Early adopter 3
  hashCode('PLTG-EARL-Y004-2025'), // Early adopter 4
  hashCode('PLTG-EARL-Y005-2025'), // Early adopter 5
  hashCode('PLTG-AGCE-A001-2025'), // Licence agence 1
  hashCode('PLTG-AGCE-A002-2025'), // Licence agence 2
  hashCode('PLTG-FREE-DEMO-2025'), // Code démo gratuit
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
      code: code.substring(0, 4) + '-****-****-' + code.slice(-4), // masqué
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

// IPC Licence
ipcMain.handle('check-licence', () => isLicenceActive())
ipcMain.handle('activate-licence', (_, code) => activateLicence(code))
ipcMain.handle('get-licence-info', () => getLicenceInfo())

// ── FENÊTRE PRINCIPALE ────────────────────────────────────────────
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

// ── INJECTION NAVIGATEUR AVEC SESSION PERSISTANTE ─────────────────
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
    title: `Publier sur ${platform} — Pilotage`,
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
    facebook: `(function(){const btn=document.querySelector('[aria-label="Créer une publication"],[data-testid="status-attachment-mentions-input"]');if(btn)btn.click();setTimeout(()=>{const ed=document.querySelector('[contenteditable="true"][role="textbox"],[data-lexical-editor="true"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}},1800)})();`,
    discord:  `(function(){const ed=document.querySelector('[data-slate-editor="true"],[role="textbox"][contenteditable="true"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
    twitter:  `(function(){const ed=document.querySelector('[data-testid="tweetTextarea_0"],[contenteditable="true"][role="textbox"]');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
    youtube:  `(function(){const ed=document.querySelector('#description-textarea,ytcp-mention-textbox [contenteditable="true"],textarea[aria-label]');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    instagram:`(function(){const ed=document.querySelector('textarea[aria-label],[contenteditable="true"]');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(ed,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    tiktok:   `(function(){const ed=document.querySelector('[contenteditable="true"],textarea');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`,
    threads:  `(function(){const ed=document.querySelector('[contenteditable="true"][role="textbox"],textarea');if(ed){ed.focus();document.execCommand('insertText',false,${escaped});ed.dispatchEvent(new Event('input',{bubbles:true}))}})();`,
  }
  return scripts[platform] || `(function(){const ed=document.querySelector('[contenteditable="true"],textarea');if(ed){ed.focus();if(ed.tagName==='TEXTAREA'){ed.value=${escaped};ed.dispatchEvent(new Event('input',{bubbles:true}))}else{document.execCommand('insertText',false,${escaped})}}})();`
}

// ── FENÊTRE DE RECHERCHE MANUELLE (enrichissement prospects) ──────
ipcMain.handle('open-search-window', async (event, { url, prospectId }) => {
  // Si une fenêtre de recherche existe déjà, on la réutilise
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
    title: 'Recherche prospect — Pilotage',
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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })

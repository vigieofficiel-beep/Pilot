/**
 * drive.cjs — Module Google Drive OAuth pour Pilot Electron
 *
 * Architecture BYOK pure : aucun token ne transite par le VPS Doppler.
 * Le client_secret JSON et les tokens utilisateur sont stockes uniquement
 * dans userData/ d'Electron (chiffrement OS-level via dossier protege).
 *
 * Flow OAuth utilise : Loopback IP (Desktop App)
 *   1. Pilot lance un serveur HTTP local sur un port aleatoire (ex: 51234)
 *   2. Pilot ouvre le navigateur sur l'URL d'autorisation Google
 *   3. L'utilisateur autorise -> Google redirige vers http://localhost:51234/?code=XXX
 *   4. Notre serveur capture le code, l'echange contre access_token + refresh_token
 *   5. Tokens stockes localement, refresh automatique a chaque appel
 */

const fs = require('fs')
const path = require('path')
const http = require('http')
const url = require('url')
const { google } = require('googleapis')
const { app, shell } = require('electron')

// ============================================
// CHEMINS DES FICHIERS DE CONFIG
// ============================================

function getClientSecretPath() {
  return path.join(app.getPath('userData'), 'google-client-secret.json')
}

function getTokensPath() {
  return path.join(app.getPath('userData'), 'google-oauth.json')
}

// ============================================
// CHARGEMENT DU CLIENT SECRET
// ============================================

function loadClientSecret() {
  const filePath = getClientSecretPath()
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const cfg = parsed.installed || parsed.web || null
    if (!cfg || !cfg.client_id || !cfg.client_secret) return null
    return cfg
  } catch (err) {
    console.error('[drive] Erreur lecture client_secret:', err)
    return null
  }
}

function isConfigured() {
  return loadClientSecret() !== null
}

function saveClientSecret(jsonContent) {
  const filePath = getClientSecretPath()
  try {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent
    const cfg = parsed.installed || parsed.web
    if (!cfg || !cfg.client_id || !cfg.client_secret) {
      throw new Error('JSON invalide : structure "installed" attendue avec client_id et client_secret')
    }
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ============================================
// GESTION DES TOKENS
// ============================================

function loadTokens() {
  const filePath = getTokensPath()
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function saveTokens(tokens) {
  const filePath = getTokensPath()
  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8')
}

function clearTokens() {
  const filePath = getTokensPath()
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

function isConnected() {
  return loadTokens() !== null
}

// ============================================
// CREATION DU CLIENT OAUTH2
// ============================================

function createOAuth2Client(redirectUri = 'http://localhost') {
  const cfg = loadClientSecret()
  if (!cfg) throw new Error('Client secret Google non configure. Place le fichier dans userData/google-client-secret.json')
  const oauth2 = new google.auth.OAuth2(
    cfg.client_id,
    cfg.client_secret,
    redirectUri
  )
  const tokens = loadTokens()
  if (tokens) oauth2.setCredentials(tokens)
  // Auto-refresh : sauvegarde les nouveaux tokens quand ils sont renouveles
  oauth2.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    saveTokens(merged)
    console.log('[drive] Token refresh automatique sauvegarde')
  })
  return oauth2
}

// ============================================
// FLOW OAUTH LOOPBACK (1ER LOGIN)
// ============================================

async function startOAuthFlow() {
  return new Promise((resolve) => {
    const cfg = loadClientSecret()
    if (!cfg) {
      return resolve({ success: false, error: 'Client secret Google non configure' })
    }

    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = url.parse(req.url, true)
        const code = reqUrl.query.code
        const error = reqUrl.query.error

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#1a1d24;color:#EDE8DB"><h2>❌ Autorisation refusee</h2><p>${error}</p><p>Tu peux fermer cet onglet.</p></body></html>`)
          server.close()
          return resolve({ success: false, error: `Autorisation refusee : ${error}` })
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Code manquant')
          return
        }

        const port = server.address().port
        const oauth2 = new google.auth.OAuth2(
          cfg.client_id,
          cfg.client_secret,
          `http://localhost:${port}`
        )
        const { tokens } = await oauth2.getToken(code)
        saveTokens(tokens)

        oauth2.setCredentials(tokens)
        let email = null
        try {
          const oauth2Service = google.oauth2({ version: 'v2', auth: oauth2 })
          const userinfo = await oauth2Service.userinfo.get()
          email = userinfo.data.email
        } catch (e) {
          console.warn('[drive] Impossible de recuperer email user :', e.message)
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#1a1d24;color:#EDE8DB"><h2 style="color:#7F77DD">✅ Pilot connecte a Google Drive</h2><p>Compte : <strong>${email || 'inconnu'}</strong></p><p>Tu peux fermer cet onglet et revenir dans Pilot.</p></body></html>`)

        server.close()
        resolve({ success: true, email })
      } catch (err) {
        console.error('[drive] Erreur callback OAuth :', err)
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Erreur interne')
        server.close()
        resolve({ success: false, error: err.message })
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const oauth2 = new google.auth.OAuth2(
        cfg.client_id,
        cfg.client_secret,
        `http://localhost:${port}`
      )
      const authUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'],
      })
      console.log(`[drive] Serveur loopback sur port ${port}, ouverture navigateur...`)
      shell.openExternal(authUrl)
    })

    setTimeout(() => {
      try { server.close() } catch {}
      resolve({ success: false, error: 'Timeout : autorisation non recue dans les 5 minutes' })
    }, 5 * 60 * 1000)
  })
}

// ============================================
// DECONNEXION
// ============================================

async function disconnect() {
  const tokens = loadTokens()
  if (tokens && tokens.access_token) {
    try {
      const oauth2 = createOAuth2Client()
      await oauth2.revokeToken(tokens.access_token)
    } catch (err) {
      console.warn('[drive] Erreur revocation token :', err.message)
    }
  }
  clearTokens()
  return { success: true }
}

// ============================================
// API DRIVE - UPLOAD
// ============================================

async function ensureFolder(drive, name, parentId) {
  const safeParent = parentId || 'root'
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${safeParent}' in parents`,
    `trashed = false`,
  ].join(' and ')

  const list = await drive.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id
  }

  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined,
  }
  const created = await drive.files.create({
    requestBody: metadata,
    fields: 'id',
  })
  console.log(`[drive] Dossier cree : ${name} (id=${created.data.id})`)
  return created.data.id
}

async function resolveFolderPath(drive, pathArray) {
  let parentId = null
  for (const folderName of pathArray) {
    parentId = await ensureFolder(drive, folderName, parentId)
  }
  return parentId
}

async function uploadFile({ folderPath, filename, contentBase64, mimeType }) {
  try {
    if (!isConnected()) {
      return { success: false, error: 'Non connecte a Google Drive. Lance d\'abord la connexion.' }
    }
    const oauth2 = createOAuth2Client()
    const drive = google.drive({ version: 'v3', auth: oauth2 })

    const folderId = await resolveFolderPath(drive, folderPath)

    const buffer = Buffer.from(contentBase64, 'base64')
    const { Readable } = require('stream')
    const stream = Readable.from(buffer)

    const result = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, webViewLink, name',
    })

    console.log(`[drive] Upload OK : ${filename} (id=${result.data.id})`)
    return {
      success: true,
      fileId: result.data.id,
      webViewLink: result.data.webViewLink,
      filename: result.data.name,
    }
  } catch (err) {
    console.error('[drive] Erreur upload :', err)
    return { success: false, error: err.message }
  }
}

// ============================================
// INFO COMPTE CONNECTE
// ============================================

async function getConnectedAccount() {
  if (!isConnected()) return null
  try {
    const oauth2 = createOAuth2Client()
    const oauth2Service = google.oauth2({ version: 'v2', auth: oauth2 })
    const userinfo = await oauth2Service.userinfo.get()
    return { email: userinfo.data.email, name: userinfo.data.name }
  } catch (err) {
    console.error('[drive] Erreur getConnectedAccount :', err)
    return null
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  isConfigured,
  saveClientSecret,
  getClientSecretPath,
  isConnected,
  startOAuthFlow,
  disconnect,
  getConnectedAccount,
  uploadFile,
}

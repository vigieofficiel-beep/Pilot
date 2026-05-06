const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Publication reseaux sociaux
  publishPost: (platform, contenu) => ipcRenderer.invoke('publish-post', { platform, contenu }),
  // Systeme licence
  checkLicence:    ()     => ipcRenderer.invoke('check-licence'),
  activateLicence: (code) => ipcRenderer.invoke('activate-licence', code),
  getLicenceInfo:  ()     => ipcRenderer.invoke('get-licence-info'),
  // Recherche manuelle de prospects (enrichissement)
  openSearchWindow: (url, prospectId) => ipcRenderer.invoke('open-search-window', { url, prospectId }),
  // Phase 7B Engagement
  scanPlatformPosts:        (platform, profileUrl) => ipcRenderer.invoke('scan-platform-posts', { platform, profileUrl }),
  getYouTubeChannelStats:   (input, apiKey)        => ipcRenderer.invoke('youtube-channel-stats', { input, apiKey }),
  openYouTubeWithOverlay:   (channelUrl, apiKey)   => ipcRenderer.invoke('youtube-overlay', { channelUrl, apiKey }),
})
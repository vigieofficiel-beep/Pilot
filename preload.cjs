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

  // Stud'IA Images (GPT Image 1 OpenAI - BYOK)
  studia: {
    // Gestion cle API
    hasOpenAIKey:    ()       => ipcRenderer.invoke('studia:hasOpenAIKey'),
    setOpenAIKey:    (apiKey) => ipcRenderer.invoke('studia:setOpenAIKey', apiKey),
    clearOpenAIKey:  ()       => ipcRenderer.invoke('studia:clearOpenAIKey'),

    // Stats d'usage
    getUsage:    () => ipcRenderer.invoke('studia:getUsage'),
    resetUsage:  () => ipcRenderer.invoke('studia:resetUsage'),

    // Generation d'images
    // params = { projectId, prompt, mode: 'generate'|'edit', photoDataUrl?, size? }
    generateImage: (params) => ipcRenderer.invoke('studia:generateImage', params),

    // Gestion des images generees
    exportImage:         (params)   => ipcRenderer.invoke('studia:exportImage', params),
    deleteImage:         (fileUrl)  => ipcRenderer.invoke('studia:deleteImage', fileUrl),
    openImage:           (fileUrl)  => ipcRenderer.invoke('studia:openImage', fileUrl),
    revealImagesFolder:  ()         => ipcRenderer.invoke('studia:revealImagesFolder'),
  },
})

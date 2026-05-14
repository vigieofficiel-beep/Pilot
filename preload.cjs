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

    // Analyse de transcript YouTube via GPT-4o (BYOK)
    // params = { texte, titre?, auteur?, modele? }
    analyzeTranscript:   (params)   => ipcRenderer.invoke('studia:analyzeTranscript', params),
  },

  // Google Drive OAuth (BYOK pure - tokens stockes en local Electron)
  drive: {
    isConfigured:        ()        => ipcRenderer.invoke('drive:isConfigured'),
    isConnected:         ()        => ipcRenderer.invoke('drive:isConnected'),
    getConnectedAccount: ()        => ipcRenderer.invoke('drive:getConnectedAccount'),
    saveClientSecret:    (json)    => ipcRenderer.invoke('drive:saveClientSecret', json),
    startOAuthFlow:      ()        => ipcRenderer.invoke('drive:startOAuthFlow'),
    disconnect:          ()        => ipcRenderer.invoke('drive:disconnect'),
    // params = { folderPath: string[], filename: string, contentBase64: string, mimeType: string }
    uploadFile:          (params)  => ipcRenderer.invoke('drive:uploadFile', params),
  },
})

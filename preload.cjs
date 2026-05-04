const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Publication réseaux sociaux
  publishPost: (platform, contenu) => ipcRenderer.invoke('publish-post', { platform, contenu }),
  // Système licence
  checkLicence:    ()     => ipcRenderer.invoke('check-licence'),
  activateLicence: (code) => ipcRenderer.invoke('activate-licence', code),
  getLicenceInfo:  ()     => ipcRenderer.invoke('get-licence-info'),
  // Recherche manuelle de prospects (enrichissement)
  openSearchWindow: (url, prospectId) => ipcRenderer.invoke('open-search-window', { url, prospectId }),
})

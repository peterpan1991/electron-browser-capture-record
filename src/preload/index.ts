import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  onLoadingStatus: (callback: (status: { loading: boolean; progress: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      value: { loading: boolean; progress: number }
    ): void => callback(value)
    ipcRenderer.on('loading-status', handler)
    return () => ipcRenderer.removeListener('loading-status', handler)
  },

  capturePage: (id: number, savePath?: string) => ipcRenderer.invoke('capture-page', id, savePath),

  getSources: () => ipcRenderer.invoke('get-sources'),
  saveVideo: (data: { buffer: ArrayBuffer; mimeType: string; savePath?: string }) =>
    ipcRenderer.invoke('save-video', data),

  createTab: (id: number, url: string) => ipcRenderer.invoke('create-tab', id, url),
  switchTab: (id: number) => ipcRenderer.invoke('switch-tab', id),

  loadUrl: (id: number, url: string) => ipcRenderer.invoke('load-url', id, url),

  onUpdateTitle: (callback: (data: { id: number; title: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      value: { id: number; title: string }
    ): void => callback(value)
    ipcRenderer.on('update-tab-title', handler)
    return () => ipcRenderer.removeListener('update-tab-title', handler)
  },

  getTabUrl: (id: number) => ipcRenderer.invoke('get-tab-url', id),
  onUpdateUrl: (callback: (data: { id: number; url: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: { id: number; url: string }): void =>
      callback(value)
    ipcRenderer.on('update-tab-url', handler)
    return () => ipcRenderer.removeListener('update-tab-url', handler)
  },

  onNewTabRequest: (callback: (data: { url: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: { url: string }): void =>
      callback(value)
    ipcRenderer.on('new-tab-request', handler)
    return () => ipcRenderer.removeListener('new-tab-request', handler)
  },

  removeTab: (id: number) => ipcRenderer.invoke('remove-tab', id),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  packageFiles: (filePaths: string[], savePath: string) => ipcRenderer.invoke('package-files', filePaths, savePath),
  saveTask: (task: { name: string; savePath: string }) => ipcRenderer.invoke('save-task', task),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  deleteTask: (id: string) => ipcRenderer.invoke('delete-task', id),
  goBack: (id: number) => ipcRenderer.invoke('go-back', id),
  goForward: (id: number) => ipcRenderer.invoke('go-forward', id),
  refreshTab: (id: number) => ipcRenderer.invoke('refresh-tab', id),

  // API 相关方法
  apiLogin: (email: string, password: string) => ipcRenderer.invoke('api:login', email, password),
  apiLogout: () => ipcRenderer.invoke('api:logout'),
  apiGetUser: () => ipcRenderer.invoke('api:get-user'),
  apiGetUserInfo: () => ipcRenderer.invoke('api:get-user-info'),
  apiIsAuthenticated: () => ipcRenderer.invoke('api:is-authenticated'),
  apiEvidenceCreate: (params: {
    file_name: string
    file_size: number
    file_count: number
    file_hash: string
  }) => ipcRenderer.invoke('api:evidence-create', params),
  apiEvidenceList: (page: number = 1, perPage: number = 10) => ipcRenderer.invoke('api:evidence-list', page, perPage),
  apiEvidenceCertificateApply: (id: number) => ipcRenderer.invoke('api:evidence-certificate-apply', id),
  apiBalanceList: (page: number = 1, perPage: number = 10) => ipcRenderer.invoke('api:balance-list', page, perPage),
  apiQueryBlockChain: (id: number) => ipcRenderer.invoke('api:query-block-chain', id),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

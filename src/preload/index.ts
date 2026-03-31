import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  onLoadingStatus: (callback: (status: { loading: boolean; progress: number }) => void) => {
    ipcRenderer.on('loading-status', (_event, value) => callback(value))
  },

  capturePage: (id: number) => ipcRenderer.invoke('capture-page', id),

  getSources: () => ipcRenderer.invoke('get-sources'),
  saveVideo: (data: { buffer: ArrayBuffer; mimeType: string }) =>
    ipcRenderer.invoke('save-video', data),

  createTab: (id: number, url: string) => ipcRenderer.invoke('create-tab', id, url),
  switchTab: (id: number) => ipcRenderer.invoke('switch-tab', id),

  loadUrl: (id: number, url: string) => ipcRenderer.invoke('load-url', id, url),

  onUpdateTitle: (callback: (data: { id: number; title: string }) => void) =>
    ipcRenderer.on('update-tab-title', (_event, value) => callback(value)),

  getTabUrl: (id: number) => ipcRenderer.invoke('get-tab-url', id),
  onUpdateUrl: (callback: (data: { id: number; url: string }) => void) =>
    ipcRenderer.on('update-tab-url', (_event, value) => callback(value)),

  removeTab: (id: number) => ipcRenderer.invoke('remove-tab', id),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveTask: (task: { name: string; savePath: string }) => ipcRenderer.invoke('save-task', task),
  getTasks: () => ipcRenderer.invoke('get-tasks')
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

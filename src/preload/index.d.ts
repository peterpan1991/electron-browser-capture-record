import { ElectronAPI } from '@electron-toolkit/preload'
import { Task } from '../shared/types'

interface Api {
  onLoadingStatus: (callback: (status: { loading: boolean; progress: number }) => void) => void
  capturePage: (
    id: number,
    savePath?: string
  ) => Promise<{ success: boolean; path?: string; hash?: string }>
  getSources: () => Promise<{ id: string; name: string }[]>
  saveVideo: (data: {
    buffer: ArrayBuffer
    mimeType: string
    savePath?: string
  }) => Promise<{ success: boolean; path?: string }>
  createTab: (id: number, url: string) => Promise<{ success: boolean; error?: string }>
  switchTab: (id: number) => Promise<{ success: boolean; message?: string }>
  loadUrl: (id: number, url: string) => Promise<{ success: boolean; message?: string }>
  onUpdateTitle: (callback: (data: { id: number; title: string }) => void) => void
  getTabUrl: (id: number) => Promise<string>
  onUpdateUrl: (callback: (data: { id: number; url: string }) => void) => void
  removeTab: (id: number) => Promise<{ success: boolean }>
  selectDirectory: () => Promise<string | null>
  saveTask: (task: {
    name: string
    savePath: string
  }) => Promise<{ success: boolean; task: Task[] }>
  getTasks: () => Promise<Task[]>
  deleteTask: (id: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

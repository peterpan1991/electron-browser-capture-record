import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  onLoadingStatus: (callback: (status: { loading: boolean; progress: number }) => void) => void
  capturePage: () => Promise<{ success: boolean }>
  getSources: () => Promise<{ success: boolean; sources: string[] }>
  saveVideo: (data: {buffer: ArrayBuffer, mimeType: string}) => Promise<{ success: boolean }>
  createTab: (id: number, url: string) => Promise<{ success: boolean; error?: string }>
  switchTab: (id: number) => Promise<{ success: boolean; message?: string }>
  loadUrl: (id: number, url: string) => Promise<{ success: boolean; message?: string }>
  onUpdateTitle: (callback: (data: { id: number; title: string }) => void) => void;
  getTabUrl: (id: number) => Promise<string>;
  onUpdateUrl: (callback: (data: {id: number; url: string }) => void) => void;
  removeTab: (id: number) => Promise<{ success: boolean }>
  selectDirectory: () => Promise<string | null>;
  saveTask: (task: { name: string; savePath: string }) => Promise<{ success: boolean; task: any }>;
  getTasks: () => Promise<any[]>;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

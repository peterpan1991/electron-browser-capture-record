import { ElectronAPI } from '@electron-toolkit/preload'
import { Task } from '../shared/types'

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 分页响应类型
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  current_page: number
  page_size: number
}

// 用户信息类型
export interface User {
  id: number
  name: string
  email: string
  phone: string
  status: number
  balance: string
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// 登录响应
export interface LoginResponse {
  token: string
  user: User
}

// 固证类型
export interface CustomerEvidence {
  id: number
  customer_id: number
  file_name: string
  file_size: number
  file_count: number
  file_hash: string
  certificate_path: string | null
  status: number
  created_at: string
  updated_at: string
}

// 余额记录类型
export interface BalanceRecord {
  id: number
  type: number
  balance: string
  amount: string
  order_no: string | null
  note: string | null
  paid_at: string | null
  created_at: string
}

interface Api {
  onLoadingStatus: (
    callback: (status: { loading: boolean; progress: number }) => void
  ) => () => void
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
  onUpdateTitle: (callback: (data: { id: number; title: string }) => void) => () => void
  getTabUrl: (id: number) => Promise<string>
  onUpdateUrl: (callback: (data: { id: number; url: string }) => void) => () => void
  onNewTabRequest: (callback: (data: { url: string }) => void) => () => void
  removeTab: (id: number) => Promise<{ success: boolean }>
  selectDirectory: () => Promise<string | null>
  saveTask: (task: {
    name: string
    savePath: string
  }) => Promise<{ success: boolean; task: Task[] }>
  getTasks: () => Promise<Task[]>
  deleteTask: (id: string) => Promise<{ success: boolean; error?: string }>
  // Navigation
  goBack: (id: number) => Promise<{ success: boolean }>
  goForward: (id: number) => Promise<{ success: boolean }>
  refreshTab: (id: number) => Promise<{ success: boolean }>
  selectFiles: () => Promise<string[]>
  packageFiles: (filePaths: string[], savePath: string) => Promise<{
    success: boolean
    fileCount?: number
    fileSize?: number
    hash?: string
    zipPath?: string
    message?: string
  }>

   // API 相关方法
  apiLogin: (email: string, password: string) => Promise<ApiResponse<LoginResponse>>
  apiLogout: () => Promise<ApiResponse>
  apiGetUser: () => Promise<User | null>
  apiGetUserInfo: () => Promise<ApiResponse<{ user: User }>>
  apiIsAuthenticated: () => Promise<boolean>
  apiEvidenceCreate: (params: {
    upload_file_id: number
    file_path: string
    file_name: string
    file_hash: string
  }) => Promise<ApiResponse>
  apiEvidenceList: (page?: number, perPage?: number) => Promise<ApiResponse<PaginatedResponse<CustomerEvidence>>>
  apiEvidenceDelete: (id: number) => Promise<ApiResponse>
  apiEvidenceCertificateApply: (id: number) => Promise<ApiResponse>
  apiBalanceList: (page?: number, perPage?: number) => Promise<ApiResponse<PaginatedResponse<BalanceRecord> & { balance: string }>>
  apiQueryBlockChain: (id: number) => Promise<ApiResponse>
  apiEvidenceUpload: (filePath: string) => Promise<ApiResponse<{
    message: string
    data: {
      upload_file_id: number
      file_path: string
      file_name: string
      file_count: number
      file_size: number
    }
  }>>  
  apiEvidenceUploadList: (page?: number, perPage?: number) => Promise<ApiResponse<PaginatedResponse<UploadRecord>>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

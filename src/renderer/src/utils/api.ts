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

export interface CustomerEvidence {
  id: number
  customer_id: number
  file_name: string
  file_size: number
  file_count: number
  file_hash: string
  certificate_path: string | null
  created_at: string
  updated_at: string
}

export interface UploadRecord {
  id: number
  customer_id: number
  file_path: string
  file_name: string
  file_size: number
  file_count: number
  file_hash: string
  status: number
  created_at: string
  customer_evidence_id: number | null
  has_evidence: boolean
}

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

// 登录响应
export interface LoginResponse {
  token: string
  user: User
}

// Token 管理（通过 IPC 调用主进程）
export const authManager = {
  // 获取用户信息
  getUser: async (): Promise<User | null> => {
    return await window.api.apiGetUser()
  },

  // 检查是否已登录
  isAuthenticated: async (): Promise<boolean> => {
    return await window.api.apiIsAuthenticated()
  }
}

// 登录 API
export const loginAPI = {
  // 登录
  login: async (email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
    return await window.api.apiLogin(email, password)
  },

  // 登出
  logout: async (): Promise<ApiResponse> => {
    return await window.api.apiLogout()
  }
}

export const userAPI = {
  getUserInfo: async (): Promise<ApiResponse<{ user: User }>> => {
    return await window.api.apiGetUserInfo()
  }
}

// 固证 API
export const evidenceAPI = {
  create: async (params: {
    upload_file_id: number
    file_path: string
    file_name: string
    file_hash: string
  }): Promise<ApiResponse> => {
    return await window.api.apiEvidenceCreate(params)
  },

  upload: async (zipPath: string): Promise<ApiResponse<{
    message: string
    data: {
      upload_file_id: number
      file_path: string
      file_name: string
      file_count: number
      file_size: number
    }
  }>> => {
    return await window.api.apiEvidenceUpload(zipPath)
  },

  list: async (page: number = 1, perPage: number = 10): Promise<ApiResponse<PaginatedResponse<CustomerEvidence>>> => {
    return await window.api.apiEvidenceList(page, perPage)
  },

  uploadList: async (page: number = 1, perPage: number = 10): Promise<ApiResponse<PaginatedResponse<UploadRecord>>> => {
    return await window.api.apiEvidenceUploadList(page, perPage)
  },

  applyCertificate: async (id: number): Promise<ApiResponse> => {
    return await window.api.apiEvidenceCertificateApply(id)
  },

  queryBlockChain: async (id: number): Promise<ApiResponse> => {
    return await window.api.apiQueryBlockChain(id)
  }
}

// 余额 API
export const balanceAPI = {
  list: async (page: number = 1, perPage: number = 10): Promise<ApiResponse<PaginatedResponse<BalanceRecord> & { balance: string }>> => {
    return await window.api.apiBalanceList(page, perPage)
  }
}

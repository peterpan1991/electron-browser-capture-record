import { http, authManager, ApiResponse, LoginResponse, User } from './http'

export type { ApiResponse, LoginResponse, User }
export { authManager }

export const loginAPI = {
  login: async (email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
    const response = await http.post<LoginResponse>('/login', {
      email,
      password
    })

    if (response.success && response.data) {
      authManager.setToken(response.data.token)
      authManager.setUser(response.data.user)
    }

    return response
  },

  logout: async (): Promise<ApiResponse> => {
    authManager.clearAuth()
    return { success: true }
  }
}

export interface EvidenceCreateParams {
  file_name: string
  file_size: number
  file_count: number
  file_hash: string
}

export interface EvidenceRecord {
  id: number
  file_name: string
  file_size: number
  file_count: number
  file_hash: string
  status: number
  created_at: string
  zxchain?: {
    certUrl: string | null
    certStatus: number
  }
}

export const evidenceAPI = {
  create: async (params: EvidenceCreateParams): Promise<ApiResponse> => {
    return await http.post('/evidence/create', params)
  },

  list: async (page: number = 1, perPage: number = 10): Promise<ApiResponse<{ list: EvidenceRecord[]; total: number }>> => {
    const response = await http.get<{ list: EvidenceRecord[]; total: number }>('/evidence/list', { page: String(page), per_page: String(perPage) })
    return response
  },

  applyCertificate: async (id: number): Promise<ApiResponse> => {
    return await http.post(`/evidence/certificate/apply/${id}`)
  },

  queryBlockChain: async (id: number): Promise<ApiResponse> => {
    return await http.post(`/evidence/blockchain/query/${id}`)
  }
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

export const balanceAPI = {
  list: async (page: number = 1, perPage: number = 10): Promise<ApiResponse<{ list: BalanceRecord[]; total: number; balance: string }>> => {
    const response = await http.get<{ list: BalanceRecord[]; total: number; balance: string }>('/balance/list', { page: String(page), per_page: String(perPage) })
    return response
  }
}

export const userAPI = {
  getUserInfo: async (): Promise<ApiResponse<{ user: User }>> => {
    return await http.get<{ user: User }>('/user/info')
  }
}
import axios, { AxiosInstance, AxiosError } from 'axios'
import FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'

// API 配置
export const API_BASE_URL = 'http://8.138.181.164/api/browser-client'

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

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 登录响应
export interface LoginResponse {
  token: string
  user: User
}

// Token 管理（主进程使用 electron-store 或内存存储）
let cachedToken: string | null = null
let cachedUser: User | null = null

export const authManager = {
  // 获取 Token
  getToken: (): string | null => {
    return cachedToken
  },

  // 保存 Token
  setToken: (token: string): void => {
    cachedToken = token
  },

  // 移除 Token
  removeToken: (): void => {
    cachedToken = null
  },

  // 获取用户信息
  getUser: (): User | null => {
    return cachedUser
  },

  // 保存用户信息
  setUser: (user: User): void => {
    cachedUser = user
  },

  // 移除用户信息
  removeUser: (): void => {
    cachedUser = null
  },

  // 清除所有认证信息
  clearAuth: (): void => {
    authManager.removeToken()
    authManager.removeUser()
  },

  // 检查是否已登录
  isAuthenticated: (): boolean => {
    return !!authManager.getToken()
  }
}

// 创建 Axios 实例
class HttpClient {
  private client: AxiosInstance

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = authManager.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        return response
      },
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // 401 未授权，清除认证信息
          authManager.clearAuth()
        }
        return Promise.reject(error)
      }
    )
  }

  // GET 请求
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(endpoint, { params })
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  // POST 请求
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(endpoint, data)
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  // PUT 请求
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(endpoint, data)
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  // DELETE 请求
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(endpoint)
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  // 上传文件
  async upload<T>(
    endpoint: string,
    file: Buffer,
    fileName: string,
    additionalData?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData()

      formData.append('file', file, fileName)

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, value)
        })
      }

      const response = await this.client.post(endpoint, formData, {
        headers: {
          ...formData.getHeaders()
        }
      })

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return this.handleError(error)
    }
  }

  // 上传本地文件
  async uploadFile<T>(endpoint: string, localFilePath: string): Promise<ApiResponse<T>> {
    try {
      if (!fs.existsSync(localFilePath)) {
        return {
          success: false,
          message: '文件不存在'
        }
      }

      const fileName = path.basename(localFilePath)
      const fileBuffer = fs.readFileSync(localFilePath)

      return await this.upload<T>(endpoint, fileBuffer, fileName)
    } catch (error) {
      return this.handleError(error)
    }
  }

  // 错误处理
  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>
      const errorMessage = axiosError.response?.data?.message || axiosError.message || '请求失败'

      return {
        success: false,
        message: errorMessage,
        error: `HTTP ${axiosError.response?.status || 'UNKNOWN'}`
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      error: 'UNKNOWN_ERROR'
    }
  }
}

// 创建 HTTP 客户端实例
export const http = new HttpClient(API_BASE_URL)
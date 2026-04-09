import { ReactElement, useState, useRef, useEffect } from 'react'
import { evidenceAPI, authManager } from '../utils/api'
import { formatTime } from '../utils/format'

// API 接口类型定义
interface UploadItem {
  id: string
  fileName: string
  categoryName: string
  progress: number // 0-100
  uploadTime: string
  status: 'uploading' | 'completed' | 'failed'
}

interface FileItem {
  id: string
  fileName: string
  categoryName: string
  fileTypeName: string
  uploadTime: string
  fileUrl?: string
  certificateUrl?: string
}

type MenuKey = 'upload' | 'files'

function UploadEvidence(): ReactElement {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('upload')
  const [uploadList, setUploadList] = useState<UploadItem[]>([])
  const [fileList, setFileList] = useState<FileItem[]>([])
  const [fileNameFilter, setFileNameFilter] = useState('')
  const [categoryNameFilter, setCategoryNameFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 检查是否已登录
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const authenticated = await authManager.isAuthenticated()
      setIsAuthenticated(authenticated)
    }
    checkAuth()
  }, [])

  // 初始化加载数据
  useEffect(() => {
    if (activeMenu === 'files') {
      loadFileList()
    }
  }, [activeMenu])

  // 加载文件列表
  const loadFileList = async (): Promise<void> => {
    if (!isAuthenticated) {
      // 未登录时使用模拟数据
      alert('请先登录')
      return
    }

    setLoading(true)
    try {
      const response = await uploadEvidenceAPI.getFileList({
        fileName: fileNameFilter || undefined,
        categoryName: categoryNameFilter || undefined
      })

      if (response.success && response.data) {
        const data = response.data as { list?: unknown[] }
        const list = data.list || []
        const mappedList: FileItem[] = list.map((item) => {
          const record = item as Record<string, unknown>
          return {
            id: String(record.id || ''),
            fileName: String(record.file_name || ''),
            categoryName: String(record.category_name || ''),
            fileTypeName: String(record.file_type_name || ''),
            uploadTime: formatTime(String(record.created_at || '')),
            fileUrl: record.file_path ? String(record.file_path) : undefined
          }
        })
        setFileList(mappedList)
      } else {
        console.warn('文件列表加载失败，使用模拟数据:', response.message)
      }
    } catch (error) {
      console.error('加载文件列表异常:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理文件上传
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of files) {
      // 添加到上传列表
      const newItem: UploadItem = {
        id: Date.now().toString(),
        fileName: file.name,
        categoryName: '默认分类',
        progress: 0,
        uploadTime: new Date().toLocaleString('zh-CN'),
        status: 'uploading'
      }
      setUploadList((prev) => [newItem, ...prev])

      if (isAuthenticated) {
        // 已登录：调用后端 API
        try {
          const response = await uploadEvidenceAPI.uploadFile(file, '默认分类')

          if (response.success) {
            // 上传成功
            setUploadList((prev) =>
              prev.map((item) =>
                item.id === newItem.id ? { ...item, progress: 100, status: 'completed' } : item
              )
            )
          } else {
            // 上传失败
            setUploadList((prev) =>
              prev.map((item) => (item.id === newItem.id ? { ...item, status: 'failed' } : item))
            )
            console.error('上传失败:', response.message)
          }
        } catch (error) {
          console.error('上传异常:', error)
          setUploadList((prev) =>
            prev.map((item) => (item.id === newItem.id ? { ...item, status: 'failed' } : item))
          )
        }
      }
    }

    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理文件筛选
  const handleFilter = async (): Promise<void> => {
    await loadFileList()
  }

  // 下载证书
  const handleDownloadCertificate = (fileId: string): void => {
    if (!isAuthenticated) {
      alert('请先登录后再下载证书')
      return
    }
    uploadEvidenceAPI.downloadCertificate(fileId)
  }

  // 下载文件
  const handleDownloadFile = (fileId: string): void => {
    if (!isAuthenticated) {
      alert('请先登录后再下载文件')
      return
    }
    uploadEvidenceAPI.downloadFile(fileId)
  }

  return (
    <div className="upload-evidence-container">
      {/* 左侧菜单 */}
      <div className="upload-sidebar">
        <div className="sidebar-title">上传固证</div>
        <div className="sidebar-menu">
          <div
            className={`menu-item ${activeMenu === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveMenu('upload')}
          >
            <span className="menu-icon">📤</span>
            <span>上传固证</span>
          </div>
          <div
            className={`menu-item ${activeMenu === 'files' ? 'active' : ''}`}
            onClick={() => setActiveMenu('files')}
          >
            <span className="menu-icon">📁</span>
            <span>固证记录</span>
          </div>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="upload-content">
        {activeMenu === 'upload' ? (
          <>
            {/* 上传页面头部 */}
            <div className="content-header">
              <h2>文件上传</h2>
              <div className="upload-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                  上传文件
                </button>
              </div>
            </div>

            {/* 上传列表 */}
            <div className="upload-list">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>分类名</th>
                    <th>上传进度</th>
                    <th>上传时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>
                        暂无上传记录
                      </td>
                    </tr>
                  ) : (
                    uploadList.map((item) => (
                      <tr key={item.id}>
                        <td>{item.fileName}</td>
                        <td>{item.categoryName}</td>
                        <td>
                          <div className="progress-wrapper">
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="progress-text">{item.progress}%</span>
                          </div>
                        </td>
                        <td>{item.uploadTime}</td>
                        <td>
                          <span className={`status-badge ${item.status}`}>
                            {item.status === 'uploading' && '上传中'}
                            {item.status === 'completed' && '已完成'}
                            {item.status === 'failed' && '失败'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            {/* 文件页面头部 */}
            <div className="content-header">
              <h2>文件列表</h2>
              <div className="filter-area">
                <input
                  type="text"
                  placeholder="按文件名筛选..."
                  value={fileNameFilter}
                  onChange={(e) => setFileNameFilter(e.target.value)}
                  className="filter-input"
                />
                <input
                  type="text"
                  placeholder="按分类名筛选..."
                  value={categoryNameFilter}
                  onChange={(e) => setCategoryNameFilter(e.target.value)}
                  className="filter-input"
                />
                <button className="filter-btn" onClick={handleFilter} disabled={loading}>
                  {loading ? '加载中...' : '筛选'}
                </button>
              </div>
            </div>

            {/* 文件列表 */}
            <div className="file-list">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>分类名</th>
                    <th>文件类型</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {fileList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>
                        暂无文件记录
                      </td>
                    </tr>
                  ) : (
                    fileList.map((item) => (
                      <tr key={item.id}>
                        <td>{item.fileName}</td>
                        <td>{item.categoryName}</td>
                        <td>{item.fileTypeName}</td>
                        <td>{item.uploadTime}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="action-btn certificate"
                              onClick={() => handleDownloadCertificate(item.id)}
                            >
                              下载证书
                            </button>
                            <button
                              className="action-btn download"
                              onClick={() => handleDownloadFile(item.id)}
                            >
                              下载文件
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default UploadEvidence

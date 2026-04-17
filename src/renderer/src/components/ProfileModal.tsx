import { ReactElement, useState, useEffect } from 'react'
import { formatFileSize, formatTime } from '../utils/format'
import { User, balanceAPI, userAPI, evidenceAPI, UploadRecord } from '../utils/api'
import '../assets/profile.css'

interface EvidenceRecord {
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

interface BalanceRecord {
  id: number
  type: number
  balance: string
  amount: string
  order_no: string | null
  note: string | null
  paid_at: string | null
  created_at: string
}

interface ProfileModalProps {
  user: User
  uploadProgress?: {
    status: 'idle' | 'packaging' | 'uploading' | 'creating' | 'done' | 'error'
    message: string
    zipPath?: string
    uploadData?: {
      upload_file_id: number
      file_path: string
      file_name: string
      file_count: number
      file_size: number
    }
    hash?: string
    error?: string
  }
  onRefreshUpload?: () => void
  onResetUploadProgress?: () => void
  onClose: () => void
}

export default function ProfileModal({ user: initialUser, uploadProgress, onRefreshUpload, onResetUploadProgress, onClose }: ProfileModalProps): ReactElement {
  const [activeTab, setActiveTab] = useState<'profile' | 'balance' | 'uploads' | 'evidence'>('profile')
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([])
  const [uploadList, setUploadList] = useState<UploadRecord[]>([])
  const [balanceList, setBalanceList] = useState<BalanceRecord[]>([])
  const [user, setUser] = useState(initialUser)
  const [currentBalance, setCurrentBalance] = useState(initialUser.balance)
  const [loading, setLoading] = useState(false)
  const [balancePage, setBalancePage] = useState(1)
  const [balanceTotal, setBalanceTotal] = useState(0)
  const [uploadPage, setUploadPage] = useState(1)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [evidencePage, setEvidencePage] = useState(1)
  const [evidenceTotal, setEvidenceTotal] = useState(0)
  const [certApplying, setCertApplying] = useState<number | null>(null)
  const [querying, setQuerying] = useState<number | null>(null)

  const pageSize = 10

  useEffect(() => {
    loadUserInfo()
  }, [])

  useEffect(() => {
    if (uploadProgress && uploadProgress.status !== 'idle') {
      setActiveTab('uploads')
      loadUploadList(1)
    }
  }, [uploadProgress])

  useEffect(() => {
    if (activeTab === 'evidence') {
      loadEvidenceList(1)
    }
    if (activeTab === 'balance') {
      loadBalanceList(1)
    }
    if (activeTab === 'uploads') {
      loadUploadList(1)
    }
  }, [activeTab])

  const loadUserInfo = async (): Promise<void> => {
    try {
      const result = await userAPI.getUserInfo()
      if (result.success && result.data?.user) {
        setUser(result.data.user)
        setCurrentBalance(result.data.user.balance)
      }
    } catch (err) {
      console.error('获取用户信息失败:', err)
    }
  }

  const loadEvidenceList = async (page: number): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.apiEvidenceList(page, pageSize)
      if (result.success && result.data) {
        setEvidenceList(result.data.list || [])
        setEvidenceTotal(result.data.total || 0)
        setEvidencePage(page)
      }
    } catch (err) {
      console.error('加载固证记录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUploadList = async (page: number): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.apiEvidenceUploadList(page, pageSize)
      console.log(result)      
      if (result.success && result.data) {
        setUploadList(result.data.list || [])
        setUploadTotal(result.data.total || 0)
        setUploadPage(page)
      }
    } catch (err) {
      console.error('加载上传记录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyCertificate = async (id: number): Promise<void> => {
    setCertApplying(id)
    try {
      const result = await evidenceAPI.applyCertificate(id)
      if (result.success) {
        alert('证书申请成功')
        loadEvidenceList(evidencePage)
      } else {
        alert(result.message || '证书申请失败')
      }
    } catch (err) {
      console.error('证书申请失败:', err)
      alert('证书申请失败')
    } finally {
      setCertApplying(null)
    }
  }

  const handleCreateEvidence = async (item: UploadRecord): Promise<void> => {
    try {
      const result = await evidenceAPI.create({
        upload_file_id: item.id,
        file_path: item.file_path,
        file_name: item.file_name,
        file_hash: item.file_hash
      })
      if (result.success) {
        alert('固证创建成功')
        loadUploadList(uploadPage)
        setActiveTab('evidence')
        loadEvidenceList(1)
      } else {
        alert(result.message || '固证创建失败')
      }
    } catch (err) {
      console.error('固证创建失败:', err)
      alert('固证创建失败')
    }
  }

  const downloadCertificate = (url: string): void => {
    window.open(url, '_blank')
  }

  const loadBalanceList = async (page: number): Promise<void> => {
    setLoading(true)
    try {
      const result = await balanceAPI.list(page, pageSize)
      if (result.success && result.data) {
        setBalanceList(result.data.list || [])
        setBalanceTotal(result.data.total || 0)
        setBalancePage(page)
        if (result.data.balance !== undefined) {
          setCurrentBalance(result.data.balance)
        }
      }
    } catch (err) {
      console.error('加载余额记录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const queryBlockChain = async (id: number): Promise<void> => {
    setQuerying(id)
    try {
      const result = await window.api.apiQueryBlockChain(id)
      if (result.success) {
        alert('查询成功')
        loadEvidenceList(evidencePage)
      } else {
        alert(result.message || '查询失败')
      }
    } catch (err) {
      console.error('查询区块链状态失败:', err)
      alert('查询区块链状态失败')
    } finally {
      setQuerying(null)
    }
  }

  const getBalanceTotalPages = (): number => Math.ceil(balanceTotal / pageSize)
  const getEvidenceTotalPages = (): number => Math.ceil(evidenceTotal / pageSize)

  const getTransactionNote = (item: BalanceRecord): string => {
    return item.note || (item.type === 1 ? '充值' : item.type === 4 ? '撤销' : '其他')
  }

  const getAmountClass = (type: number): string => {
    return type === 1 ? 'income' : type === 4 ? 'outcome' : ''
  }

  const getAmountPrefix = (type: number): string => {
    return type === 1 ? '+' : type === 4 || type === 2 ? '-' : ''
  }

  const getEvidenceStatusText = (status: number): string => {
    return status === 0 ? '已提交' : status === 1 ? '处理中' : status === 2 ? '成功' : status === 3 ? '失败' : '未知'
  }

  const getEvidenceStatusClass = (status: number): string => {
    return status === 0 ? 'submitted' : status === 1 ? 'uploading' : status === 2 ? 'success' : status === 3 ? 'failed' : ''
  }

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal">
        <div className="profile-modal-header">
          <h2>个人中心</h2>
          <button className="profile-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="profile-modal-tabs">
          <button
            className={`profile-modal-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            账户信息
          </button>
          <button
            className={`profile-modal-tab ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            积分
          </button>
          <button
            className={`profile-modal-tab ${activeTab === 'uploads' ? 'active' : ''}`}
            onClick={() => setActiveTab('uploads')}
          >
            上传记录
          </button>
          <button
            className={`profile-modal-tab ${activeTab === 'evidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            固证记录
          </button>
        </div>

        <div className="profile-modal-content">
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="profile-info-card">
                <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="profile-name">{user.name}</div>
                  <div className="profile-email">{user.email}</div>
                </div>
              </div>

              <div className="profile-grid">
                <div className="profile-grid-item">
                  <div className="profile-grid-label">用户ID</div>
                  <div className="profile-grid-value">{user.id}</div>
                </div>
                <div className="profile-grid-item">
                  <div className="profile-grid-label">手机号</div>
                  <div className="profile-grid-value">{user.phone || '未设置'}</div>
                </div>
                <div className="profile-grid-item">
                  <div className="profile-grid-label">账户状态</div>
                  <div className="profile-grid-value">{user.is_active ? '已激活' : '未激活'}</div>
                </div>
                <div className="profile-grid-item">
                  <div className="profile-grid-label">注册时间</div>
                  <div className="profile-grid-value">{formatTime(user.created_at)}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'balance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="balance-card">
                <div className="balance-label">账户积分</div>
                <div className="balance-value">¥ {currentBalance}</div>
              </div>

              <div className="transaction-card">
                <div className="transaction-title">交易记录</div>
                {loading ? (
                  <div className="loading-text">加载中...</div>
                ) : balanceList.length === 0 ? (
                  <div className="empty-text">暂无交易记录</div>
                ) : (
                  <div className="transaction-list">
                    {balanceList.map((item) => (
                      <div key={item.id} className="transaction-item">
                        <div className="transaction-info">
                          <div className="transaction-type">
                            {item.type === 1 ? '充值' : '消费'}
                          </div>
                          <div className="transaction-note">{item.note || '-'}</div>
                        </div>
                        <div className="transaction-amount">
                          <span className={item.type === 1 ? 'positive' : 'negative'}>
                            {item.type === 1 ? '+' : '-'}¥{item.amount}
                          </span>
                          <div className="transaction-time">{formatTime(item.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {getBalanceTotalPages() > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      onClick={() => loadBalanceList(balancePage - 1)}
                      disabled={balancePage <= 1 || loading}
                    >
                      上一页
                    </button>
                    <span className="pagination-info">
                      {balancePage} / {getBalanceTotalPages()}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => loadBalanceList(balancePage + 1)}
                      disabled={balancePage >= getBalanceTotalPages() || loading}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'uploads' && (
            <div>
              {uploadProgress && uploadProgress.status !== 'idle' && (
                <div className="upload-progress-card">
                  <div className="upload-progress-header">
                    <div className="upload-progress-title">上传进度</div>
                    <button 
                      className="upload-progress-close"
                      onClick={() => onResetUploadProgress?.()}
                    >
                      ×
                    </button>
                  </div>
                  <div className={`upload-progress-status ${uploadProgress.status}`}>
                    {uploadProgress.status === 'packaging' && '📦 ' + uploadProgress.message}
                    {uploadProgress.status === 'uploading' && '⬆️ ' + uploadProgress.message}
                    {uploadProgress.status === 'creating' && '🔗 ' + uploadProgress.message}
                    {uploadProgress.status === 'done' && '✅ ' + uploadProgress.message}
                    {uploadProgress.status === 'error' && '❌ ' + uploadProgress.message}
                  </div>
                  {uploadProgress.status === 'done' && uploadProgress.uploadData && (
                    <div className="upload-progress-detail">
                      <div>文件名：{uploadProgress.uploadData.file_name}</div>
                      <div>文件数量：{uploadProgress.uploadData.file_count}</div>
                      <div>文件大小：{formatFileSize(uploadProgress.uploadData.file_size)}</div>
                      {uploadProgress.hash && <div>文件哈希：{uploadProgress.hash}</div>}
                    </div>
                  )}
                  {uploadProgress.status === 'error' && uploadProgress.error && (
                    <div className="upload-progress-error">
                      错误信息：{uploadProgress.error}
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="loading-text">加载中...</div>
              ) : uploadList.length === 0 ? (
                <div className="empty-text">暂无上传记录</div>
              ) : (
                <div className="evidence-list">
                  {uploadList.map((item) => (
                    <div key={item.id} className="evidence-item">
                      <div className="evidence-header">
                        <div className="evidence-name">{item.file_name}</div>
                        <span className={`status-badge ${item.status === 1 ? 'success' : item.status === 2 ? 'failed' : item.status === 3 ? 'failed' : 'pending'}`}>
                          {item.status === 0 ? '上传中' : item.status === 1 ? '成功' : item.status === 2 ? '失败' : item.status === 3 ? '已删除' : '未知状态'}
                        </span>
                      </div>
                      <div className="evidence-info">
                        <div>
                          <span className="evidence-info-label">文件大小：</span>
                          {formatFileSize(item.file_size)}
                        </div>
                        <div>
                          <span className="evidence-info-label">文件数量：</span>
                          {item.file_count}
                        </div>
                        <div>
                          <span className="evidence-info-label">创建时间：</span>
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                      <div className="evidence-hash">哈希：{item.file_hash}</div>
                      {item.status === 1 && !item.has_evidence && (
                        <button
                          className="evidence-action-btn"
                          onClick={() => handleCreateEvidence(item)}
                        >
                          区块链固证
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadTotal > pageSize && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => loadUploadList(uploadPage - 1)}
                    disabled={uploadPage <= 1 || loading}
                  >
                    上一页
                  </button>
                  <span className="pagination-info">
                    {uploadPage} / {Math.ceil(uploadTotal / pageSize)}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => loadUploadList(uploadPage + 1)}
                    disabled={uploadPage >= Math.ceil(uploadTotal / pageSize) || loading}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div>
              {loading ? (
                <div className="loading-text">加载中...</div>
              ) : evidenceList.length === 0 ? (
                <div className="empty-text">暂无固证记录</div>
              ) : (
                <div className="evidence-list">
                  {evidenceList.map((item) => (
                    <div key={item.id} className="evidence-item">
                      <div className="evidence-header">
                        <div className="evidence-name">{item.file_name}</div>
                        <span className={`status-badge ${getEvidenceStatusClass(item.status)}`}>
                          {getEvidenceStatusText(item.status)}
                        </span>
                      </div>
                      <div className="evidence-info">
                        <div>
                          <span className="evidence-info-label">文件大小：</span>
                          {formatFileSize(item.file_size)}
                        </div>
                        <div>
                          <span className="evidence-info-label">文件数量：</span>
                          {item.file_count}
                        </div>
                        <div>
                          <span className="evidence-info-label">创建时间：</span>
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                      <div className="evidence-hash">哈希：{item.file_hash}</div>
                      <div className="evidence-actions">
                        {item.status === 2 && item.zxchain?.certStatus === 0 && (
                          <button
                            className="action-btn certificate"
                            onClick={() => applyCertificate(item.id)}
                            disabled={certApplying === item.id}
                          >
                            {certApplying === item.id ? '申请中...' : '申请证书'}
                          </button>
                        )}
                        {item.status === 2 && item.zxchain?.certStatus === 1 && item.zxchain?.certUrl && (
                          <button
                            className="action-btn download"
                            onClick={() => downloadCertificate(item.zxchain!.certUrl!)}
                          >
                            下载证书
                          </button>
                        )}
                        {item.status == 3 && (
                          <button
                            className="action-btn query"
                            onClick={() => queryBlockChain(item.id)}
                            disabled={querying === item.id}
                          >
                            {querying === item.id ? '查询中...' : '查询区块链状态'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {evidenceList.length > 0 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => loadEvidenceList(evidencePage - 1)}
                    disabled={evidencePage === 1 || loading}
                  >
                    上一页
                  </button>
                  <span className="pagination-info">
                    第 {evidencePage} / {getEvidenceTotalPages()} 页
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => loadEvidenceList(evidencePage + 1)}
                    disabled={evidencePage >= getEvidenceTotalPages() || loading}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { ReactElement, useState } from 'react'
import { loginAPI, User } from '../utils/api'

interface LoginModalProps {
  onLogin: (user: User) => void
  onCancel: () => void
}

export default function LoginModal({ onLogin, onCancel }: LoginModalProps): ReactElement {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!email || !pass) return

    setLoading(true)
    setError('')

    try {
      const response = await loginAPI.login(email, pass)

      if (response.success && response.data) {
        // 登录成功，通知父组件
        onLogin(response.data.user)
      } else {
        // 登录失败，显示错误消息
        setError(response.message || '登录失败，请重试')
      }
    } catch (err) {
      console.error('登录异常:', err)
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999999
      }}
    >
      <div
        style={{
          background: '#333',
          padding: '24px',
          borderRadius: '8px',
          width: '320px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#fff' }}>登入系统</h3>

        {/* 错误消息 */}
        {error && (
          <div
            style={{
              padding: '10px',
              marginBottom: '15px',
              background: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '13px', color: '#aaa' }}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              disabled={loading}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#222',
                color: '#fff',
                outline: 'none',
                opacity: loading ? 0.6 : 1
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '13px', color: '#aaa' }}>密码</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="请输入密码"
              required
              disabled={loading}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#222',
                color: '#fff',
                outline: 'none',
                opacity: loading ? 0.6 : 1
              }}
            />
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: loading ? '#666' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '登入中...' : '登入'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '10px 15px',
                background: '#444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

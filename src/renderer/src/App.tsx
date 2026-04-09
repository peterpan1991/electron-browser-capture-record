import { useEffect, useState, useRef, ReactElement } from 'react'
import Home from './components/Home'
import NewTaskModal from './components/NewTaskModal'
import TaskListModal from './components/TaskListModal'
import LoginModal from './components/LoginModal'
import ProfileModal from './components/ProfileModal'
import { Task } from '../../shared/types'
import { User, authManager, loginAPI, evidenceAPI } from './utils/api'

interface DesktopTrackConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: string
    chromeMediaSourceId: string
  }
}

function App(): ReactElement {
  const [url, setUrl] = useState('about:blank')
  const [, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const formatTime = (seconds: number): string => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  //标签页
  const [tabs, setTabs] = useState<
    { id: number; title: string; url: string; type?: 'normal' }[]
  >([])
  const [activeTabId, setActiveTabId] = useState(0)

  // 初始化时创建第一个标签页
  useEffect(() => {
    const initTab = async (): Promise<void> => {
      const newId = Date.now()
      const newTab = { id: newId, title: '新标签页', url: 'about:blank', type: 'normal' as const }
      setTabs([newTab])
      setActiveTabId(newId)
      await window.api.createTab(newId, newTab.url)
    }
    if (tabs.length === 0) {
      initTab()
    }
  }, [tabs.length])

  const addTab = async (): Promise<void> => {
    const newId = Date.now()
    const newTab = { id: newId, title: '新标签页', url: 'about:blank', type: 'normal' as const }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)

    window.api.createTab(newId, newTab.url)
  }

  const switchTab = async (id: number): Promise<void> => {
    setActiveTabId(id)

    try {
      const result = await window.api.switchTab(id)

      if (!result.success) {
        console.error('切换分页失败:', result.message)
      }

      const currentUrl = await window.api.getTabUrl(id)
      setUrl(currentUrl)
    } catch (err) {
      console.error('通讯异常:', err)
    }
  }

  const removeTab = async (e: React.MouseEvent, id: number): Promise<void> => {
    e.stopPropagation()
    await window.api.removeTab(id)

    // 2. 更新 React 狀態
    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)

    // 3. 如果關掉的是目前的 Tab，則自動切換
    if (id === activeTabId && newTabs.length > 0) {
      const nextTab = newTabs[newTabs.length - 1] // 簡單起見切換到最後一個
      switchTab(nextTab.id)
    } else if (newTabs.length === 0) {
      // 如果全關了，自動開一個新的
      addTab()
    }
  }

  // 录像
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startGlobalRecording = async (): Promise<void> => {
    const sources = await window.api.getSources()
    const source = sources[0] // 選擇整個視窗作為來源

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id // 關鍵：錄製的是「視窗」，切換分頁只是視窗內容變了，錄影不會斷
        }
      } as DesktopTrackConstraints
    })

    const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs=h264')
      ? 'video/mp4; codecs=h264'
      : 'video/webm; codecs=vp9'

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 5000000
    })

    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      const buffer = await blob.arrayBuffer()

      await window.api.saveVideo({
        buffer,
        mimeType: recorder.mimeType, // 例如: "video/mp4; codecs=h264"
        savePath: currentTask?.savePath
      })
      stream.getTracks().forEach((track) => track.stop()) // 關閉攝像頭訊號
    }

    recorder.start()
    setIsRecording(true)
    setRecordingTime(0)
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)
  }

  const stopGlobalRecording = (): void => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleGo = async (): Promise<void> => {
    if (!url || url.includes('about:blank')) return

    // 传入当前选中的分页ID
    const result = await window.api.loadUrl(activeTabId, url)

    if (!result.success) {
      console.error('跳转失敗:', result.message)
    }
  }

  //截图
  const handleCapture = async (): Promise<void> => {
    setIsCapturing(true)
    try {
      const result = await window.api.capturePage(activeTabId, currentTask?.savePath)
      if (result.success) {
        alert('截图已保存！')
      }
    } catch (err) {
      console.error('截图失敗:', err)
    } finally {
      setIsCapturing(false)
    }
  }

  // 固证
  const handleEvidence = async (): Promise<void> => {
    if (!currentTask) {
      alert('请先选择任务')
      return
    }

    if (!currentUser) {
      alert('请先登录')
      return
    }

    const filePaths = await window.api.selectFiles()
    if (filePaths.length === 0) {
      return
    }    

    const confirmed = confirm(`你将上传${filePaths.length}个文件到区块链固证，是否确认上传？`)
    if (!confirmed) {
      return
    }

    try {
      const result = await window.api.packageFiles(filePaths, currentTask.savePath)
      if (!result.success) {
        alert('打包失败: ' + result.message)
        return
      }

      const fileName = `evidence-${Date.now()}.zip`
      const response = await evidenceAPI.create({
        file_name: fileName,
        file_size: result.fileSize || 0,
        file_count: result.fileCount || 0,
        file_hash: result.hash || ''
      })

      if (response.success) {
        alert('固证创建成功！请妥善保管源文件' + fileName)
      } else {
        alert('固证创建失败: ' + (response.message || response.error))
      }
    } catch (err) {
      console.error('固证失败:', err)
      alert('固证失败，请重试')
    }
  }

  //新建任务
  const [showModal, setShowModal] = useState(false)
  const [showTaskListModal, setShowTaskListModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [taskList, setTaskList] = useState<Task[]>([])
  const [currentTask, setCurrentTask] = useState<Task | null>(null)

  // 用户登录状态
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const user = await authManager.getUser()
      const authenticated = await authManager.isAuthenticated()
      if (user && authenticated) {
        setCurrentUser(user)
      }
    }
    checkAuth()

    // 监听登出事件
    const handleLogout = (): void => {
      setCurrentUser(null)
    }
    window.addEventListener('auth:logout', handleLogout)

    return () => {
      window.removeEventListener('auth:logout', handleLogout)
    }
  }, [])

  const handleOpenModal = (): void => {
    setShowModal(true)
  }

  const handleSaveTask = async (data: { name: string; savePath: string }): Promise<void> => {
    const result = await window.api.saveTask(data)
    if (result.success) {
      setShowModal(false)
      setCurrentTask(result.task as unknown as Task) // result.task is the new task object
      // 重新獲取列表
      const list = await window.api.getTasks()
      setTaskList(list)
    }
  }

  const handleTaskLists = async (): Promise<void> => {
    // 如果當前不是約定好的空白頁 (about:blank)，先自動開啟一個新標籤頁
    // 這樣可以避免 TaskListModal 被 BrowserView (網頁內容) 遮擋
    if (!url || url === '' || !url.includes('about:blank')) {
      await addTab()
    }
    const list = await window.api.getTasks()
    setTaskList(list)
    setShowTaskListModal(true)
  }

  const handleDeleteTask = async (id: string): Promise<void> => {
    if (!window.confirm('確定要刪除此任務嗎？（此操作不会删除本地文件）')) return

    const result = await window.api.deleteTask(id)
    if (result.success) {
      const list = await window.api.getTasks()
      setTaskList(list)
    }
  }

  const handleOnLogin = async (): Promise<void> => {
    if (!url || url === '' || !url.includes('about:blank')) {
      await addTab()
    }
    setShowLoginModal(true)
  }

  const handleLogin = (user: User): void => {
    setCurrentUser(user)
    setShowLoginModal(false)
  }

  const handleLogout = async (): Promise<void> => {
    await loginAPI.logout()
    setCurrentUser(null)
  }

  const handleOnProfile = async (): Promise<void> => {
    if (!currentUser) {
      alert('请先登录')
      return
    }
    if (!url || url === '' || !url.includes('about:blank')) {
      await addTab()
    }
    setShowProfileModal(true)
  }

  useEffect(() => {
    const cleanups: (() => void)[] = []

    // 监听来自主进程的进度通知
    if (window.api?.onLoadingStatus) {
      cleanups.push(
        window.api.onLoadingStatus(({ loading, progress }) => {
          setLoading(loading)
          setProgress(progress)

          // 加载完成后隐藏进度条
          if (!loading) {
            setTimeout(() => setProgress(0), 1000)
          }
        })
      )
    }

    cleanups.push(
      window.api.onUpdateTitle(({ id, title }) => {
        setTabs((prevTabs) => {
          // 確保找到對應的 tab 並產生一個「全新」的物件，觸發 React 渲染
          return prevTabs.map((tab) => {
            if (tab.id === id) {
              return { ...tab, title: title } // 展開舊 tab，覆寫新 title
            }
            return tab
          })
        })
      })
    )

    cleanups.push(
      window.api.onUpdateUrl(({ id, url: newUrl }) => {
        // 只有當更新的是「目前正在看」的分頁時，才更新地址欄
        if (id === activeTabId) {
          setUrl(newUrl)
        }
        // 同時更新 tabs 陣列紀錄
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, url: newUrl } : t)))
      })
    )

    // 监听网页请求打开新窗口，创建新标签页
    cleanups.push(
      window.api.onNewTabRequest(async ({ url: newUrl }) => {
        const newId = Date.now()
        const newTab = { id: newId, title: '加载中...', url: newUrl }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newId)
        await window.api.createTab(newId, newUrl)
      })
    )

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [activeTabId])

  return (
    <div className="container">
      {progress > 0 && (
        <div
          className="progressBar"
          style={{ width: `${progress}%` }} // 动态宽度保留行内样式，或完全用 state 控制类名
        />
      )}
      {/* 0. Info Bar */}
      <div
        className="info-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 15px',
          height: '30px',
          background: '#202124',
          borderBottom: '1px solid #333'
        }}
      >
        {currentTask && (
          <div
            className="no-drag-region"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#4caf50',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            <span style={{ fontSize: '14px' }}>📋</span>
            <span style={{ opacity: 0.8, color: '#9aa0a6', fontWeight: 'normal' }}>当前任务:</span>
            <span>{currentTask.name}</span>
            <button
              onClick={handleTaskLists}
              className="no-drag-region list-btn"
              style={{ margin: 0 }}
            >
              列表
            </button>
          </div>
        )}
        {currentUser ? (
          <div
            className="no-drag-region"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <button
              onClick={handleOnProfile}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '3px'
              }}
            >
              👤 {currentUser.name}
            </button>
            <button
              onClick={handleOnProfile}
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#aaa',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '3px'
              }}
            >
              个人中心
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#aaa',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '3px'
              }}
            >
              登出
            </button>
          </div>
        ) : (
          <button
            className="no-drag-region"
            onClick={handleOnLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              fontSize: '12px',
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            👤 登入
          </button>
        )}
      </div>

      {/* 1. TabBar */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => {
              switchTab(tab.id)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}
            >
              {tab.title}
            </span>
            {/* 关闭按钮 */}
            <span
              className="close-icon"
              onClick={(e) => removeTab(e, tab.id)}
              style={{ fontSize: '14px', opacity: 0.6 }}
            >
              ×
            </span>
          </div>
        ))}
        <button className="add-btn" onClick={addTab}>
          +
        </button>
        <div
          className="no-drag-region"
          style={{
            marginLeft: 'auto',
            paddingRight: '15px',
            display: 'flex',
            gap: '8px',
            paddingBottom: '8px',
            alignItems: 'center'
          }}
        >
          <button className="nav-btn" title="后退" onClick={() => window.api.goBack(activeTabId)}>
            ◀
          </button>
          <button
            className="nav-btn"
            title="前进"
            onClick={() => window.api.goForward(activeTabId)}
          >
            ▶
          </button>
          <button
            className="nav-btn"
            title="重新加载"
            onClick={() => window.api.refreshTab(activeTabId)}
          >
            ↻
          </button>
        </div>
      </div>
      <header className="header">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGo()}
          className="urlInput"
        />
        <button onClick={handleGo} className="button goButton">
          前往
        </button>
        <button onClick={handleCapture} disabled={isCapturing} className="button captureButton">
          📸 截图
        </button>
        {!isRecording ? (
          <button onClick={startGlobalRecording} className="button recordButton">
            🎥 录屏
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                color: '#ff4d4f',
                fontWeight: 'bold',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ff4d4f',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'pulse 1s infinite'
                }}
              />
              {formatTime(recordingTime)}
            </div>
            <button
              onClick={stopGlobalRecording}
              className="button"
              style={{ background: '#fff', color: 'red' }}
            >
              ⏹ 停止
            </button>
          </div>
        )}
        <button onClick={handleEvidence} className="button captureButton">
          🔒 固证
        </button>
      </header>
      {/* 這裡下方會留白，由主進程把 BrowserView 疊加上去 */}
      <div id="browser-container" style={{ flex: 1, position: 'relative' }}>
        {tabs.find((t) => t.id === activeTabId)?.url?.includes('about:blank') && (
          <div className="home-box">
            <Home onNewTask={handleOpenModal} onTaskLists={handleTaskLists} />
          </div>
        )}
      </div>
      {showModal && <NewTaskModal onSave={handleSaveTask} onCancel={() => setShowModal(false)} />}
      {showTaskListModal && (
        <TaskListModal
          tasks={taskList}
          onClose={() => setShowTaskListModal(false)}
          onSelect={(task) => {
            setCurrentTask(task)
            setShowTaskListModal(false)
          }}
          onDelete={handleDeleteTask}
        />
      )}
      {showLoginModal && (
        <LoginModal onLogin={handleLogin} onCancel={() => setShowLoginModal(false)} />
      )}
      {showProfileModal && currentUser && (
        <ProfileModal user={currentUser} onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  )
}

export default App

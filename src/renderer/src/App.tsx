import { useEffect, useState, useRef } from 'react'
import Home from './components/Home'
import NewTaskModal from './components/NewTaskModal'

function App() {
  const [url, setUrl] = useState('about:blank')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)

  //标签页
  const [tabs, setTabs] = useState([{ id: 1, title: '新标签页', url: 'about:blank' }]);
  const [activeTabId, setActiveTabId] = useState(1);

  const addTab = async () => {
    const newId = Date.now()
    const newTab = { id: newId, title: '新标签页', url: 'about:blank' }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(newId)

    window.api.createTab(newId, newTab.url)    
  }

  const switchTab = async (id: number) => {
    // 1. 先切換 React 介面上的標籤選中狀態（讓使用者立刻看到點擊回饋）
    setActiveTabId(id)

    try {
      // 2. 等待主進程完成 View 的邊界調整與顯示
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

  const removeTab = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() // 防止觸發 switchTab 事件

    // 1. 通知主進程銷毀 View
    await window.api.removeTab(id)

    // 2. 更新 React 狀態
    const newTabs = tabs.filter(t => t.id !== id)
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
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([])

  const startGlobalRecording = async () => {
    const sources = await window.api.getSources();
    const source = sources[0]; // 選擇整個視窗作為來源

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id // 關鍵：錄製的是「視窗」，切換分頁只是視窗內容變了，錄影不會斷
        }
      } as any
    });

    const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs=h264') 
      ? 'video/mp4; codecs=h264' 
      : 'video/webm; codecs=vp9';

    const recorder = new MediaRecorder(stream, { 
      mimeType: mimeType,
      videoBitsPerSecond: 5000000 
    });
    
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      const buffer = await blob.arrayBuffer()
      
      await window.api.saveVideo({
        buffer,
        mimeType: recorder.mimeType // 例如: "video/mp4; codecs=h264"
      })
      stream.getTracks().forEach(track => track.stop()) // 關閉攝像頭訊號
    }

    recorder.start();
    setIsRecording(true);    
  };

  const stopGlobalRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleGo = async () => {
    if (!url || url.includes('about:blank')) return;
    
    // 传入当前选中的分页ID
    const result = await window.api.loadUrl(activeTabId, url);
    
    if (!result.success) {
      console.error('跳轉失敗:', result.message);
    }
  };


  //截图
  const handleCapture = async () => {
    setIsCapturing(true)
    try {
      const result = await window.api.capturePage()
      if (result.success) {
        alert('截图已保存！')
      }
    } catch (err) {
      console.error('截图失敗:', err)
    } finally {
      setIsCapturing(false)
    }
  }

  //新建任务
  const [showModal, setShowModal] = useState(false)
  const [taskList, setTaskList] = useState([])

  const handleOpenModal = () => {
    setShowModal(true)
  }

  const handleSaveTask = async (data: any) => {
    const result = await window.api.saveTask(data)
    if (result.success) {
      setShowModal(false)
      // 重新獲取列表
      const list = await window.api.getTasks()
      setTaskList(list)
    }
  }

  useEffect(() => {
    // 监听来自主进程的进度通知
    if (window.api?.onLoadingStatus) { 
      window.api.onLoadingStatus(({ loading, progress }) => {
        setLoading(loading)
        setProgress(progress)
        
        // 加载完成后隐藏进度条
        if (!loading) {
          setTimeout(() => setProgress(0), 1000)
        }
      })
    }

    window.api.onUpdateTitle(({ id, title }) => {
      setTabs((prevTabs) => {
        // 確保找到對應的 tab 並產生一個「全新」的物件，觸發 React 渲染
        return prevTabs.map((tab) => {
          if (tab.id === id) {
            return { ...tab, title: title }; // 展開舊 tab，覆寫新 title
          }
          return tab;
        });
      });
    });

    window.api.onUpdateUrl(({ id, url: newUrl }) => {
      // 只有當更新的是「目前正在看」的分頁時，才更新地址欄
      if (id === activeTabId) {
        setUrl(newUrl)
      }
      // 同時更新 tabs 陣列紀錄
      setTabs(prev => prev.map(t => t.id === id ? { ...t, url: newUrl } : t))
    })

  }, [activeTabId])

  return (
    <div className='container'>
       {progress > 0 && (
        <div 
          className='progressBar'
          style={{ width: `${progress}%` }} // 动态宽度保留行内样式，或完全用 state 控制类名
        />
      )}
      {/* 1. TabBar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => {
              switchTab(tab.id)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{tab.title}</span>
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
        <button className="add-btn" onClick={addTab}>+</button>
      </div>
      <header className='header'>
        <input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGo()}
          className='urlInput'
        />
        <button onClick={handleGo} className='button goButton'>前往</button>
        <button onClick={handleCapture} disabled={isCapturing} className='button captureButton'>📸 截图</button>
        {!isRecording ? (
          <button onClick={startGlobalRecording} className='button recordButton'>🎥 录屏</button>
        ) : (
          <button onClick={stopGlobalRecording} className='button' style={{ background: '#fff', color: 'red' }}>⏹ 停止</button>
        )}
      </header>
      {/* 這裡下方會留白，由主進程把 BrowserView 疊加上去 */}
      <div id="browser-container" style={{ flex: 1, position: 'relative' }}>
         {tabs.find(t => t.id === activeTabId)?.url?.includes('about:blank') && (
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 999, // 確保在最上層
              backgroundColor: '#1a1a1a' // 給一個背景色防止透明看穿到後台
            }}>
              <Home onNewTask={handleOpenModal} />
            </div>
          )}
      </div>
      {showModal && (
        <NewTaskModal 
          onSave={handleSaveTask} 
          onCancel={() => setShowModal(false)} />
      )}
    </div>    
  )
}

export default App
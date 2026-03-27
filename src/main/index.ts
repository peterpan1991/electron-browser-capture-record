import { desktopCapturer, app, shell, BrowserWindow, ipcMain, WebContentsView, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const TAB_BAR_HEIGHT = 38
  const HEADER_HEIGHT = 43
  const TOOLBAR_TOTAL_HEIGHT = TAB_BAR_HEIGHT + HEADER_HEIGHT

  const views = new Map<number, WebContentsView>()

  const view = new WebContentsView()
  mainWindow.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  views.set(1, view)
  view.webContents.loadURL('about:blank')

  ipcMain.handle('load-url', async (_event, id: number, targetUrl: string) => {
    const view = views.get(id); // 這裡的 views 是你存放分頁的 Map
    
    if (view) {
      try {
        // 規範化網址（如果沒輸入 https:// 幫他加上）
        let finalUrl = targetUrl;
        if (!/^https?:\/\//i.test(targetUrl)) {
          finalUrl = 'https://' + targetUrl;
        }
        
        // 先隱藏其他視圖，再顯示當前視圖（在 loadURL 之前，避免 Home 消失後露出背景）
        views.forEach((v) => v.setBounds({ x: 0, y: 0, width: 0, height: 0 }));
        const { width, height } = mainWindow.getContentBounds()
        view.setBounds({ 
          x: 0, 
          y: TOOLBAR_TOTAL_HEIGHT, 
          width: width, 
          height: height - TOOLBAR_TOTAL_HEIGHT 
        })

        await view.webContents.loadURL(finalUrl);
        return { success: true };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
    
    return { success: false, message: '找不到对应的分页视图' };
  });

  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('loading-status', { loading: true, progress: 30 })
  })

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('loading-status', { loading: false, progress: 100 })
  })

  view.webContents.on('dom-ready', () => {
    mainWindow.webContents.send('loading-status', { loading: true, progress: 70 })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 封裝一個更新大小的函式（更新當前可見的視圖）
  const updateViewBounds = () => {
    const { width, height } = mainWindow.getContentBounds()
    views.forEach((v) => {
      const url = v.webContents.getURL()
      if (url !== 'about:blank' && url !== '') {
        v.setBounds({
          x: 0,
          y: TOOLBAR_TOTAL_HEIGHT,
          width: width,
          height: height - TOOLBAR_TOTAL_HEIGHT
        })
      }
    })
  }

  // 當視窗大小改變時，同步更新
  mainWindow.on('resize', () => {
    updateViewBounds()
  })

  ipcMain.handle('capture-page', async () => {
    
    const image = await view.webContents.capturePage()
    const png = image.toPNG() // 轉為 PNG 格式的 Buffer

    // 弹出保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: '存储截图',
      defaultPath: path.join(app.getPath('downloads'), `screenshot-${Date.now()}.png`),
      filters: [{ name: 'Images', extensions: ['png'] }]
    })

    if (filePath) {
      fs.writeFileSync(filePath, png)
      // 儲存後自動開啟該資料夾並選中檔案
      shell.showItemInFolder(filePath)
      return { success: true, path: filePath }
    }
    
    return { success: false }
  })

  ipcMain.handle('get-sources', async () => {
    // 獲取所有視窗與螢幕來源
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
    // 找到你目前的 Electron 視窗（或是直接回傳第一個螢幕）
    return sources.map(source => ({
      id: source.id,
      name: source.name
    }))
  })

  ipcMain.handle('save-video', async (_, {buffer, mimeType}) => {
    const isMp4 = mimeType.includes('video/mp4')
    const ext = isMp4 ? 'mp4' : 'webm'

    // 弹出保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: '存储视频',
      defaultPath: path.join(app.getPath('downloads'), `video-${Date.now()}.${ext}`),
      filters: [{ name: 'Videos', extensions: [ext] }]
    })

    if (filePath) {
      fs.writeFileSync(filePath, Buffer.from(buffer))
      // 儲存後自動開啟該資料夾並選中檔案
      shell.showItemInFolder(filePath)
      return { success: true, path: filePath }
    }
    
    return { success: false }
  })

  ipcMain.handle('create-tab', async (_event, id: number, url: string = 'about:blank') => {
    try {
      const view = new WebContentsView()
      views.set(id, view)

      view.webContents.on('page-title-updated', (_e, title) => {
        mainWindow.webContents.send('update-tab-title', { id, title })
      })

      view.webContents.on('did-navigate', (_e, newUrl) => {
        mainWindow.webContents.send('update-tab-url', { id, url: newUrl })
      })

      view.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('loading-status', { loading: true, progress: 30 })
      })

      view.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('loading-status', { loading: false, progress: 100 })
      })

      view.webContents.on('dom-ready', () => {
        mainWindow.webContents.send('loading-status', { loading: true, progress: 70 })
      })

      mainWindow.contentView.addChildView(view)
      
      // 等待網頁開始加載（或直接加載）
      view.webContents.loadURL(url)
      
      // 建立後自動執行顯示邏輯
      showView(id) 

      return { success: true }
    } catch (error: any) {
      console.error('建立分页失败:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('switch-tab', async (_event, id: number) => {
    if (views.has(id)) {
      showView(id)
      return { success: true }
    }
    return { success: false, message: '找不到該分頁' }
  })

  function showView(id: number) {
    const targetView = views.get(id);
    if (!targetView) return;

    // 隱藏舊的，顯示新的。錄製視窗的 MediaRecorder 會無縫拍到新的 View
    views.forEach((v) => v.setBounds({ x: 0, y: 0, width: 0, height: 0 }));

    const url = targetView.webContents.getURL()
    if (url === 'about:blank' || url === '') {
      targetView.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      return
    }
    
    const { width, height } = mainWindow.getContentBounds()
    
    // 立即設定正確的大小
    targetView.setBounds({ 
      x: 0, 
      y: TOOLBAR_TOTAL_HEIGHT, 
      width: width, 
      height: height - TOOLBAR_TOTAL_HEIGHT 
    })
  }

  // 在建立 view 時加入：
  view.webContents.setWindowOpenHandler(({ url }) => {
    // 通知 React 增加一個 Tab
    mainWindow.webContents.send('new-tab-request', url)
    // 回傳 deny 阻止 Electron 彈出新視窗
    return { action: 'deny' }
  })

  ipcMain.handle('get-tab-url', (_event, id: number) => {
    const view = views.get(id)
    return view ? view.webContents.getURL() : ''
  })

  ipcMain.handle('remove-tab', async (_event, id: number) => {
    const view = views.get(id)
    if (view) {
      // 1. 從視窗中移除
      mainWindow.contentView.removeChildView(view)
      // 2. 銷毀內容（釋放記憶體）
      // @ts-ignore (新版 Electron API 可能需要直接呼叫 webContents.destroy)
      view.webContents.destroy() 
      // 3. 從 Map 中刪除
      views.delete(id)
      return { success: true }
    }
    return { success: false }
  })

  // 存放任務的簡單陣列 (正式開發建議用 electron-store)
  let tasks: any[] = [] 

  // 1. 讓使用者選取資料夾
  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return canceled ? null : filePaths[0]
  })

  // 2. 儲存新任務
  ipcMain.handle('save-task', async (_event, taskData) => {
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: Date.now()
    }
    tasks.push(newTask)
    // 這裡可以 fs.writeFileSync 存到本地 JSON 檔案實現持久化
    return { success: true, task: newTask }
  })

  // 3. 獲取所有任務
  ipcMain.handle('get-tasks', () => tasks)

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

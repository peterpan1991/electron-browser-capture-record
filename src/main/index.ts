import {
  desktopCapturer,
  app,
  shell,
  BrowserWindow,
  ipcMain,
  WebContentsView,
  dialog
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'
import smCrypto from 'sm-crypto'
import archiver from 'archiver'
import { Task } from '../shared/types'
import {
  loginAPI,
  authManager,
  userAPI,
  ApiResponse,
  LoginResponse,
  User,
  evidenceAPI,
  EvidenceRecord,
  balanceAPI,
  BalanceRecord,
  EvidenceUploadResult,
  EvidenceCreateParams,
  UploadRecord
} from './services/api'

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

  const INFO_BAR_HEIGHT = 30
  const TAB_BAR_HEIGHT = 38
  const HEADER_HEIGHT = 43
  const TOOLBAR_TOTAL_HEIGHT = INFO_BAR_HEIGHT + TAB_BAR_HEIGHT + HEADER_HEIGHT

  const views = new Map<number, WebContentsView>()
  let activeTabId = 1

  ipcMain.handle('load-url', async (_event, id: number, targetUrl: string) => {
    const view = views.get(id) // 這裡的 views 是你存放分頁的 Map

    if (view) {
      try {
        // 規範化網址（如果沒輸入 https:// 幫他加上）
        let finalUrl = targetUrl
        if (!/^https?:\/\//i.test(targetUrl)) {
          finalUrl = 'https://' + targetUrl
        }

        activeTabId = id
        updateViewBounds()

        await view.webContents.loadURL(finalUrl)
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    }

    return { success: false, message: '找不到对应的分页视图' }
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
  const updateViewBounds = (): void => {
    const { width, height } = mainWindow.getContentBounds()
    views.forEach((v, id) => {
      if (id === activeTabId) {
        const url = v.webContents.getURL()
        if (url !== 'about:blank' && url !== '') {
          v.setBounds({
            x: 0,
            y: TOOLBAR_TOTAL_HEIGHT,
            width: width,
            height: height - TOOLBAR_TOTAL_HEIGHT
          })
        } else {
          v.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        }
      } else {
        v.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      }
    })
  }

  // 當視窗大小改變時，同步更新
  mainWindow.on('resize', () => {
    updateViewBounds()
  })

  ipcMain.handle('capture-page', async (_event, id: number, taskSavePath?: string) => {
    const targetView = views.get(id)
    if (!targetView) {
      return { success: false, message: '找不到对应的分页视图' }
    }

    const image = await targetView.webContents.capturePage()
    const png = image.toPNG()

    if (png.length === 0) {
      return { success: false, message: '截图失败：捕获到的画面为空' }
    }

    let filePath: string | undefined = undefined

    if (taskSavePath && fs.existsSync(taskSavePath)) {
      filePath = path.join(taskSavePath, `screenshot-${Date.now()}.png`)
    } else {
      // 弹出保存对话框
      const result = await dialog.showSaveDialog({
        title: '存储截图',
        defaultPath: path.join(app.getPath('downloads'), `screenshot-${Date.now()}.png`),
        filters: [{ name: 'Images', extensions: ['png'] }]
      })
      filePath = result.filePath
    }

    if (filePath) {
      // 計算 SM3 哈希
      const hash = smCrypto.sm3(png)

      fs.writeFileSync(filePath, png)

      // 寫入 hash.csv
      const csvPath = path.join(path.dirname(filePath), 'hash.csv')
      const fileName = path.basename(filePath)
      const csvLine = `${fileName},${hash}\n`
      fs.appendFileSync(csvPath, csvLine)

      // 儲存後自動開啟該資料夾並選中檔案
      shell.showItemInFolder(filePath)
      return { success: true, path: filePath, hash }
    }

    return { success: false }
  })

  ipcMain.handle('get-sources', async () => {
    // 獲取所有視窗與螢幕來源
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
    // 找到你目前的 Electron 視窗（或是直接回傳第一個螢幕）
    return sources.map((source) => ({
      id: source.id,
      name: source.name
    }))
  })

  ipcMain.handle('save-video', async (_, { buffer, mimeType, savePath: taskSavePath }) => {
    const isMp4 = mimeType.includes('video/mp4')
    const ext = isMp4 ? 'mp4' : 'webm'

    let filePath: string | undefined = undefined

    if (taskSavePath && fs.existsSync(taskSavePath)) {
      filePath = path.join(taskSavePath, `video-${Date.now()}.${ext}`)
    } else {
      // 弹出保存对话框
      const result = await dialog.showSaveDialog({
        title: '存储视频',
        defaultPath: path.join(app.getPath('downloads'), `video-${Date.now()}.${ext}`),
        filters: [{ name: 'Videos', extensions: [ext] }]
      })
      filePath = result.filePath
    }

    if (filePath) {
      const fileBuffer = Buffer.from(buffer)
      fs.writeFileSync(filePath, fileBuffer)

      // 計算 SM3 哈希
      const hash = smCrypto.sm3(fileBuffer)

      // 寫入 hash.csv
      const csvPath = path.join(path.dirname(filePath), 'hash.csv')
      const fileName = path.basename(filePath)
      const csvLine = `${fileName},${hash}\n`
      fs.appendFileSync(csvPath, csvLine)

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
        updateViewBounds() // 重要：導航到 about:blank 時需要隱藏視圖，顯示 Home
      })

      view.webContents.on('did-navigate-in-page', (_e, newUrl) => {
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

      // 网页请求打开新窗口时，通知渲染进程创建新标签页
      view.webContents.setWindowOpenHandler(({ url }) => {
        mainWindow.webContents.send('new-tab-request', { url })
        return { action: 'deny' }
      })

      mainWindow.contentView.addChildView(view)

      // 等待網頁開始加載（或直接加載）
      view.webContents.loadURL(url)

      // 建立後自動執行顯示邏輯
      showView(id)

      return { success: true }
    } catch (error) {
      console.error('建立分页失败:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('switch-tab', (_event, id: number) => {
    if (views.has(id)) {
      activeTabId = id
      updateViewBounds()
      return { success: true }
    }
    return { success: false, message: '找不到該分頁' }
  })

  function showView(id: number): void {
    activeTabId = id
    updateViewBounds()
  }

  ipcMain.handle('get-tab-url', (_event, id: number) => {
    const view = views.get(id)
    return view ? view.webContents.getURL() : ''
  })

  ipcMain.handle('remove-tab', async (_event, id: number) => {
    const view = views.get(id)
    if (view) {
      mainWindow.contentView.removeChildView(view)
      // 2. 銷毀內容
      // @ts-ignore: Method might not be available in current typings
      view.webContents.destroy()
      // 3. 從 Map 中刪除
      views.delete(id)
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('go-back', async (_event, id: number) => {
    const view = views.get(id)
    if (view && view.webContents.navigationHistory.canGoBack()) {
      activeTabId = id
      view.webContents.navigationHistory.goBack()
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('go-forward', async (_event, id: number) => {
    const view = views.get(id)
    if (view && view.webContents.navigationHistory.canGoForward()) {
      activeTabId = id
      view.webContents.navigationHistory.goForward()
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('refresh-tab', async (_event, id: number) => {
    const view = views.get(id)
    if (view) {
      view.webContents.reload()
      return { success: true }
    }
    return { success: false }
  })

  // 存放任務的 JSON 檔案路徑
  const tasksPath = path.join(app.getPath('userData'), 'tasks.json')

  // 存放任務的簡單陣列
  const tasks: Task[] = []

  // 啟動時從本地載入現有任務
  if (fs.existsSync(tasksPath)) {
    try {
      const savedTasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'))
      if (Array.isArray(savedTasks)) {
        tasks.push(...savedTasks)
      }
    } catch (err) {
      console.error('載入任務失敗:', err)
    }
  }

  // 1. 讓使用者選取資料夾
  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return canceled ? null : filePaths[0]
  })

  // 讓使用者選擇多個文件
  ipcMain.handle('select-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg','mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
        { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'] },
      ]
    })
    return canceled ? [] : filePaths
  })

  // 打包文件为 ZIP 并计算 hash
  ipcMain.handle('package-files', async (_event, filePaths: string[], savePath: string) => {
    return new Promise((resolve) => {
      const zipFileName = `evidence-${Date.now()}.zip`
      const zipPath = path.join(savePath, zipFileName)
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => {
        const zipSize = archive.pointer()
        const zipBuffer = fs.readFileSync(zipPath)
        const hash = smCrypto.sm3(zipBuffer)

        // 写入 hash.csv
        const csvPath = path.join(savePath, 'hash.csv')
        const csvLine = `${zipFileName},${hash}\n`
        fs.appendFileSync(csvPath, csvLine)

        resolve({
          success: true,
          fileCount: filePaths.length,
          fileSize: zipSize,
          hash,
          zipPath: zipPath
        })
      })

      archive.on('error', (err) => {
        console.error('打包失败:', err)
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath)
        }
        resolve({ success: false, message: err.message })
      })

      archive.pipe(output)

      for (const filePath of filePaths) {
        const fileName = path.basename(filePath)
        archive.file(filePath, { name: fileName })
      }

      archive.finalize()
    })
  })

  // 2. 儲存新任務
  ipcMain.handle('save-task', async (_event, taskData) => {
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: Date.now()
    }
    tasks.push(newTask)

    // 儲存到本地 JSON 檔案
    try {
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8')
    } catch (err) {
      console.error('儲存任務失敗:', err)
    }

    return { success: true, task: newTask }
  })

  // 3. 獲取所有任務
  ipcMain.handle('get-tasks', () => tasks)

  // 4. 刪除任務
  ipcMain.handle('delete-task', async (_event, id: string) => {
    const index = tasks.findIndex((t) => t.id === id)
    if (index !== -1) {
      tasks.splice(index, 1)
      try {
        fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8')
        return { success: true }
      } catch (err) {
        console.error('刪除任務失敗:', err)
        return { success: false, error: String(err) }
      }
    }
    return { success: false, error: '找不到該任務' }
  })

  // ========== API 相关 IPC 处理器 ==========

  // 登录
  ipcMain.handle(
    'api:login',
    async (_event, email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
      return await loginAPI.login(email, password)
    }
  )

  // 登出
  ipcMain.handle('api:logout', async (): Promise<ApiResponse> => {
    return await loginAPI.logout()
  })

  // 获取用户信息
  ipcMain.handle('api:get-user', (): User | null => {
    return authManager.getUser()
  })

  // 从后端获取用户信息
  ipcMain.handle('api:get-user-info', async (): Promise<ApiResponse<{ user: User }>> => {
    return await userAPI.getUserInfo()
  })

  // 检查是否已登录
  ipcMain.handle('api:is-authenticated', (): boolean => {
    return authManager.isAuthenticated()
  })

  // 创建固证记录
  ipcMain.handle(
    'api:evidence-create',
    async (
      _event,
      params: EvidenceCreateParams
    ): Promise<ApiResponse> => {
      return await evidenceAPI.create(params)
    }
  )

  ipcMain.handle(
    'api:evidence-upload',
    async (_event, filePath: string): Promise<ApiResponse<EvidenceUploadResult>> => {
      return await evidenceAPI.upload(filePath)
    }
  )

  ipcMain.handle('api:evidence-list', async (_event, page: number = 1, perPage: number = 10): Promise<ApiResponse<{ list: EvidenceRecord[]; total: number }>> => {
    return await evidenceAPI.list(page, perPage)
  })

  ipcMain.handle('api:evidence-upload-list', async (_event, page: number = 1, perPage: number = 10): Promise<ApiResponse<{ list: UploadRecord[]; total: number }>> => {
    return await evidenceAPI.uploadList(page, perPage)
  })

  ipcMain.handle('api:evidence-certificate-apply', async (_event, id: number): Promise<ApiResponse> => {
    return await evidenceAPI.applyCertificate(id)
  })

  ipcMain.handle('api:balance-list', async (_event, page: number = 1, perPage: number = 10): Promise<ApiResponse<{ list: BalanceRecord[]; total: number; balance: string }>> => {
    return await balanceAPI.list(page, perPage)
  })

  ipcMain.handle('api:query-block-chain', async (_event, id: number): Promise<ApiResponse> => {
    return await evidenceAPI.queryBlockChain(id)
  })

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

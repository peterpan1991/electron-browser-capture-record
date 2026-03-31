import { useState, ReactElement } from 'react'

interface NewTaskModalProps {
  onSave: (data: { name: string; savePath: string }) => void
  onCancel: () => void
}

export default function NewTaskModal({ onSave, onCancel }: NewTaskModalProps): ReactElement {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')

  const handleSelectPath = async (): Promise<void> => {
    const selectedPath = await window.api.selectDirectory()
    if (selectedPath) setPath(selectedPath)
  }

  return (
    <div
      style={{
        position: 'fixed', // 固定定位
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.7)', // 半透明遮罩
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}
    >
      <div style={{ background: '#333', padding: '20px', borderRadius: '8px', width: '400px' }}>
        <h3>新建任务</h3>
        <input
          placeholder="任务名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
          <input placeholder="存储路径" value={path} readOnly style={{ flex: 1 }} />
          <button onClick={handleSelectPath}>选择</button>
        </div>
        <button onClick={() => onSave({ name, savePath: path })} disabled={!name || !path}>
          确认保存
        </button>
        <button onClick={onCancel} style={{ marginLeft: '10px' }}>
          取消
        </button>
      </div>
    </div>
  )
}

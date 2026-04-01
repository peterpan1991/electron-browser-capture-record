import { ReactElement } from 'react'
import { Task } from '../../../shared/types'

interface TaskListModalProps {
  tasks: Task[]
  onClose: () => void
  onSelect: (task: Task) => void
  onDelete: (id: string) => void
}

export default function TaskListModal({
  tasks,
  onClose,
  onSelect,
  onDelete
}: TaskListModalProps): ReactElement {
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
          padding: '20px',
          borderRadius: '8px',
          width: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >
          <h3 style={{ margin: 0 }}>任务列表</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>暂无任务</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>名称</th>
                  <th style={{ padding: '10px' }}>保存路径</th>
                  <th style={{ padding: '10px' }}>创建時間</th>
                  <th style={{ padding: '10px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid #444' }}>
                    <td style={{ padding: '10px' }}>{task.name}</td>
                    <td style={{ padding: '10px', color: '#aaa', fontSize: '12px' }}>
                      {task.savePath}
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      {new Date(task.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => onSelect(task)}
                        style={{
                          background: '#4caf50',
                          border: 'none',
                          color: 'white',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        选择
                      </button>
                      <button
                        onClick={() => onDelete(task.id)}
                        style={{
                          background: '#f44336',
                          border: 'none',
                          color: 'white',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '20px',
            padding: '10px',
            background: '#444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          关闭
        </button>
      </div>
    </div>
  )
}

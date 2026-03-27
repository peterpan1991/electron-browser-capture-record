// src/renderer/src/components/Home.tsx
interface HomeProps {
  onNewTask: () => void;
}

function Home({ onNewTask }: HomeProps) {
  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100%', color: 'white' 
    }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛡️</div> {/* Logo 佔位 */}
      <h1 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>欢迎使用网证</h1>
      <p style={{ color: '#888', marginBottom: '30px' }}>可以对互联网上的任意网页进行固定</p>
      
      <div style={{ display: 'flex', gap: '15px' }}>
        <button 
          style={{ padding: '10px 20px', backgroundColor: '#007bff', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
           onClick={onNewTask}
        >
          新建任务
        </button>
        <button 
          style={{ padding: '10px 20px', backgroundColor: '#333', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
        >
          任务列表
        </button>
      </div>
    </div>
  )
}

export default Home

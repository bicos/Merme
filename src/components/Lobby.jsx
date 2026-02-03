import { useState } from 'react'

const GENRES = [
  { id: 'mansion', name: '저택 미스터리', icon: '🏰', desc: '클래식 추리' },
  { id: 'noir', name: '느와르', icon: '🎬', desc: '1940년대 범죄' },
  { id: 'scifi', name: 'SF', icon: '🚀', desc: '우주 스릴러' },
  { id: 'oriental', name: '사극', icon: '🏯', desc: '동양 미스터리' },
  { id: 'random', name: '랜덤', icon: '🎲', desc: '무작위 선택' }
]

const DURATIONS = [
  { value: 30, label: '30분', desc: '빠른 게임' },
  { value: 60, label: '1시간', desc: '표준 게임' },
  { value: 120, label: '2시간', desc: '심화 게임' }
]

export default function Lobby({ onCreateRoom, onJoinRoom, isMultiplayer }) {
  const [mode, setMode] = useState(null) // null, 'create', 'join'
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState(4)
  const [genre, setGenre] = useState('random')
  const [duration, setDuration] = useState(60)

  const handleCreate = () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요!')
      return
    }
    onCreateRoom(nickname, { players, genre, duration })
  }

  const handleJoin = () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요!')
      return
    }
    if (!roomCode.trim()) {
      alert('방 코드를 입력해주세요!')
      return
    }
    onJoinRoom(nickname, roomCode.toUpperCase())
  }

  if (!mode) {
    return (
      <div className="lobby">
        <div className="lobby-logo">
          <div className="icon">🔍</div>
          <h1>Murder Mystery</h1>
          <p>AI가 만드는 멀티플레이어 추리 게임</p>
        </div>

        <div className="card lobby-card">
          <h2>게임 시작</h2>
          
          <div className="lobby-form">
            <div className="form-group">
              <label className="label">닉네임</label>
              <input
                type="text"
                className="input"
                placeholder="당신의 이름은?"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setMode('create')}
                style={{ flex: 1 }}
              >
                🏠 방 만들기
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setMode('join')}
                style={{ flex: 1 }}
              >
                🚪 참가하기
              </button>
            </div>
          </div>
        </div>

        <p style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
          © 2026 Murder Mystery by ravy & Director
        </p>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="lobby">
        <div className="lobby-logo">
          <div className="icon">🚪</div>
          <h1>방 참가</h1>
          <p>호스트에게 받은 코드를 입력하세요</p>
        </div>

        <div className="card lobby-card">
          <div className="lobby-form">
            <div className="form-group">
              <label className="label">닉네임</label>
              <input
                type="text"
                className="input"
                placeholder="당신의 이름은?"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
              />
            </div>

            <div className="form-group">
              <label className="label">방 코드</label>
              <input
                type="text"
                className="input"
                placeholder="예: ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ 
                  textTransform: 'uppercase',
                  letterSpacing: '4px',
                  fontSize: '24px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setMode(null)}
                style={{ flex: 1 }}
              >
                ← 뒤로
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleJoin}
                style={{ flex: 1 }}
              >
                참가하기
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby">
      <div className="lobby-logo">
        <div className="icon">🏠</div>
        <h1>방 만들기</h1>
        <p>게임 설정을 선택하세요</p>
      </div>

      <div className="card lobby-card">
        <div className="lobby-form">
          <div className="form-group">
            <label className="label">닉네임</label>
            <input
              type="text"
              className="input"
              placeholder="당신의 이름은?"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
            />
          </div>

          {/* 인원 수 */}
          <div className="form-group">
            <label className="label">참가 인원: {players}명</label>
            <input
              type="range"
              min="3"
              max="9"
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--accent-red)'
              }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <span>3명</span>
              <span>9명</span>
            </div>
          </div>

          {/* 장르 선택 */}
          <div className="form-group">
            <label className="label">장르</label>
            <div className="option-grid">
              {GENRES.map(g => (
                <div
                  key={g.id}
                  className={`option-card ${genre === g.id ? 'selected' : ''}`}
                  onClick={() => setGenre(g.id)}
                >
                  <div className="icon">{g.icon}</div>
                  <div className="label">{g.name}</div>
                  <div className="desc">{g.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 플레이 시간 */}
          <div className="form-group">
            <label className="label">플레이 시간</label>
            <div className="option-grid">
              {DURATIONS.map(d => (
                <div
                  key={d.value}
                  className={`option-card ${duration === d.value ? 'selected' : ''}`}
                  onClick={() => setDuration(d.value)}
                >
                  <div className="icon">⏱️</div>
                  <div className="label">{d.label}</div>
                  <div className="desc">{d.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setMode(null)}
              style={{ flex: 1 }}
            >
              ← 뒤로
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCreate}
              style={{ flex: 1 }}
            >
              🎭 방 만들기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

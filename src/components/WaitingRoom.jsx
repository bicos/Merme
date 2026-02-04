export default function WaitingRoom({ roomCode, room, playerInfo, onStartGame, onLeave, socketId, onDestroyRoom }) {
  console.log('[WaitingRoom] Rendered with:', { roomCode, room, playerInfo, socketId })

  // Null guard: room 데이터가 없으면 로딩 표시
  if (!room || !room.settings || !room.players) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div>대기실을 불러오는 중...</div>
      </div>
    )
  }

  const isHost = room.host === socketId
  const currentPlayers = room.players.length
  const maxPlayers = room.settings.players
  const canStart = currentPlayers === maxPlayers

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    alert('방 코드가 복사되었습니다!')
  }

  return (
    <div className="lobby">
      <div className="lobby-logo">
        <div className="icon">⏳</div>
        <h1>대기실</h1>
        <p>친구들이 모이면 게임을 시작하세요</p>
      </div>

      <div className="card lobby-card" style={{ maxWidth: '600px' }}>
        {/* 방 코드 */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>
            방 코드
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 'bold',
              letterSpacing: '8px',
              color: 'var(--accent-gold)',
              cursor: 'pointer'
            }}
            onClick={copyRoomCode}
            title="클릭해서 복사"
          >
            {roomCode}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
            클릭해서 복사 📋
          </div>
        </div>

        {/* 게임 설정 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <div className="header-badge">
            <span>👥</span>
            <span>{maxPlayers}명</span>
          </div>
          <div className="header-badge">
            <span>🎭</span>
            <span>{room.settings.genre === 'random' ? '랜덤' : room.settings.genre}</span>
          </div>
          <div className="header-badge">
            <span>⏱️</span>
            <span>{room.settings.duration}분</span>
          </div>
        </div>

        {/* 플레이어 목록 */}
        <div style={{ marginBottom: '24px' }}>
          <div className="sidebar-title" style={{ marginBottom: '16px' }}>
            참가자 ({currentPlayers}/{maxPlayers})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {room.players.map((player, index) => (
              <div
                key={player.id}
                className="player-item"
                style={{
                  border: player.id === socketId ? '2px solid var(--accent-purple)' : undefined
                }}
              >
                <div className="player-avatar" style={{
                  background: player.isHost
                    ? 'linear-gradient(135deg, var(--accent-gold), #d97706)'
                    : undefined
                }}>
                  {player.isHost ? '👑' : index + 1}
                </div>
                <div className="player-info">
                  <div className="player-name">
                    {player.nickname}
                    {player.id === socketId && <span style={{ color: 'var(--accent-purple)', marginLeft: '8px' }}>(나)</span>}
                  </div>
                  <div className="player-role">
                    {player.isHost ? '호스트' : '참가자'}
                  </div>
                </div>
              </div>
            ))}

            {/* 빈 슬롯 */}
            {Array(maxPlayers - currentPlayers).fill(0).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="player-item"
                style={{ opacity: 0.3, border: '2px dashed var(--border)' }}
              >
                <div className="player-avatar" style={{ background: 'var(--bg-card)' }}>
                  ?
                </div>
                <div className="player-info">
                  <div className="player-name">대기 중...</div>
                  <div className="player-role">빈 자리</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 시작/나가기 버튼 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn"
            onClick={onLeave}
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)'
            }}
          >
            나가기
          </button>

          {isHost ? (
            <button
              className="btn btn-primary"
              onClick={onStartGame}
              disabled={!canStart}
              style={{
                flex: 2,
                opacity: canStart ? 1 : 0.5,
                cursor: canStart ? 'pointer' : 'not-allowed'
              }}
            >
              {canStart ? '🎭 게임 시작' : `👥 ${maxPlayers - currentPlayers}명 더 필요`}
            </button>
          ) : (
            <div style={{
              flex: 2,
              textAlign: 'center',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              color: 'var(--text-secondary)'
            }}>
              호스트 대기 중...
            </div>
          )}
        </div>

        {/* 호스트 전용: 방 폭파 버튼 */}
        {isHost && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-ghost"
              onClick={onDestroyRoom}
              style={{ color: 'var(--text-muted)', fontSize: '12px' }}
            >
              방 폭파 (게임 종료) 💥
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

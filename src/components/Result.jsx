export default function Result({ data, onRestart, isMultiplayer }) {
  const result = isMultiplayer ? data.result : data.result
  
  if (!result) return null

  const { success, murderer, murdererCharacter, accusedCharacter, motive, method, players, voteCount } = 
    isMultiplayer 
      ? result 
      : { 
          success: result.success, 
          murderer: result.murderer,
          murdererCharacter: result.murderer,
          accusedCharacter: result.voted,
          motive: data.scenario?.motive,
          method: data.scenario?.method
        }

  return (
    <div className="result-container">
      <div className="result-icon">
        {success ? '🎉' : '💀'}
      </div>
      
      <h1 className="result-title">
        {success ? '사건 해결!' : '범인 탈출...'}
      </h1>
      
      <p className="result-subtitle">
        {success 
          ? '축하합니다! 진범을 찾아냈습니다!' 
          : '안타깝게도 범인이 빠져나갔습니다...'}
      </p>

      <div className="card" style={{ 
        maxWidth: '600px', 
        margin: '32px auto',
        textAlign: 'left'
      }}>
        {/* 투표 결과 (멀티플레이어) */}
        {isMultiplayer && voteCount && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--accent-gold)' }}>🗳️ 투표 결과</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(voteCount).map(([charIndex, count]) => {
                const char = data.scenario?.characters[charIndex] || result.players?.find(p => p.character)?.character
                return (
                  <div 
                    key={charIndex}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{data.result?.players?.find(p => p.characterIndex === parseInt(charIndex))?.character?.emoji || '👤'}</span>
                    <span style={{ flex: 1 }}>{data.result?.players?.find(p => p.characterIndex === parseInt(charIndex))?.character?.name || `캐릭터 ${charIndex}`}</span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: parseInt(charIndex) === result.murdererIndex ? 'var(--accent-red)' : 'var(--text-primary)'
                    }}>
                      {count}표
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 진범 공개 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-red)' }}>🔪 진범</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid var(--accent-red)',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '40px' }}>
              {murdererCharacter?.emoji || murderer?.emoji}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '18px' }}>
                {murdererCharacter?.name || murderer?.name}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {murdererCharacter?.role || murderer?.role}
              </div>
            </div>
          </div>
        </div>

        {/* 동기 & 수법 */}
        {(motive || method) && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--accent-purple)' }}>📋 사건의 진실</h3>
            
            {motive && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  동기
                </div>
                <div style={{ 
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  {motive}
                </div>
              </div>
            )}
            
            {method && (
              <div>
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  범행 수법
                </div>
                <div style={{ 
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  {method}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 플레이어 결과 (멀티플레이어) */}
        {isMultiplayer && players && (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'var(--accent-gold)' }}>👥 플레이어 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {players.map((player, i) => (
                <div 
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: player.wasMurderer ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-secondary)',
                    border: player.wasMurderer ? '1px solid var(--accent-red)' : 'none',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{player.character?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>
                      {player.character?.name}
                      {player.wasMurderer && <span style={{ color: 'var(--accent-red)', marginLeft: '8px' }}>🔪 범인</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      플레이어: {player.nickname}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={onRestart} style={{ marginTop: '24px' }}>
        🏠 로비로 돌아가기
      </button>
    </div>
  )
}

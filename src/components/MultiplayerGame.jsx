import { useState, useEffect, useRef } from 'react'

// 시스템 메시지 추가 함수
const createSystemMessage = (content) => ({
  id: `system-${Date.now()}`,
  type: 'system',
  content,
  isLocal: true,
  time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
})

export default function MultiplayerGame({
  gameData,
  playerInfo,
  onSendMessage,
  onInvestigateClue,
  onStartVoting,
  onCastVote,
  isVoting,
  socketId
}) {
  const [input, setInput] = useState('')
  const [selectedVote, setSelectedVote] = useState(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [localMessages, setLocalMessages] = useState([])
  const [selectedClue, setSelectedClue] = useState(null)
  const messagesEndRef = useRef(null)
  
  const { scenario, myCharacter, players, messages = [], votingProgress } = gameData

  // 모든 메시지 (서버 + 로컬)
  const allMessages = [...messages, ...localMessages].sort((a, b) => 
    new Date(a.time) - new Date(b.time)
  )

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages])

  // 로컬 시스템 메시지 추가
  const addLocalMessage = (content) => {
    setLocalMessages(prev => [...prev, createSystemMessage(content)])
  }

  // 슬래시 명령어 처리
  const handleCommand = (cmd) => {
    const parts = cmd.toLowerCase().trim().split(' ')
    const command = parts[0]
    const args = parts.slice(1)

    switch (command) {
      case '/h':
      case '/help':
      case '/도움':
        addLocalMessage(`📋 **사용 가능한 명령어**

🔍 **조사 명령어**
• \`/clue\` 또는 \`/단서\` - 모든 단서 목록 보기
• \`/clue [번호]\` - 특정 단서 상세 조사
• \`/investigate\` 또는 \`/조사\` - 새 단서 발견하기

👥 **정보 명령어**
• \`/players\` 또는 \`/참가자\` - 참가자 목록
• \`/me\` 또는 \`/나\` - 내 캐릭터 정보
• \`/scenario\` 또는 \`/시나리오\` - 사건 개요

🗳️ **투표 명령어**
• \`/vote\` 또는 \`/투표\` - 투표 상태 확인
• \`/startvote\` - 투표 시작 (호스트만)

💬 **채팅 명령어**
• \`/ooc [메시지]\` - 캐릭터가 아닌 본인으로 말하기

⚙️ **기타**
• \`/h\` 또는 \`/help\` - 이 도움말 보기`)
        return true

      case '/vote':
      case '/투표':
        if (isVoting) {
          addLocalMessage(`🗳️ **투표 진행 중!**

캐릭터를 선택하고 투표 버튼을 눌러주세요.
${votingProgress ? `현재 ${votingProgress.totalVotes}/${votingProgress.totalPlayers}명 투표 완료` : ''}`)
        } else {
          addLocalMessage(`🗳️ **투표 대기 중**

아직 투표가 시작되지 않았습니다.
${isHost ? '호스트로서 `/startvote` 명령어로 투표를 시작할 수 있습니다.' : '호스트가 투표를 시작하면 알림이 표시됩니다.'}

💡 투표 전에 충분히 단서를 조사하고 토론하세요!`)
        }
        return true

      case '/startvote':
      case '/투표시작':
        if (isHost) {
          onStartVoting()
          addLocalMessage(`🗳️ 투표를 시작합니다...`)
        } else {
          addLocalMessage(`❌ 호스트만 투표를 시작할 수 있습니다.`)
        }
        return true

      case '/clue':
      case '/단서':
        if (args.length > 0) {
          const clueNum = parseInt(args[0])
          const clue = scenario.clues.find(c => c.id === clueNum)
          if (clue) {
            if (clue.found) {
              addLocalMessage(`🔍 **단서 #${clue.id}: ${clue.icon} ${clue.name}**

📝 설명: ${clue.description}
${clue.relevance ? `💡 연관성: ${clue.relevance}` : ''}
👤 발견자: ${clue.foundBy || '알 수 없음'}`)
            } else {
              addLocalMessage(`❓ **단서 #${clueNum}**은 아직 발견되지 않았습니다.
\`/조사\` 명령어로 새 단서를 찾아보세요.`)
            }
          } else {
            addLocalMessage(`❌ 존재하지 않는 단서 번호입니다. (1-${scenario.clues.length})`)
          }
        } else {
          const foundClues = scenario.clues.filter(c => c.found)
          const unfoundCount = scenario.clues.length - foundClues.length
          
          let msg = `📋 **단서 현황** (${foundClues.length}/${scenario.clues.length})\n\n`
          
          if (foundClues.length > 0) {
            msg += `**발견된 단서:**\n`
            foundClues.forEach(c => {
              msg += `• #${c.id} ${c.icon} ${c.name} (by ${c.foundBy})\n`
            })
          }
          
          if (unfoundCount > 0) {
            msg += `\n❓ 미발견 단서: ${unfoundCount}개\n`
            msg += `\n💡 \`/clue [번호]\`로 상세 정보를 확인하세요.`
            msg += `\n💡 \`/조사\`로 새 단서를 발견하세요.`
          }
          
          addLocalMessage(msg)
        }
        return true

      case '/investigate':
      case '/조사':
        const unfound = scenario.clues.find(c => !c.found)
        if (unfound) {
          onInvestigateClue(unfound.id)
          addLocalMessage(`🔍 조사 중...`)
        } else {
          addLocalMessage(`✅ 모든 단서를 발견했습니다!`)
        }
        return true

      case '/players':
      case '/참가자':
        let playerMsg = `👥 **참가자 목록** (${players.length}명)\n\n`
        players.forEach((p, i) => {
          const isMe = p.id === socketId
          playerMsg += `${p.characterEmoji} **${p.characterName}** (${p.characterRole})`
          if (isMe) playerMsg += ` ← 나`
          playerMsg += `\n   └ 플레이어: ${p.nickname}\n`
        })
        addLocalMessage(playerMsg)
        return true

      case '/me':
      case '/나':
        addLocalMessage(`🎭 **내 캐릭터 정보**

${myCharacter.emoji} **${myCharacter.name}**
📋 역할: ${myCharacter.role}

🔒 **나만 아는 비밀:**
${myCharacter.secret}

${myCharacter.motive ? `⚠️ **동기:** ${myCharacter.motive}` : ''}

${myCharacter.isMurderer ? `\n🔪 **당신이 범인입니다!** 들키지 않도록 조심하세요.` : ''}`)
        return true

      case '/scenario':
      case '/시나리오':
        addLocalMessage(`📖 **${scenario.name}**

🏛️ 배경: ${scenario.setting}
💀 피해자: ${scenario.victim}

📜 **사건 개요:**
${scenario.background}`)
        return true

      case '/ooc':
        if (args.length > 0) {
          onSendMessage(args.join(' '), false)
        } else {
          addLocalMessage(`💡 사용법: \`/ooc [메시지]\` - 캐릭터가 아닌 본인으로 말하기`)
        }
        return true

      default:
        if (cmd.startsWith('/')) {
          addLocalMessage(`❌ 알 수 없는 명령어입니다. \`/h\`로 도움말을 확인하세요.`)
          return true
        }
        return false
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    
    // 슬래시 명령어 체크
    if (input.startsWith('/')) {
      handleCommand(input)
      setInput('')
      return
    }
    
    onSendMessage(input, true)
    setInput('')
  }

  const handleVote = () => {
    if (selectedVote === null) {
      alert('투표할 대상을 선택해주세요!')
      return
    }
    onCastVote(selectedVote)
    setHasVoted(true)
  }

  const isHost = players?.find(p => p.id === socketId)?.isHost

  if (isVoting) {
    return (
      <div className="vote-container">
        <h2 className="vote-title">🗳️ 범인을 지목하세요</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          수집한 단서와 증언을 바탕으로 범인을 추리하세요
        </p>
        
        {votingProgress && (
          <div style={{
            background: 'var(--bg-card)',
            padding: '12px 24px',
            borderRadius: '20px',
            marginBottom: '32px',
            display: 'inline-block'
          }}>
            투표 현황: {votingProgress.totalVotes} / {votingProgress.totalPlayers}
          </div>
        )}
        
        {!hasVoted ? (
          <>
            <div className="vote-grid">
              {scenario.characters.map((char, index) => (
                <div
                  key={index}
                  className={`vote-card ${selectedVote === index ? 'selected' : ''}`}
                  onClick={() => setSelectedVote(index)}
                >
                  <div className="vote-avatar">{char.emoji}</div>
                  <div className="vote-name">{char.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{char.role}</div>
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleVote}
              style={{ marginTop: '40px', padding: '16px 48px' }}
            >
              ⚖️ 투표하기
            </button>
          </>
        ) : (
          <div style={{
            background: 'var(--bg-card)',
            padding: '40px',
            borderRadius: '16px',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h3>투표 완료!</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              다른 플레이어들의 투표를 기다리는 중...
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="game-layout">
      <div className="game-main">
        {/* Header */}
        <div className="header">
          <div className="header-title">
            <span className="icon">🎭</span>
            <h1>{scenario.name}</h1>
          </div>
          <div className="header-info">
            <div className="header-badge">
              <span>👥</span>
              <span>{players?.length}명</span>
            </div>
            <div 
              className="header-badge" 
              style={{ cursor: 'pointer' }}
              onClick={() => handleCommand('/h')}
              title="도움말 보기"
            >
              <span>❓</span>
              <span>/h</span>
            </div>
            {isHost && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '14px' }}
                onClick={onStartVoting}
              >
                🗳️ 투표 시작
              </button>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="chat-container">
          <div className="chat-messages">
            {/* 게임 시작 메시지 */}
            <div className="message message-system">
              🎭 게임이 시작되었습니다! 당신은 <strong>{myCharacter.name}</strong> ({myCharacter.role}) 역할입니다.
              <br/>💡 <strong>/h</strong>를 입력하면 사용 가능한 명령어를 볼 수 있습니다.
            </div>
            
            <div className="message message-gm">
              <div className="message-header">
                <span className="message-author">🎭 GM</span>
              </div>
              <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                {scenario.background}
                {'\n\n'}
                피해자: <strong>{scenario.victim}</strong>
                {'\n'}
                배경: {scenario.setting}
              </div>
            </div>

            {allMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`message ${
                  msg.isLocal ? 'message-system' : 
                  msg.playerId === socketId ? 'message-player' : 'message-gm'
                }`}
                style={msg.isLocal ? { 
                  textAlign: 'left', 
                  maxWidth: '90%',
                  whiteSpace: 'pre-wrap'
                } : undefined}
              >
                {!msg.isLocal && (
                  <div className="message-header">
                    <span className="message-author">
                      {msg.asCharacter && msg.characterEmoji} {msg.asCharacter ? msg.characterName : `💬 ${msg.nickname}`}
                    </span>
                    <span className="message-time">{msg.time}</span>
                  </div>
                )}
                <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="input chat-input"
              placeholder={`메시지 또는 /h (도움말)...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="btn btn-primary" onClick={handleSend}>
              전송
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        {/* 내 캐릭터 */}
        <div className="sidebar-section">
          <div className="sidebar-title">내 캐릭터</div>
          <div 
            className="card" 
            style={{ padding: '16px', cursor: 'pointer' }}
            onClick={() => handleCommand('/me')}
            title="클릭해서 상세 정보 보기"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="player-avatar" style={{ fontSize: '20px' }}>
                {myCharacter.emoji}
              </div>
              <div>
                <div style={{ fontWeight: '600' }}>{myCharacter.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {myCharacter.role}
                </div>
              </div>
            </div>
            
            <div style={{ 
              padding: '12px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '8px'
            }}>
              <div style={{ color: 'var(--accent-red)', fontWeight: '600', marginBottom: '4px' }}>
                🔒 나만 아는 비밀
              </div>
              {myCharacter.secret}
            </div>

            {myCharacter.isMurderer && (
              <div style={{ 
                padding: '12px', 
                background: 'rgba(220, 38, 38, 0.2)', 
                border: '1px solid var(--accent-red)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--accent-red)'
              }}>
                ⚠️ 당신이 범인입니다! 들키지 마세요.
              </div>
            )}
          </div>
        </div>

        {/* 참가자 목록 */}
        <div className="sidebar-section">
          <div 
            className="sidebar-title" 
            style={{ cursor: 'pointer' }}
            onClick={() => handleCommand('/players')}
          >
            참가자 ({players?.length}) 👆
          </div>
          <div className="player-list">
            {players?.map((player) => (
              <div 
                key={player.id} 
                className="player-item"
                style={{
                  border: player.id === socketId ? '2px solid var(--accent-purple)' : undefined
                }}
              >
                <div className="player-avatar">{player.characterEmoji}</div>
                <div className="player-info">
                  <div className="player-name">{player.characterName}</div>
                  <div className="player-role">
                    {player.characterRole}
                    {player.id === socketId && <span style={{ color: 'var(--accent-purple)', marginLeft: '4px' }}>(나)</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 단서 */}
        <div className="sidebar-section">
          <div 
            className="sidebar-title"
            style={{ cursor: 'pointer' }}
            onClick={() => handleCommand('/clue')}
          >
            단서 ({scenario.clues.filter(c => c.found).length}/{scenario.clues.length}) 👆
          </div>
          
          {/* 조사하기 버튼 */}
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginBottom: '12px' }}
            onClick={() => handleCommand('/조사')}
          >
            🔍 새 단서 조사하기
          </button>
          
          <div className="evidence-grid">
            {scenario.clues.map(clue => (
              <div 
                key={clue.id} 
                className={`evidence-item ${clue.found ? '' : 'locked'}`}
                onClick={() => {
                  if (clue.found) {
                    handleCommand(`/clue ${clue.id}`)
                  } else {
                    onInvestigateClue(clue.id)
                  }
                }}
                title={clue.found ? '클릭해서 상세 보기' : '클릭해서 조사하기'}
                style={{ cursor: 'pointer' }}
              >
                <div className="evidence-icon">{clue.found ? clue.icon : '❓'}</div>
                <div className="evidence-name">
                  {clue.found ? clue.name : '???'}
                </div>
                {clue.found && clue.foundBy && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    by {clue.foundBy}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 빠른 명령어 */}
        <div className="sidebar-section">
          <div className="sidebar-title">빠른 명령어</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['/h', '/단서', '/참가자', '/나', '/투표'].map(cmd => (
              <button
                key={cmd}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => handleCommand(cmd)}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 단서 상세 모달 */}
      {selectedClue && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedClue(null)}
        >
          <div 
            className="card"
            style={{ maxWidth: '500px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3>{selectedClue.icon} {selectedClue.name}</h3>
            <p style={{ marginTop: '16px' }}>{selectedClue.description}</p>
            {selectedClue.relevance && (
              <p style={{ marginTop: '12px', color: 'var(--accent-gold)' }}>
                💡 {selectedClue.relevance}
              </p>
            )}
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '24px' }}
              onClick={() => setSelectedClue(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

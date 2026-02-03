import { useState, useEffect, useRef } from 'react'

const PHASES = {
  intro: { name: '도입', icon: '📖' },
  investigation1: { name: '수사 1', icon: '🔍' },
  discussion1: { name: '토론 1', icon: '💬' },
  investigation2: { name: '수사 2', icon: '🔍' },
  discussion2: { name: '토론 2', icon: '💬' },
  vote: { name: '투표', icon: '🗳️' }
}

export default function Game({ data, setData, onEnd, apiUrl }) {
  const [input, setInput] = useState('')
  const [selectedVote, setSelectedVote] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const { scenario, currentPhase, messages, settings } = data

  // AI GM 응답 요청
  const fetchGMResponse = async (message, character = null, action = null) => {
    try {
      const response = await fetch(`${apiUrl}/api/gm-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, message, character, action })
      })
      const data = await response.json()
      return data.success ? data.response : null
    } catch (error) {
      console.error('GM response error:', error)
      return null
    }
  }

  // 게임 시작 시 도입 메시지
  useEffect(() => {
    if (messages.length === 0) {
      const introMessage = scenario.motive 
        ? `🎭 **${scenario.name}**\n\n${scenario.background}\n\n피해자: **${scenario.victim}**\n배경: ${scenario.setting}\n\n당신은 **${scenario.characters[0].name}** (${scenario.characters[0].role}) 역할입니다.\n\n🔒 비밀: ${scenario.characters[0].secret}\n\n게임이 곧 시작됩니다. 다른 참가자들에게 당신의 비밀을 들키지 마세요!`
        : `🎭 **${scenario.name}**\n\n${scenario.background}\n\n피해자: **${scenario.victim}**\n배경: ${scenario.setting}\n\n당신은 **${scenario.characters[0].name}** (${scenario.characters[0].role}) 역할입니다.\n\n🔒 비밀: ${scenario.characters[0].secret}\n\n게임이 곧 시작됩니다. 다른 참가자들에게 당신의 비밀을 들키지 마세요!`
      
      addGMMessage(introMessage)
      
      setTimeout(() => {
        addSystemMessage('🔔 수사 단계가 시작되었습니다. 단서를 조사하고 다른 참가자들에게 질문하세요.')
        setData(prev => ({ ...prev, currentPhase: 'investigation1' }))
      }, 3000)
    }
  }, [])

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addGMMessage = (content) => {
    setData(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Date.now(),
        type: 'gm',
        author: 'GM',
        content,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      }]
    }))
  }

  const addSystemMessage = (content) => {
    setData(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Date.now(),
        type: 'system',
        content,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      }]
    }))
  }

  const addPlayerMessage = (content) => {
    setData(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Date.now(),
        type: 'player',
        author: settings.nickname,
        content,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      }]
    }))
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    addPlayerMessage(input)
    const userInput = input.toLowerCase()
    setInput('')
    setIsLoading(true)

    // 단서 조사 키워드 체크
    if (userInput.includes('단서') || userInput.includes('조사')) {
      const unFoundClue = scenario.clues.find(c => !c.found)
      if (unFoundClue) {
        setData(prev => ({
          ...prev,
          scenario: {
            ...prev.scenario,
            clues: prev.scenario.clues.map(c => 
              c.id === unFoundClue.id ? { ...c, found: true } : c
            )
          }
        }))
        addGMMessage(`🔍 **새로운 단서 발견!**\n\n${unFoundClue.icon} **${unFoundClue.name}**\n${unFoundClue.description}${unFoundClue.relevance ? `\n\n💡 ${unFoundClue.relevance}` : ''}`)
      } else {
        addGMMessage('더 이상 찾을 수 있는 단서가 없습니다.')
      }
      setIsLoading(false)
      return
    }

    // 투표 키워드 체크
    if (userInput.includes('투표') || userInput.includes('범인')) {
      addSystemMessage('🗳️ 투표 단계로 넘어갑니다.')
      setData(prev => ({ ...prev, currentPhase: 'vote' }))
      setIsLoading(false)
      return
    }

    // AI GM 응답 요청
    const aiResponse = await fetchGMResponse(input)
    if (aiResponse) {
      addGMMessage(aiResponse)
    } else {
      // 폴백 응답
      const fallbackResponses = [
        '흥미로운 관점이네요. 다른 참가자들의 반응을 살펴보세요.',
        '좋은 질문입니다. 하지만 그것만으로는 진실에 다가가기 어려울 것 같습니다.',
        '단서들을 더 조사해보는 건 어떨까요?',
        '다른 참가자들에게도 같은 질문을 해보세요. 누군가 거짓말을 하고 있을 수 있습니다.'
      ]
      addGMMessage(fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)])
    }
    setIsLoading(false)
  }

  const handleAlibi = async (char) => {
    setIsLoading(true)
    const aiResponse = await fetchGMResponse(null, char, 'alibi')
    
    if (aiResponse) {
      addGMMessage(`${char.emoji} **${char.name}** (${char.role}):\n"${aiResponse}"`)
    } else {
      // 폴백 응답
      const alibis = char.alibiOptions || [
        `"그 시간에 저는 정원에서 바람을 쐬고 있었어요."`,
        `"서재 근처에는 가지 않았습니다. 응접실에 있었죠."`,
        `"주방에서 요리사와 이야기를 나누고 있었어요."`,
        `"그건... 말씀드리기 곤란합니다."`
      ]
      const randomAlibi = alibis[Math.floor(Math.random() * alibis.length)]
      addGMMessage(`${char.emoji} **${char.name}** (${char.role}):\n${randomAlibi}`)
    }
    setIsLoading(false)
  }

  const handleInterrogation = async (char) => {
    setIsLoading(true)
    const aiResponse = await fetchGMResponse(null, char, 'interrogation')
    
    if (aiResponse) {
      addGMMessage(`${char.emoji} **${char.name}** (${char.role}):\n"${aiResponse}"`)
    } else {
      // 폴백 응답
      const responses = char.interrogationResponses || [
        `"왜 저를 의심하시는 거죠? 저는 결백합니다!"`,
        `"흥, 저보다 의심스러운 사람이 있지 않나요?"`,
        `"솔직히 말씀드리면... 저도 이상한 점을 발견했어요."`,
        `"...할 말이 없습니다."`
      ]
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      addGMMessage(`${char.emoji} **${char.name}** (${char.role}):\n${randomResponse}`)
    }
    setIsLoading(false)
  }

  const handleVote = () => {
    if (selectedVote === null) {
      alert('투표할 대상을 선택해주세요!')
      return
    }

    const isCorrect = selectedVote === scenario.murdererIndex
    onEnd({
      success: isCorrect,
      murderer: scenario.characters[scenario.murdererIndex],
      voted: scenario.characters[selectedVote],
      motive: scenario.motive,
      method: scenario.method
    })
  }

  const renderPhaseIndicator = () => (
    <div className="phase-indicator">
      {Object.entries(PHASES).map(([key, phase], index, arr) => {
        const currentIndex = Object.keys(PHASES).indexOf(currentPhase)
        const isActive = key === currentPhase
        const isCompleted = index < currentIndex

        return (
          <div key={key} className={`phase-step ${isActive ? 'active' : ''}`}>
            <div className={`phase-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
              {isCompleted ? '✓' : phase.icon}
            </div>
            {index < arr.length - 1 && (
              <div className={`phase-line ${isCompleted ? 'completed' : ''}`}></div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (currentPhase === 'vote') {
    return (
      <div className="vote-container">
        {renderPhaseIndicator()}
        <h2 className="vote-title">🗳️ 범인을 지목하세요</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          수집한 단서와 증언을 바탕으로 범인을 추리하세요
        </p>
        
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
          ⚖️ 최종 투표
        </button>
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
              <span>{settings.players}명</span>
            </div>
            <div className="header-badge">
              <span>⏱️</span>
              <span>{settings.duration}분</span>
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px', fontSize: '14px' }}
              onClick={() => {
                addSystemMessage('🗳️ 투표 단계로 넘어갑니다.')
                setData(prev => ({ ...prev, currentPhase: 'vote' }))
              }}
            >
              투표로 이동
            </button>
          </div>
        </div>

        {renderPhaseIndicator()}

        {/* Chat */}
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message message-${msg.type}`}>
                {msg.type !== 'system' && (
                  <div className="message-header">
                    <span className="message-author">
                      {msg.type === 'gm' ? '🎭 GM' : `😊 ${msg.author}`}
                    </span>
                    <span className="message-time">{msg.time}</span>
                  </div>
                )}
                <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-gm" style={{ opacity: 0.6 }}>
                <div className="message-content">
                  <span className="typing-indicator">●●●</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="input chat-input"
              placeholder="메시지를 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleSend}
              disabled={isLoading}
            >
              {isLoading ? '...' : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">내 캐릭터</div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="player-avatar" style={{ fontSize: '20px' }}>
                {scenario.characters[0].emoji}
              </div>
              <div>
                <div style={{ fontWeight: '600' }}>{scenario.characters[0].name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {scenario.characters[0].role}
                </div>
              </div>
            </div>
            <div style={{ 
              padding: '12px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              <div style={{ color: 'var(--accent-red)', fontWeight: '600', marginBottom: '4px' }}>
                🔒 비밀
              </div>
              {scenario.characters[0].secret}
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">참가자 ({scenario.characters.length})</div>
          <div className="player-list">
            {scenario.characters.map((char, index) => (
              <div key={index} className="player-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="player-avatar">{char.emoji}</div>
                  <div className="player-info">
                    <div className="player-name">{char.name}</div>
                    <div className="player-role">{char.role}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="btn btn-ghost" 
                    style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                    onClick={() => handleAlibi(char)}
                    disabled={isLoading}
                  >
                    🕐 알리바이
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                    onClick={() => handleInterrogation(char)}
                    disabled={isLoading}
                  >
                    🔎 심문
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">단서 조사</div>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginBottom: '16px' }}
            disabled={isLoading}
            onClick={() => {
              const unFoundClue = scenario.clues.find(c => !c.found)
              if (unFoundClue) {
                setData(prev => ({
                  ...prev,
                  scenario: {
                    ...prev.scenario,
                    clues: prev.scenario.clues.map(c => 
                      c.id === unFoundClue.id ? { ...c, found: true } : c
                    )
                  }
                }))
                addGMMessage(`🔍 **새로운 단서 발견!**\n\n${unFoundClue.icon} **${unFoundClue.name}**\n${unFoundClue.description}${unFoundClue.relevance ? `\n\n💡 ${unFoundClue.relevance}` : ''}`)
              } else {
                addGMMessage('더 이상 찾을 수 있는 단서가 없습니다.')
              }
            }}
          >
            🔍 단서 조사하기
          </button>
          
          <div className="sidebar-title" style={{ marginTop: '8px' }}>발견한 단서 ({scenario.clues.filter(c => c.found).length}/{scenario.clues.length})</div>
          <div className="evidence-grid">
            {scenario.clues.filter(c => c.found).map(clue => (
              <div 
                key={clue.id} 
                className="evidence-item"
                title={clue.description}
                style={{ cursor: 'help' }}
              >
                <div className="evidence-icon">{clue.icon}</div>
                <div className="evidence-name">{clue.name}</div>
              </div>
            ))}
            {scenario.clues.filter(c => c.found).length === 0 && (
              <p style={{ 
                gridColumn: '1/-1', 
                color: 'var(--text-muted)', 
                fontSize: '13px',
                textAlign: 'center',
                padding: '20px'
              }}>
                🔍 버튼을 눌러 단서를 조사하세요
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

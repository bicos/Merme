import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import Lobby from './components/Lobby'
import WaitingRoom from './components/WaitingRoom'
import MultiplayerGame from './components/MultiplayerGame'
import Result from './components/Result'
import Loading from './components/Loading'
import './App.css'

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', background: '#333' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ marginTop: '20px', padding: '10px' }}>
            Reset App & Clear Session
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [gameState, setGameState] = useState('lobby') // lobby, waiting, loading, game, voting, result
  const [gameData, setGameData] = useState(null)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const [roomSubscription, setRoomSubscription] = useState(null)

  // 에러 표시 헬퍼
  const showError = (msg) => {
    setError(msg)
    setTimeout(() => setError(null), 3000)
  }

  // 세션 복구 및 초기화
  useEffect(() => {
    const savedSession = localStorage.getItem('mm_session')
    if (savedSession) {
      const { roomCode, nickname, sessionId } = JSON.parse(savedSession)
      // 상태 복구 시도
      recoverSession(roomCode, nickname, sessionId)
    }
  }, [])

  const recoverSession = async (roomCode, nickname, sessionId) => {
    try {
      // 1. 방 정보 확인
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError || !room) {
        // 방이 없으면 세션 정리
        localStorage.removeItem('mm_session')
        return
      }

      // 2. 플레이어 정보 확인
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .eq('session_id', sessionId)
        .single()

      if (playerError || !player) {
        // 플레이어 정보가 없으면 (강퇴/삭제됨) 세션 정리
        localStorage.removeItem('mm_session')
        return
      }

      // 3. 상태 복구
      setPlayerInfo({ nickname, isHost: player.is_host, sessionId })
      // Fix: Map host_id to host for UI compatibility
      setGameData({ roomCode, room: { ...room, host: room.host_id, players: [] } })

      // 현재 방 상태에 따라 화면 전환
      if (room.status === 'playing') {
        // 게임 중이면 시나리오 데이터 등 추가 로드 필요 (fetchGameStartData 로직 재사용)
        // 여기서는 간단히 handleRoomUpdate가 처리하도록 유도하거나 직접 호출
        // handleRoomUpdate(room) 호출 효과를 내기 위해:
        fetchPlayers(roomCode).then(players => {
          // players 정보가 있으면 room 객체 업데이트
          const updatedRoom = { ...room, host: room.host_id, players }
          setGameData({ roomCode, room: updatedRoom })
          handleRoomUpdate(updatedRoom)
        })
      } else {
        fetchPlayers(roomCode) // 플레이어 목록 최신화
        setGameState(room.status === 'generating' ? 'loading' : room.status)
      }
    } catch (e) {
      console.error('Session recovery failed:', e)
      localStorage.removeItem('mm_session')
    }
  }

  // 방 데이터 구독 설정
  useEffect(() => {
    if (!gameData?.roomCode) return

    const roomCode = gameData.roomCode

    // 기존 구독 해제 (중복 방지)
    if (roomSubscription) {
      supabase.removeChannel(roomSubscription.roomChannel)
      supabase.removeChannel(roomSubscription.playersChannel)
      supabase.removeChannel(roomSubscription.messagesChannel)
    }

    // 1. 방 상태 구독 (rooms 테이블)
    const roomChannel = supabase
      .channel(`room:${roomCode}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `code=eq.${roomCode}`
      }, (payload) => {
        handleRoomUpdate(payload.new)
      })
      .subscribe()

    // 2. 플레이어 상태 구독 (players 테이블)
    const playersChannel = supabase
      .channel(`players:${roomCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        // 즉각적인 반응을 위해 fetchPlayers 호출
        fetchPlayers(roomCode)
      })
      .subscribe()

    // 3. 메시지 구독 (messages 테이블)
    const messagesChannel = supabase
      .channel(`messages:${roomCode}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        setGameData(prev => ({
          ...prev,
          messages: [...(prev.messages || []), payload.new]
        }))
      })
      .subscribe()

    setRoomSubscription({ roomChannel, playersChannel, messagesChannel })

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [gameData?.roomCode])

  // 방 정보 업데이트 처리
  const handleRoomUpdate = (updatedRoom) => {
    setGameData(prev => {
      // players 정보 유지하면서 room 업데이트
      const currentPlayers = prev?.room?.players || []

      // 게임 시작 감지
      if (prev?.room?.status === 'generating' && updatedRoom.status === 'playing') {
        // 비동기 호출이지만 상태 업데이트는 여기서 진행
        // fetchGameStartData는 updatedRoom을 기반으로 동작
        // 주의: fetchGameStartData 내부에서 prev 참조가 아닌 updatedRoom 사용
        setTimeout(() => fetchGameStartData(updatedRoom, currentPlayers), 0)
      }

      return {
        ...prev,
        // Fix: Map host_id to host
        room: { ...updatedRoom, host: updatedRoom.host_id, players: currentPlayers }
      }
    })

    // 로딩 상태 처리
    if (updatedRoom.status === 'generating') {
      setGameState('loading')
      setLoadingMessage('AI가 시나리오를 생성 중입니다...')
    } else if (updatedRoom.status === 'playing' && gameState !== 'game') {
      setGameState('game')
    } else if (updatedRoom.status === 'voting') {
      setGameState('voting')
    } else if (updatedRoom.status === 'ended') {
      // 게임 종료 처리는 별도 함수에서 players 정보가 필요할 수 있음
      // 여기서는 상태만 업데이트하고 useEffect 등에서 감지하거나 직접 호출
      // handleGameEnd는 room 정보를 받아서 처리
      setTimeout(() => handleGameEnd(updatedRoom), 0)
    }
  }

  const fetchPlayers = async (roomCode) => {
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: true })

    if (!players) return []

    // Map snake_case to camelCase for UI components
    const mappedPlayers = players.map(p => ({
      ...p,
      isHost: p.is_host // Map is_host to isHost
    }))

    setGameData(prev => ({
      ...prev,
      room: { ...prev.room, players: mappedPlayers }
    }))

    // 내 정보 업데이트 (호스트 여부 확인)
    if (playerInfo) {
      const me = mappedPlayers.find(p => p.nickname === playerInfo.nickname)
      if (me) {
        // 호스트 상태가 바뀌었는지 확인 (Host Migration)
        if (me.isHost !== playerInfo.isHost) {
          setPlayerInfo(prev => ({ ...prev, isHost: me.isHost }))
        }
      }
    }

    // Host Migration Check
    // 현재 호스트가 없는 경우 (호스트가 나감)
    const hasHost = mappedPlayers.some(p => p.isHost)
    if (!hasHost && mappedPlayers.length > 0) {
      // 가장 오래된 플레이어가 새 호스트가 됨 (client-side logic, race condition 가능성 있지만 단순화)
      // 내가 가장 오래된 플레이어라면 내가 호스트 승계 요청
      const oldestPlayer = mappedPlayers[0] // 이미 created_at 오름차순 정렬됨
      if (oldestPlayer.nickname === playerInfo?.nickname) {
        console.log('Host migration: I am the new host')
        await supabase
          .from('players')
          .update({ is_host: true })
          .eq('id', oldestPlayer.id)
      }
    }

    return mappedPlayers
  }

  const fetchGameStartData = (room, currentPlayers = []) => {
    // room: scenario, players(DB) 정보는 없을 수 있음, currentPlayers 사용

    // 내 캐릭터 찾기
    // currentPlayers가 비어있다면 gameData 참조
    const players = currentPlayers.length > 0 ? currentPlayers : gameData?.room?.players
    const myPlayer = players?.find(p => p.nickname === playerInfo?.nickname)

    if (!myPlayer || !room.scenario) return

    const scenario = room.scenario
    const characterIndex = myPlayer.character_index
    const myCharacter = scenario.characters[characterIndex]
    const isMurderer = characterIndex === scenario.murdererIndex

    setGameData(prev => ({
      ...prev,
      scenario: {
        ...scenario,
        clues: scenario.clues
      },
      myCharacter: {
        ...myCharacter,
        index: characterIndex,
        isMurderer
      },
      phase: 'playing'
    }))

    setPlayerInfo(prev => ({
      ...prev,
      myCharacter: {
        ...myCharacter,
        index: characterIndex,
        isMurderer
      }
    }))
  }

  const handleGameEnd = (room) => {
    // 결과 계산 로직 (서버에서 계산해서 room.scenario나 room.votes에 저장했는지, 
    // 아니면 클라이언트가 계산해야 하는지?
    // 기존 로직: 서버가 계산해서 emit 'game-ended'
    // 변경 로직: room.status가 'ended'가 되면 room 데이터를 보고 결과 도출

    // votes JSONB 구조: { socketId: voteIndex }
    const votes = room.votes || {}
    const voteCount = {}
    Object.values(votes).forEach(vote => {
      voteCount[vote] = (voteCount[vote] || 0) + 1
    })

    let maxVotes = 0
    let accusedIndex = null
    Object.entries(voteCount).forEach(([charIndex, count]) => {
      if (count > maxVotes) {
        maxVotes = count
        accusedIndex = parseInt(charIndex)
      }
    })

    const murdererIndex = room.scenario.murdererIndex
    const success = accusedIndex === murdererIndex

    // players 정보가 필요함
    const players = gameData?.room?.players || []

    setGameData(prev => ({
      ...prev,
      result: {
        success,
        murdererIndex,
        murdererCharacter: room.scenario.characters[murdererIndex],
        accusedCharacter: room.scenario.characters[accusedIndex],
        voteCount,
        players: players.map(p => ({
          ...p,
          character: room.scenario.characters[p.character_index],
          characterIndex: p.character_index,
          wasMurderer: p.character_index === murdererIndex
        }))
      }
    }))
    setGameState('result')
  }


  // --- Actions ---

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  const createRoom = async (nickname, settings) => {
    try {
      if (settings.players < 3) {
        showError('최소 3명 이상이 필요합니다.')
        return
      }

      const roomCode = generateRoomCode()
      const sessionId = uuidv4() // 클라이언트 식별용

      // 1. 방 생성
      const { error: roomError } = await supabase
        .from('rooms')
        .insert({
          code: roomCode,
          host_id: sessionId,
          settings: settings,
          status: 'waiting'
        })

      if (roomError) throw roomError

      // 2. 플레이어 추가
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          session_id: sessionId,
          nickname: nickname,
          is_host: true
        })

      if (playerError) throw playerError

      // 세션 저장
      localStorage.setItem('mm_session', JSON.stringify({ roomCode, nickname, sessionId }))

      setPlayerInfo({ nickname, isHost: true, sessionId })

      // 초기 데이터 설정 (구독보다 먼저)
      const initialPlayers = await fetchPlayers(roomCode)
      console.log('[App] createRoom success. Setting gameData:', { roomCode, sessionId, players: initialPlayers })

      setGameData({
        roomCode,
        room: { code: roomCode, host: sessionId, settings, players: initialPlayers }
      })

      console.log('[App] Transitioning to waiting state')
      setGameState('waiting')

    } catch (e) {
      console.error(e)
      showError('방 생성에 실패했습니다: ' + e.message)
    }
  }

  const joinRoom = async (nickname, roomCode) => {
    try {
      // 방 존재 확인
      const { data: room, error: roomCheckError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomCheckError || !room) {
        showError('존재하지 않는 방입니다.')
        return
      }

      if (room.status !== 'waiting') {
        showError('이미 게임이 진행 중입니다.')
        return
      }

      // 플레이어 수 확인
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact' })
        .eq('room_code', roomCode)

      if (count >= room.settings.players) {
        showError('방이 가득 찼습니다.')
        return
      }

      const sessionId = uuidv4()

      // 플레이어 추가
      const { error: joinError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          session_id: sessionId,
          nickname: nickname,
          is_host: false
        })

      if (joinError) {
        if (joinError.code === '23505') { // Unique violation
          showError('이미 사용 중인 닉네임입니다.')
        } else {
          showError('방 참가 실패: ' + joinError.message)
        }
        return
      }

      // 세션 저장
      localStorage.setItem('mm_session', JSON.stringify({ roomCode, nickname, sessionId }))

      setPlayerInfo({ nickname, isHost: false, sessionId })
      // 초기 데이터 로드
      const initialPlayers = await fetchPlayers(roomCode)
      setGameData({
        roomCode,
        room: { ...room, players: initialPlayers }
      })
      setGameState('waiting')

    } catch (e) {
      console.error(e)
      showError('오류가 발생했습니다.')
    }
  }

  const startGame = async () => {
    try {
      setLoadingMessage('AI 시나리오 생성 요청 중...')
      setGameState('loading')

      // 1. 상태 변경 (Generating)
      await supabase
        .from('rooms')
        .update({ status: 'generating' })
        .eq('code', gameData.roomCode)

      // 2. Serverless Function 호출
      const response = await fetch('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: gameData.room.settings.players,
          genre: gameData.room.settings.genre,
          duration: gameData.room.settings.duration
        })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''))
      }

      // 3. 시나리오 저장 및 캐릭터 분배
      const scenario = data.scenario
      const players = gameData.room.players

      // 캐릭터 랜덤 배정
      const shuffledIndices = [...Array(players.length).keys()].sort(() => Math.random() - 0.5)

      // DB 업데이트 (트랜잭션이 없으므로 순차 처리, race condition 주의)
      // players 테이블 업데이트
      for (let i = 0; i < players.length; i++) {
        await supabase
          .from('players')
          .update({ character_index: shuffledIndices[i] })
          .eq('id', players[i].id)
      }

      // rooms 테이블 업데이트 (시나리오 + 상태)
      await supabase
        .from('rooms')
        .update({
          scenario: scenario,
          status: 'playing'
        })
        .eq('code', gameData.roomCode)

    } catch (e) {
      console.error(e)
      showError('게임 시작 실패: ' + e.message)
      setGameState('waiting')
      // 상태 롤백
      await supabase.from('rooms').update({ status: 'waiting' }).eq('code', gameData.roomCode)
    }
  }

  const sendMessage = async (message, asCharacter = true) => {
    if (!gameData?.roomCode || !playerInfo) return

    const myPlayer = gameData.room.players.find(p => p.nickname === playerInfo.nickname)
    const character = gameData.scenario?.characters[myPlayer?.character_index]

    await supabase
      .from('messages')
      .insert({
        room_code: gameData.roomCode,
        player_id: playerInfo.sessionId,
        nickname: playerInfo.nickname,
        character_name: character?.name,
        character_emoji: character?.emoji,
        content: message,
        as_character: asCharacter
      })
  }

  const investigateClue = async (clueId) => {
    // 동시성 문제를 피하기 위해 DB에서 최신 상태를 가져와서 업데이트
    const { data: room } = await supabase
      .from('rooms')
      .select('scenario')
      .eq('code', gameData.roomCode)
      .single()

    if (!room?.scenario) return

    const clues = room.scenario.clues
    const clueIndex = clues.findIndex(c => c.id === clueId)

    if (clueIndex === -1 || clues[clueIndex].found) return

    // 단서 업데이트
    clues[clueIndex].found = true
    clues[clueIndex].foundBy = playerInfo.nickname

    await supabase
      .from('rooms')
      .update({ scenario: { ...room.scenario, clues } })
      .eq('code', gameData.roomCode)
  }

  const startVoting = async () => {
    await supabase
      .from('rooms')
      .update({ status: 'voting' })
      .eq('code', gameData.roomCode)
  }

  const castVote = async (characterIndex) => {
    // JSONB 업데이트: votes 객체에 { sessionId: characterIndex } 추가
    // Supabase에서 JSONB 부분 업데이트는 좀 까다로움. 
    // 간단하게 전체 읽고 쓰기로 구현 (충돌 가능성 있지만 프로토타입용)

    const { data: room } = await supabase
      .from('rooms')
      .select('votes')
      .eq('code', gameData.roomCode)
      .single()

    const currentVotes = room.votes || {}
    currentVotes[playerInfo.sessionId] = characterIndex

    await supabase
      .from('rooms')
      .update({ votes: currentVotes })
      .eq('code', gameData.roomCode)

    // 모든 플레이어가 투표했는지 서버 트리거가 없으므로 클라이언트 중 하나(마지막 투표자)가 체크해서 종료 처리
    // 또는 polling? 우선 handleRoomUpdate에서 votes가 변경될 때마다 체크하도록 위임 가능하지만
    // 자신이 마지막 투표자인지 확인해서 종료 트리거

    const totalPlayers = gameData.room.players.length
    if (Object.keys(currentVotes).length === totalPlayers) {
      // 게임 종료
      await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('code', gameData.roomCode)
    }
  }

  const restartGame = () => {
    setGameData(null)
    setPlayerInfo(null)
    setGameState('lobby')
    localStorage.removeItem('mm_session') // 세션 삭제 추가
  }

  const leaveGame = restartGame; // Fix: leaveGame was undefined

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent-red)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease'
        }}>
          {error}
        </div>
      )}

      {gameState === 'lobby' && (
        <Lobby
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isMultiplayer={true}
        />
      )}

      {gameState === 'waiting' && gameData && (
        <WaitingRoom
          roomCode={gameData.roomCode}
          room={gameData.room}
          playerInfo={playerInfo}
          onStartGame={startGame}
          onLeave={leaveGame}
          socketId={playerInfo.sessionId} // socketId 대신 sessionId 사용
        />
      )}

      {gameState === 'loading' && (
        <Loading message={loadingMessage} />
      )}

      {(gameState === 'game' || gameState === 'voting') && gameData && (
        <MultiplayerGame
          gameData={gameData}
          playerInfo={playerInfo}
          onSendMessage={sendMessage}
          onInvestigateClue={investigateClue}
          onStartVoting={startVoting}
          onCastVote={castVote}
          onLeave={leaveGame}
          isVoting={gameState === 'voting'}
          socketId={playerInfo.sessionId}
        />
      )}

      {gameState === 'result' && gameData && (
        <Result
          data={gameData}
          onRestart={leaveGame} // Result screen "Back to Home" is effectively leaving
          isMultiplayer={true}
        />
      )}
    </>
  )
}

export default App

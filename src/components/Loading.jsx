import { useState, useEffect } from 'react'

export default function Loading({ message }) {
  const [tipIndex, setTipIndex] = useState(0)
  
  const tips = [
    '시나리오를 생성하는 중...',
    '캐릭터를 배치하는 중...',
    '단서를 숨기는 중...',
    '범인을 정하는 중...',
    '무대를 준비하는 중...',
    '비밀을 만드는 중...',
    '알리바이를 조작하는 중...'
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <div className="loading-text">
        {message || tips[tipIndex]}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '16px' }}>
        🎭 AI가 당신만을 위한 미스터리를 만들고 있습니다
      </p>
    </div>
  )
}


import { GoogleGenerativeAI } from '@google/generative-ai'

// Allow CORS helper
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }
    return await fn(req, res)
}

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { players, genre, duration } = req.body

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY missing' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const MODEL_NAME = 'gemini-3-flash-preview' // Updated per user request (2026)

    const genreDescriptions = {
        mansion: '1920년대 영국 귀족 저택 배경의 클래식 추리물',
        noir: '1940년대 LA 느와르 스타일의 범죄 스릴러',
        scifi: '미래 우주정거장/사이버펑크 배경의 SF 미스터리',
        oriental: '조선시대 또는 동양 고전 배경의 사극 미스터리',
        random: '창의적이고 독특한 배경의 미스터리 (자유롭게 선택)'
    }

    const prompt = `당신은 머더 미스터리 게임 시나리오 작가입니다. 다음 조건에 맞는 시나리오를 JSON 형식으로 생성해주세요.

조건:
- 참가 인원: ${players}명
- 장르: ${genreDescriptions[genre] || genreDescriptions.random}
- 플레이 시간: ${duration}분

다음 JSON 형식으로 응답해주세요 (다른 텍스트 없이 순수 JSON만):

{
  "name": "시나리오 제목",
  "setting": "시대와 장소 설명",
  "victim": "피해자 이름",
  "background": "사건 배경 설명 (3-4문장, 몰입감 있게)",
  "characters": [
    {
      "name": "캐릭터 이름",
      "role": "역할/직업",
      "emoji": "적절한 이모지 1개",
      "secret": "이 캐릭터만 아는 비밀 (2-3문장)",
      "motive": "이 캐릭터가 피해자를 죽일 수 있는 동기",
      "publicInfo": "다른 사람들이 이 캐릭터에 대해 알고 있는 정보"
    }
  ],
  "clues": [
    {
      "id": 1,
      "name": "단서 이름",
      "icon": "단서 이모지",
      "description": "단서 설명",
      "relevance": "이 단서가 사건과 어떻게 연관되는지"
    }
  ],
  "murdererIndex": 0,
  "motive": "범인의 진짜 동기",
  "method": "범행 수법",
  "timeline": "사건 타임라인 요약"
}

주의사항:
1. characters 배열은 정확히 ${players}명이어야 합니다
2. murdererIndex는 0부터 ${players - 1} 사이의 숫자입니다
3. clues 배열은 ${Math.min(4 + players, 8)}개의 단서를 포함해야 합니다
4. 각 캐릭터는 피해자와 연관된 그럴듯한 동기가 있어야 합니다
5. 모든 텍스트는 한국어로 작성해주세요
6. 반드시 유효한 JSON 형식으로만 응답해주세요`

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME })
        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text()
        // Clean up markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        const scenario = JSON.parse(text)

        // Add additional fields needed by frontend
        scenario.clues = scenario.clues.map((clue, index) => ({
            ...clue,
            id: index + 1,
            found: false,
            foundBy: null
        }))
        scenario.genre = genre

        res.status(200).json({ success: true, scenario })
    } catch (error) {
        console.error('Scenario generation error:', error)
        res.status(500).json({ success: false, error: 'Failed to generate scenario', details: error.message })
    }
}

export default allowCors(handler)

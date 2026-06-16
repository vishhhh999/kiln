export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  // Parse body -- Vercel auto-parses JSON for Node.js functions
  const { apiKey } = req.body || {}

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ valid: false, error: 'No API key provided' })
    return
  }

  const trimmed = apiKey.trim()
  if (!trimmed.startsWith('sk-ant-')) {
    res.status(200).json({ valid: false, error: 'Key must start with sk-ant-' })
    return
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': trimmed,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    if (response.status === 401) {
      res.status(200).json({ valid: false, error: 'Invalid API key' })
    } else if (response.status === 403) {
      res.status(200).json({ valid: false, error: 'API key has no access to this model' })
    } else {
      // 200 or 400 (bad params but auth passed) both mean valid key
      res.status(200).json({ valid: true })
    }
  } catch (e) {
    res.status(200).json({ valid: false, error: `Verification failed: ${e.message}` })
  }
}

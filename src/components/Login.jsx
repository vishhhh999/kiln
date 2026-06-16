import { useState } from 'react'
import { login } from '../lib/auth.js'

export default function Login({ onLogin }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!key.trim()) return
    setLoading(true)
    setError(null)
    const result = await login(key.trim())
    if (result.success) {
      onLogin(result.userHash)
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh', background: '#0e0e0e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-input {
          width: 100%; background: #111; border: 1px solid #2a2a2a;
          border-radius: 6px; padding: 12px 16px;
          color: #f0ece4; font-size: 13px; font-family: 'DM Mono', monospace;
          outline: none; transition: border-color 0.15s;
          letter-spacing: 0.02em;
        }
        .login-input:focus { border-color: rgba(200,185,154,0.4); }
        .login-input::placeholder { color: #3d3d3d; }
        .login-btn {
          width: 100%; padding: 12px;
          background: #c8b99a; color: #0e0e0e;
          border: none; border-radius: 6px;
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: opacity 0.15s;
        }
        .login-btn:hover:not(:disabled) { opacity: 0.88; }
        .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: '#c8b99a', letterSpacing: '0.06em' }}>KILN</div>
          <div style={{ fontSize: 11, color: '#3d3d3d', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4, fontWeight: 500 }}>SVG → 3D Generator</div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, color: '#5c5751', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Anthropic API Key
          </div>
          <input
            className="login-input"
            type="password"
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <div style={{ fontSize: 11, color: '#eb5757', letterSpacing: '0.04em' }}>{error}</div>
          )}
          <button className="login-btn" onClick={handleSubmit} disabled={loading || !key.trim()}>
            {loading ? 'Verifying...' : 'Enter'}
          </button>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 24, fontSize: 10, color: '#2a2a2a', letterSpacing: '0.04em', lineHeight: 1.7 }}>
          Your key is used to identify your library across devices.<br />
          It's never stored on our servers — only a one-way hash is saved.
        </div>
      </div>
    </div>
  )
}

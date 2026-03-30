'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kayit basarisiz');
      } else {
        router.push('/login?registered=1');
      }
    } catch {
      setError('Baglanti hatasi');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #f7931a, #ff6b35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontWeight: '800', fontSize: '20px', color: '#fff',
          }}>BT</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>Hesap Olustur</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Borsa Trading Platformuna katil</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '28px',
        }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--red-bg)', border: '1px solid rgba(255,77,106,0.2)',
              color: 'var(--red)', fontSize: '12px', marginBottom: '16px',
            }}>{error}</div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Ad Soyad</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Adiniz Soyadiniz" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="ornek@email.com" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Sifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              minLength={6} placeholder="En az 6 karakter" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', fontSize: '13px', fontWeight: '700',
            backgroundColor: 'var(--green)', color: '#000', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '0.3px', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Kayit yapiliyor...' : 'Kayit Ol'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
            Zaten hesabiniz var mi? <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>Giris Yap</a>
          </p>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: '13px',
  backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
  transition: 'border-color 0.2s',
};

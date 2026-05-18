'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setAuthToken } from '@/utils/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthToken(data.token);
        router.push('/');
      } else {
        alert(data.error || '登录失败');
      }
    } catch (err) {
      console.error('登录请求失败:', err);
      alert('登录请求失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="page-container">
        <div className="page-header">
          <span className="headline-tag">账户登录</span>
          <h1 className="page-title">请使用用户名和密码登录</h1>
          <p className="page-subtitle">登录后您可以切换设备、查看历史对局，并在多端保持一致身份。</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label">
            用户名
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </label>

          <label className="form-label">
            密码
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            登录
          </button>

          <Link href="/register" className="btn btn-tertiary" style={{ justifyContent: 'center' }}>
            还没账号？注册
          </Link>
        </form>
      </div>
    </main>
  );
}

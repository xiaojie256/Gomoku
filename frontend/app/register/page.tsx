'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthToken } from '@/utils/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthToken(data.token);
        router.push('/');
      } else {
        alert(data.error || '注册失败');
      }
    } catch (err) {
      console.error('注册请求失败:', err);
      alert('注册请求失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="page-container">
        <div className="page-header">
          <span className="headline-tag">注册新账号</span>
          <h1 className="page-title">创建一个新账户</h1>
          <p className="page-subtitle">注册后您可以在任意设备登录并访问个人对局历史。</p>
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

          <label className="form-label">
            确认密码
            <input
              className="form-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              required
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            注册
          </button>

          <button className="btn btn-tertiary" type="button" onClick={() => router.push('/login')}>
            已有账号？登录
          </button>
        </form>
      </div>
    </main>
  );
}

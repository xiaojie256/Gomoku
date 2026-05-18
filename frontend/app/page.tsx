'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth, clearAuthToken } from '@/utils/auth';

interface Room {
  id: number;
  status: 'playing' | 'finished' | 'draw';
}

interface User {
  id: number;
  username: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; className: string }> = {
    playing: { label: '进行中', className: 'status-playing' },
    finished: { label: '已结束', className: 'status-finished' },
    draw: { label: '和局', className: 'status-draw' },
  };
  const config = map[status] || { label: status, className: '' };

  return (
    <span className={`status-badge ${config.className}`}>
      <span className="status-dot"></span>
      {config.label}
    </span>
  );
};

export default function LobbyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [secretCode, setSecretCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [historyRooms, setHistoryRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const loadCurrentUser = async () => {
    try {
      const res = await fetchWithAuth('/api/auth/me');
      if (!res.ok) {
        clearAuthToken();
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      clearAuthToken();
      setCurrentUser(null);
    }
  };

  const refreshRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const lobbyRes = await fetch('/api/game/lobby');
      const historyRes = currentUser ? await fetchWithAuth('/api/game/history') : null;

      if (lobbyRes.ok) {
        const data = await lobbyRes.json();
        setPublicRooms(Array.isArray(data.rooms) ? data.rooms : []);
      }

      if (historyRes && historyRes.ok) {
        const data = await historyRes.json();
        setHistoryRooms(Array.isArray(data.history) ? data.history : []);
      } else if (!currentUser) {
        setHistoryRooms([]);
      }
    } catch (error) {
      console.error('拉取对局列表失败:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadCurrentUser();
      await refreshRooms();
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshRooms();
    }
  }, [currentUser]);

  // 1. Route change detection - force unlock UI when pathname changes (including back navigation)
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  // 2. BOM event listeners for iOS/Safari BFCache and browser back button
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsNavigating(false);
    };

    const handlePopState = () => setIsNavigating(false);

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleCreateRoom = async (isPublic: boolean) => {
    if (!currentUser) {
      alert('请先登录后再创建对局');
      router.push('/login');
      return;
    }

    if (isNavigating) return;
    setIsNavigating(true);
    setIsCreating(true);
    try {
      const res = await fetchWithAuth('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (!isPublic) {
          alert(`私密战局开辟成功！\n请将 6 位暗码发给挑战者：${data.secretCode}`);
        }
        router.push(`/board/${data.boardId}`);
      } else {
        alert('开局失败: ' + (data.error || '未知异常'));
      }
    } catch (error) {
      alert('网络请求失败');
    } finally {
      setIsCreating(false);
      setIsNavigating(false);
    }
  };

  const handleJoinPrivate = async () => {
    if (!currentUser) {
      alert('请先登录后再加入私密对局');
      router.push('/login');
      return;
    }

    if (isNavigating) return;
    setIsNavigating(true);

    if (secretCode.length !== 6) {
      alert('请输入完整的 6 位验证暗码');
      setIsNavigating(false);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/game/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        router.push(`/board/${data.boardId}`);
      } else {
        alert(data.error || '暗码无效，未匹配到进行中的棋盘');
      }
    } catch (error) {
      alert('暗码鉴权失败');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setHistoryRooms([]);
    router.push('/login');
  };

  const renderRoomList = (rooms: Room[], emptyMessage: string) => {
    if (isLoadingRooms) {
      return (
        <div className="empty-state">
          <svg style={{ animation: 'spin 1s linear infinite' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <p>正在同步云端底层数据...</p>
        </div>
      );
    }

    if (rooms.length === 0) {
      return (
        <div className="empty-state">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="room-list">
        {rooms.map((room) => (
          <div className="room-card" key={room.id}>
            <div className="room-info">
              <div className="room-title">对局房间 #{room.id}</div>
              <StatusBadge status={room.status} />
            </div>
            <Link href={`/board/${room.id}`} className="btn btn-secondary">
              <span>观战 / 进入</span>
            </Link>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <span className="headline-tag">Gomoku Asynchronous Core</span>
          <h1 className="page-title">异步棋对战大厅</h1>
          <p className="page-subtitle">
            打破实时在线长时对局的高压束缚。随时建立，随时离线，数据物理安全落盘。
          </p>
          <div className="auth-status-bar">
            {currentUser ? (
              <div className="user-info">
                <span>鉴权身份：<strong>{currentUser.username}</strong></span>
                <button className="btn btn-tertiary" onClick={handleLogout}>退出</button>
              </div>
            ) : (
              <div className="user-info">
                <span>未受托鉴权令牌。</span>
                <Link href="/login" className="btn btn-tertiary">登录</Link>
                <Link href="/register" className="btn btn-tertiary">注册</Link>
              </div>
            )}
          </div>
        </header>

        <div className="grid-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="section-title">世界公开大厅</h2>
                <button className="btn btn-tertiary" onClick={refreshRooms}>同步刷新</button>
              </div>
              <p className="section-desc">当前面向全网公开的棋局，任意挑战者均享有白方落子抢位特权。</p>
              {renderRoomList(publicRooms, '暂无活跃公开棋局，点击右侧建立新战线。')}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="section-title">我的个人战局 (近30局)</h2>
              </div>
              {currentUser ? renderRoomList(historyRooms, '您的足迹未曾涉及任一棋盘。') : (
                <div className="empty-state">
                  <p style={{ margin: 0 }}>登录账户后可恢复完整的弈棋历史绑定树。</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="panel">
              <h2 className="section-title" style={{ marginBottom: '8px' }}>开辟新棋局</h2>
              <p className="section-desc">您将作为房主默认执黑子先行。私密局自动生成 6 位反混淆一次性密码。</p>
              <div className="action-buttons">
                <button className="btn btn-primary" onClick={() => handleCreateRoom(true)} disabled={isCreating || isNavigating}>
                  {isNavigating ? '连接中...' : '创建公开局'}
                </button>
                <button className="btn btn-secondary" onClick={() => handleCreateRoom(false)} disabled={isCreating || isNavigating}>
                  {isNavigating ? '连接中...' : '建立加密私密局'}
                </button>
              </div>
            </div>

            <div className="panel">
              <h2 className="section-title" style={{ marginBottom: '8px' }}>破译暗码加入</h2>
              <p className="section-desc">在下方框内键入受邀得来的 6 位特定战局暗码解锁边界。</p>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="请输入6位暗码"
                  maxLength={6}
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                  className="form-input secret-code-input"
                />
                <button className="btn btn-primary" onClick={handleJoinPrivate} disabled={isNavigating}>
                  {isNavigating ? '连接中...' : '安全解码并进入战场'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
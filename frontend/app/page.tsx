'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [secretCode, setSecretCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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
      console.warn('获取当前用户失败:', error);
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

  const handleCreateRoom = async (isPublic: boolean) => {
    if (!currentUser) {
      alert('请先登录后再创建对局');
      router.push('/login');
      return;
    }

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
          alert(`创建成功！请牢记您的暗码：${data.secretCode}\n将此暗码分享给对手。`);
        }
        router.push(`/board/${data.boardId}`);
      } else {
        alert('创建失败: ' + (data.error || '服务器返回异常'));
      }
    } catch (error) {
      alert('网络请求失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinPrivate = async () => {
    if (!currentUser) {
      alert('请先登录后再加入私密对局');
      router.push('/login');
      return;
    }

    if (secretCode.length !== 6) {
      alert('请输入 6 位正确的暗码');
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
        alert(data.error || '暗码无效');
      }
    } catch (error) {
      alert('验证请求失败');
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
          <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <p>正在同步对局数据...</p>
        </div>
      );
    }

    if (rooms.length === 0) {
      return (
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="room-list">
        {rooms.map((room) => (
          <div className="room-card" key={room.id}>
            <div className="room-info">
              <div className="room-title">
                <span>对局 #{room.id}</span>
              </div>
              <StatusBadge status={room.status} />
            </div>
            <button className="btn btn-secondary" onClick={() => router.push(`/board/${room.id}`)}>
              <span>观战 / 进入</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <span className="headline-tag">Gomoku Unlimited</span>
          <h1 className="page-title">异步五子棋</h1>
          <p className="page-subtitle">
            打破实时对齐压力。建立对局，分配阵营，数据落盘。随时随地接续你的棋局。
          </p>
          <div className="auth-status-bar">
            {currentUser ? (
              <div className="user-info">
                已登录：<strong>{currentUser.username}</strong>
                <button className="btn btn-tertiary" type="button" onClick={handleLogout}>
                  退出登录
                </button>
              </div>
            ) : (
              <div className="user-info">
                <span>您当前未登录。</span>
                <button className="btn btn-primary" type="button" onClick={() => router.push('/login')}>
                  登录
                </button>
                <button className="btn btn-tertiary" type="button" onClick={() => router.push('/register')}>
                  注册
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="grid-layout">
          <div className="left-column" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="section-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    世界大厅
                  </h2>
                </div>
                <button className="btn btn-tertiary" onClick={refreshRooms}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                  刷新
                </button>
              </div>
              <p className="section-desc">当前公开的活跃对局，任何人都可以争夺白子首发权。</p>
              {renderRoomList(publicRooms, '大厅空空如也，快去创立一局吧！')}
            </div>

            <div className="panel">
              <div className="panel-header" style={{ marginBottom: '16px', paddingBottom: '16px' }}>
                <h2 className="section-title" style={{ fontSize: '1.2rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  我的战局 (近 30 局)
                </h2>
              </div>
              {currentUser ? renderRoomList(historyRooms, '您还没有参与过任何对局。') : (
                <div className="empty-state">
                  <p>登录后可查看自己的历史对局。</p>
                </div>
              )}
            </div>
          </div>

          <div className="right-column" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="panel">
              <h2 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                发起对局
              </h2>
              <p className="section-desc" style={{ marginBottom: '24px' }}>
                房主默认执黑先行。公开局将展示在大厅，私密局需要 6 位暗码进入。
              </p>
              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreateRoom(true)}
                  disabled={isCreating}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                  创建公开局
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleCreateRoom(false)}
                  disabled={isCreating}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  建立私密局
                </button>
              </div>
            </div>

            <div className="panel">
              <h2 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                加入暗码局
              </h2>
              <p className="section-desc">受邀玩家输入对应的 6 位暗码进入战场。</p>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="请输入 6 位暗码"
                  maxLength={6}
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                  className="form-input secret-code-input"
                />
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleJoinPrivate}>
                  解码并进入战场
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Room {
  id: number;
  status: 'playing' | 'finished' | 'draw';
}

export default function LobbyPage() {
  const router = useRouter();
  const [secretCode, setSecretCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  useEffect(() => {
    const fetchPublicRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const res = await fetch('/api/game/lobby');
        if (!res.ok) {
          throw new Error('无法获取公开大厅数据');
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.rooms)) {
          setPublicRooms(data.rooms);
        } else {
          setPublicRooms([]);
        }
      } catch (error) {
        console.error('拉取公开大厅失败:', error);
        setPublicRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchPublicRooms();
  }, []);

  const handleCreateRoom = async (isPublic: boolean) => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      });
      const data = await res.json();

      if (data.success) {
        if (!isPublic) {
          alert(`创建成功！请牢记您的暗码：${data.secretCode}\n将此暗码分享给对手。`);
        }
        router.push(`/board/${data.boardId}`);
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (error) {
      alert('网络请求失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinPrivate = async () => {
    if (secretCode.length !== 6) {
      alert('请输入6位正确的暗码');
      return;
    }
    try {
      const res = await fetch('/api/game/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode }),
      });
      const data = await res.json();

      if (data.success) {
        router.push(`/board/${data.boardId}`);
      } else {
        alert(data.error || '暗码无效');
      }
    } catch (error) {
      alert('验证请求失败');
    }
  };

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <span className="headline-tag">异步五子棋</span>
          <h1 className="page-title">让每一局对弈都真实存储</h1>
          <p className="page-subtitle">打开真实对局大厅，创建或加入房间，所有落子都会写入数据库。</p>
        </header>

        <div className="grid-layout">
          <section className="panel panel-lobby">
            <div className="panel-header">
              <div>
                <h2 className="section-title">公开大厅</h2>
                <p className="section-desc">当前正在进行的公开对局会从后端直接读取。</p>
              </div>
              <button className="btn btn-tertiary" onClick={() => window.location.reload()}>
                刷新列表
              </button>
            </div>

            {isLoadingRooms ? (
              <div className="empty-state">正在加载房间列表...</div>
            ) : publicRooms.length === 0 ? (
              <div className="empty-state">当前没有公开房间，快去开一局吧！</div>
            ) : (
              <div className="room-list">
                {publicRooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-info">
                      <div className="room-title">对局 #{room.id}</div>
                      <div className="room-meta">
                        状态：<span className={`status-badge status-${room.status}`}>{room.status}</span>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => router.push(`/board/${room.id}`)}>
                      进入对局
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel panel-actions">
            <div className="section-block">
              <h3 className="section-title">创建对局</h3>
              <p className="section-desc">快速创建公开局或私密局，数据会自动写入数据库。</p>
              <div className="action-buttons">
                <button className="btn btn-primary" disabled={isCreating} onClick={() => handleCreateRoom(true)}>
                  创建公开局
                </button>
                <button className="btn btn-secondary" disabled={isCreating} onClick={() => handleCreateRoom(false)}>
                  创建私密局
                </button>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">加入暗码局</h3>
              <p className="section-desc">输入 6 位暗码直接进入私密对局。</p>
              <div className="input-group">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="输入暗码"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                  className="form-input"
                />
                <button className="btn btn-primary" onClick={handleJoinPrivate}>
                  验证并进入
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

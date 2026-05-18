'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/utils/auth';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
}

interface Game {
  id: number;
  status: string;
  is_public: boolean;
  created_at: string;
  winner_id: number | null;
  black_user_id: number | null;
  white_user_id: number | null;
  black_username: string | null;
  white_username: string | null;
}

interface Stats {
  totalUsers: number;
  totalGames: number;
  activeGames: number;
  finishedGames: number;
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

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [maxActiveGames, setMaxActiveGames] = useState<number>(5);
  const [maxUsers, setMaxUsers] = useState<number>(100);
  const [boardLifetimeHours, setBoardLifetimeHours] = useState<number>(2);
  const [gameTtlHours, setGameTtlHours] = useState<number>(2);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newMaxUsers, setNewMaxUsers] = useState<number | string>('');
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games'>('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, [activeTab]);

  const checkAdminAndLoadData = async () => {
    try {
      const meRes = await fetchWithAuth('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      
      const userRes = await fetchWithAuth(`/api/admin/users/${meData.user.id}`);
      if (!userRes.ok) {
        setError('获取用户信息失败，请检查权限');
        setLoading(false);
        return;
      }
      const userData = await userRes.json();

      if (!userData.user?.is_admin) {
        setError('您没有管理员权限 (403 Forbidden)');
        setLoading(false);
        return;
      }

      if (activeTab === 'stats') await loadStats();
      else if (activeTab === 'users') await loadUsers();
      else if (activeTab === 'games') await loadGames();
      
    } catch (err) {
      setError('网络异常或登录已失效，请重新登录。');
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const backendUrl = (globalThis as any).process?.env?.NEXT_PUBLIC_API_URL || '';
      const [statsRes, configRes] = await Promise.all([
        fetchWithAuth('/api/admin/stats'),
        fetchWithAuth(`${backendUrl}/api/admin/config`)
      ]);
      const statsData = await statsRes.json();
      const configData = await configRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (configData.success) {
        if (configData.max_active_games) setMaxActiveGames(configData.max_active_games);
        if (configData.max_users) setMaxUsers(configData.max_users);
        if (configData.board_lifetime_hours) setBoardLifetimeHours(configData.board_lifetime_hours);
        if (configData.game_ttl_hours) setGameTtlHours(configData.game_ttl_hours);
      }
    } catch (err) {
      setError('加载统计信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } finally { setLoading(false); }
  };

  const loadGames = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/games');
      const data = await res.json();
      if (data.success) setGames(data.games);
    } finally { setLoading(false); }
  };

  const toggleAdmin = async (userId: number, currentStatus: boolean) => {
    try {
      const res = await fetchWithAuth('/api/admin/users/' + userId + '/admin', {
        method: 'PUT',
        body: JSON.stringify({ userId, isAdmin: !currentStatus }),
      });
      if (res.ok) await loadUsers();
      else alert('操作失败');
    } catch (err) { alert('操作失败'); }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`💣 危险操作\n\n确定要删除用户 "${username}" 吗？这将会清空他的所有落子记录。`)) return;
    try {
      const res = await fetchWithAuth('/api/admin/users/' + userId, { method: 'DELETE' });
      if (res.ok) {
        await loadUsers();
        await loadStats();
      } else alert('删除失败');
    } catch (err) { alert('删除失败'); }
  };

  const handleSaveSetting = async (key: string, value: number) => {
    setIsSavingSettings(true);
    try {
      const backendUrl = (globalThis as any).process?.env?.NEXT_PUBLIC_API_URL || '';
      const payload: Record<string, number> = {};
      payload[key] = value;
      const res = await fetchWithAuth(`${backendUrl}/api/admin/config`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('参数重载下发成功');
      } else {
        alert('参数持久化失败');
      }
    } catch (err) {
      alert('请求物理异常');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdMsg({ ok: false, text: '请填写所有字段' });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ ok: false, text: '两次新密码不一致' });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdMsg({ ok: false, text: '新密码至少 6 位' });
      return;
    }
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      const res = await fetchWithAuth('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwdMsg({ ok: true, text: '密码修改成功' });
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
      } else {
        setPwdMsg({ ok: false, text: data.error || '修改失败' });
      }
    } catch {
      setPwdMsg({ ok: false, text: '网络异常' });
    } finally {
      setPwdLoading(false);
    }
  };

  const deleteGame = async (gameId: number) => {
    if (!confirm('💣 危险操作\n\n确定要强制销毁此对局吗？此操作不可撤销。')) return;
    try {
      const res = await fetchWithAuth('/api/admin/games/' + gameId, { method: 'DELETE' });
      if (res.ok) {
        await loadGames();
        await loadStats();
      } else alert('删除失败');
    } catch (err) { alert('删除失败'); }
  };

  // 错误拦截页面
  if (error) {
    return (
      <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state" style={{ padding: '60px', maxWidth: '400px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <h2 style={{ color: '#ef4444', marginTop: '10px' }}>访问被拒绝</h2>
          <p style={{ margin: '10px 0 20px', lineHeight: '1.6' }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>返回大厅</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container">
        
        <header className="page-header" style={{ textAlign: 'left', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span className="headline-tag">SYSTEM CONSOLE</span>
            <h1 className="page-title" style={{ fontSize: '2.5rem' }}>系统控制台</h1>
          </div>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            返回前台
          </button>
        </header>

        <div className="admin-tabs">
          <button className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-tertiary'}`} onClick={() => setActiveTab('stats')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
            系统大盘
          </button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-tertiary'}`} onClick={() => setActiveTab('users')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            用户管辖
          </button>
          <button className={`btn ${activeTab === 'games' ? 'btn-primary' : 'btn-tertiary'}`} onClick={() => setActiveTab('games')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            战局监控
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p>正在读取底层数据...</p>
          </div>
        ) : (
          <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
            
            {/* Tab 1: 统计大盘 */}
            {activeTab === 'stats' && stats && (
              <div style={{ padding: '32px' }}>
                <div className="stats-grid">
                  <div className="stat-card stat-card-users">
                    <span className="stat-label">注册用户总数</span>
                    <span className="stat-value">{stats.totalUsers}</span>
                  </div>
                  <div className="stat-card stat-card-games">
                    <span className="stat-label">历史对局总数</span>
                    <span className="stat-value">{stats.totalGames}</span>
                  </div>
                  <div className="stat-card stat-card-active">
                    <span className="stat-label">当前激战中</span>
                    <span className="stat-value">{stats.activeGames}</span>
                  </div>
                  <div className="stat-card stat-card-finished">
                    <span className="stat-label">已判定胜负/和局</span>
                    <span className="stat-value">{stats.finishedGames}</span>
                  </div>
                </div>

                {/* 全局设置面板 */}
                <div className="mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '32px' }}>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#f8f9fb' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    参数调优
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {/* 原有功能：单人最大对局数 */}
                    <div className="panel" style={{ padding: '24px' }}>
                      <label className="block text-gray-400 text-sm mb-3 font-medium">单人同时进行中的最大对局数</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="number" min="1" max="50"
                          value={maxActiveGames}
                          onChange={(e) => setMaxActiveGames(parseInt(e.target.value) || 1)}
                          className="form-input"
                        />
                        <button
                          onClick={() => handleSaveSetting('max_active_games', maxActiveGames)}
                          disabled={isSavingSettings}
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          保存修改
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px' }}>
                        修改后即刻生效，限制用户同时开局的数量，防范恶意霸占系统资源。
                      </p>
                    </div>

                    {/* 棋盘生命周期 */}
                    <div className="panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', top: 0, right: 0, width: '128px', height: '128px',
                        background: 'rgba(20, 184, 166, 0.1)', filter: 'blur(40px)', borderRadius: '50%',
                        transform: 'translate(50%, -50%)', pointerEvents: 'none'
                      }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <label className="block text-gray-400 text-sm font-medium">棋盘最大存活时间（小时）</label>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(31, 41, 55, 1)', color: '#2dd4bf', padding: '4px 8px', borderRadius: '4px' }}>
                          当前: <strong style={{ color: 'white', marginLeft: '4px' }}>{boardLifetimeHours}h</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="number" min="1" max="720"
                          value={boardLifetimeHours}
                          onChange={(e) => setBoardLifetimeHours(parseInt(e.target.value) || 1)}
                          className="form-input"
                        />
                        <button
                          onClick={() => handleSaveSetting('board_lifetime_hours', boardLifetimeHours)}
                          disabled={isSavingSettings}
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {isSavingSettings ? '提交中...' : '保存修改'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px' }}>
                        新建棋盘将采用此设置，超时后棋盘自动关闭无法继续落子。已有棋盘不受影响。
                      </p>
                    </div>

                    {/* 全新功能：全局注册人数上限 */}
                    <div className="panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      {/* 装饰性背景光晕 */}
                      <div style={{
                        position: 'absolute', top: 0, right: 0, width: '128px', height: '128px',
                        background: 'rgba(147, 51, 234, 0.1)', filter: 'blur(40px)', borderRadius: '50%',
                        transform: 'translate(50%, -50%)', pointerEvents: 'none'
                      }}></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <label className="block text-gray-400 text-sm font-medium">系统全局注册人数上限</label>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(31, 41, 55, 1)', color: '#a78bfa', padding: '4px 8px', borderRadius: '4px' }}>
                          当前: <strong style={{ color: 'white', marginLeft: '4px' }}>{maxUsers}</strong> 人
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="number"
                          value={newMaxUsers}
                          onChange={(e) => setNewMaxUsers(e.target.value)}
                          placeholder="输入新的全局熔断阈值"
                          className="form-input"
                          min={1}
                        />
                        <button
                          onClick={() => {
                            if (!newMaxUsers || isNaN(Number(newMaxUsers))) return;
                            handleSaveSetting('max_users', Number(newMaxUsers));
                            setNewMaxUsers('');
                          }}
                          disabled={isSavingSettings || !newMaxUsers}
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {isSavingSettings ? '提交中...' : '保存修改'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px' }}>
                        修改后即刻更新 Redis 与 PostgreSQL。当注册总数达到此阈值时，自动闭站触发物理熔断，停止新用户注册。
                      </p>
                    </div>

                    {/* 动态生命周期控制 (TTL) */}
                    <div className="panel" style={{ padding: '24px' }}>
                      <label className="block text-gray-400 text-sm mb-3 font-medium">棋局默认存活时长 (小时)</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="number" min="0.5" max="72" step="0.5"
                          value={gameTtlHours}
                          onChange={(e) => setGameTtlHours(parseFloat(e.target.value) || 2)}
                          className="form-input"
                        />
                        <button
                          onClick={() => handleSaveSetting('game_ttl_hours', gameTtlHours)}
                          disabled={isSavingSettings}
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {isSavingSettings ? '提交中...' : '保存修改'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px' }}>
                        修改后将作为新建对局的默认 TTL。超时后该局将触发物理销毁保护，防止"僵尸局"无限期锁定资源。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 修改密码面板 */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '32px', marginTop: '32px' }}>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#f8f9fb' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    修改管理员密码
                  </h2>
                  <div className="panel" style={{ padding: '24px', maxWidth: '480px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>当前密码</label>
                        <input
                          type="password"
                          value={pwdCurrent}
                          onChange={(e) => setPwdCurrent(e.target.value)}
                          placeholder="输入当前密码"
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>新密码</label>
                        <input
                          type="password"
                          value={pwdNew}
                          onChange={(e) => setPwdNew(e.target.value)}
                          placeholder="至少 6 位"
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>确认新密码</label>
                        <input
                          type="password"
                          value={pwdConfirm}
                          onChange={(e) => setPwdConfirm(e.target.value)}
                          placeholder="再次输入新密码"
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                      {pwdMsg && (
                        <p style={{ fontSize: '0.8rem', color: pwdMsg.ok ? '#10b981' : '#ef4444', margin: 0 }}>
                          {pwdMsg.ok ? '✅ ' : '❌ '}{pwdMsg.text}
                        </p>
                      )}
                      <button
                        onClick={handleChangePassword}
                        disabled={pwdLoading}
                        className="btn btn-primary"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {pwdLoading ? '提交中...' : '确认修改'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 用户列表 */}
            {activeTab === 'users' && (
              <div className="admin-table-wrapper" style={{ border: 'none', borderRadius: '0' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>UID</th>
                      <th>登录名</th>
                      <th>权限组</th>
                      <th>注册时间</th>
                      <th style={{ textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td><span style={{ color: '#a78bfa', fontWeight: 'bold' }}>#{user.id}</span></td>
                        <td style={{ fontWeight: '600' }}>{user.username}</td>
                        <td>
                          {user.is_admin ? (
                            <span className="status-badge status-playing">系统管理员</span>
                          ) : (
                            <span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>普通用户</span>
                          )}
                        </td>
                        <td style={{ color: '#94a3b8' }}>{new Date(user.created_at).toLocaleString('zh-CN')}</td>
                        <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => toggleAdmin(user.id, user.is_admin)}
                            className={`btn btn-sm ${user.is_admin ? 'btn-secondary' : 'btn-success'}`}
                          >
                            {user.is_admin ? '降级' : '设为管理'}
                          </button>
                          <button onClick={() => deleteUser(user.id, user.username)} className="btn btn-sm btn-danger">
                            封号销户
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: 对局列表 */}
            {activeTab === 'games' && (
              <div className="admin-table-wrapper" style={{ border: 'none', borderRadius: '0' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>局号</th>
                      <th>黑方 (执导)</th>
                      <th>白方 (挑战)</th>
                      <th>当前状态</th>
                      <th>可见性</th>
                      <th>开局时间</th>
                      <th style={{ textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <tr key={game.id}>
                        <td><span style={{ color: '#38bdf8', fontWeight: 'bold' }}>#{game.id}</span></td>
                        <td>{game.black_username || <span style={{ color: '#64748b' }}>-</span>}</td>
                        <td>{game.white_username || <span style={{ color: '#64748b' }}>虚位以待</span>}</td>
                        <td><StatusBadge status={game.status} /></td>
                        <td>
                          {game.is_public ? (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> 公开
                            </span>
                          ) : (
                            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> 密钥
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#94a3b8' }}>{new Date(game.created_at).toLocaleString('zh-CN')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => deleteGame(game.id)} className="btn btn-sm btn-danger">
                            强制销毁
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

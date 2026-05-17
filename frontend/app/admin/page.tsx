'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/utils/auth';

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

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'stats'>('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, [activeTab]);

  const checkAdminAndLoadData = async () => {
    try {
      const meRes = await fetchWithAuth('/api/auth/me');
      if (!meRes.ok) {
        window.location.href = '/login';
        return;
      }
      const meData = await meRes.json();
      
      const userRes = await fetchWithAuth(`/api/admin/users/${meData.user.id}`);
      const userData = await userRes.json();
      setIsAdmin(userData.user?.is_admin || false);

      if (!userData.user?.is_admin) {
        setError('您没有管理员权限');
        setLoading(false);
        return;
      }

      if (activeTab === 'stats') {
        await loadStats();
      } else if (activeTab === 'users') {
        await loadUsers();
      } else if (activeTab === 'games') {
        await loadGames();
      }
    } catch (err) {
      setError('加载失败，请检查登录状态');
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
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
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      setError('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/games');
      const data = await res.json();
      if (data.success) {
        setGames(data.games);
      }
    } catch (err) {
      setError('加载对局列表失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: number, currentStatus: boolean) => {
    try {
      const res = await fetchWithAuth('/api/admin/users/' + userId + '/admin', {
        method: 'PUT',
        body: JSON.stringify({ userId, isAdmin: !currentStatus }),
      });
      if (res.ok) {
        await loadUsers();
      } else {
        alert('操作失败');
      }
    } catch (err) {
      alert('操作失败');
    }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销。`)) return;
    try {
      const res = await fetchWithAuth('/api/admin/users/' + userId, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadUsers();
        await loadStats();
      } else {
        alert('删除失败');
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  const deleteGame = async (gameId: number) => {
    if (!confirm('确定要删除此对局吗？此操作不可撤销。')) return;
    try {
      const res = await fetchWithAuth('/api/admin/games/' + gameId, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadGames();
        await loadStats();
      } else {
        alert('删除失败');
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">错误</h1>
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">管理后台</h1>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded ${activeTab === 'stats' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            统计信息
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            用户管理
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 rounded ${activeTab === 'games' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            对局管理
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">总用户数</h3>
              <p className="text-3xl font-bold text-blue-400">{stats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">总对局数</h3>
              <p className="text-3xl font-bold text-green-400">{stats.totalGames}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">进行中</h3>
              <p className="text-3xl font-bold text-yellow-400">{stats.activeGames}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">已结束</h3>
              <p className="text-3xl font-bold text-purple-400">{stats.finishedGames}</p>
            </div>
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">用户名</th>
                  <th className="px-6 py-3 text-left">管理员</th>
                  <th className="px-6 py-3 text-left">创建时间</th>
                  <th className="px-6 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-700">
                    <td className="px-6 py-4">{user.id}</td>
                    <td className="px-6 py-4">{user.username}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleAdmin(user.id, user.is_admin)}
                        className={`px-3 py-1 rounded text-sm ${
                          user.is_admin
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                      >
                        {user.is_admin ? '是' : '否'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(user.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        className="px-3 py-1 bg-red-500 rounded hover:bg-red-600 text-sm"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeTab === 'games' && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">黑方</th>
                  <th className="px-6 py-3 text-left">白方</th>
                  <th className="px-6 py-3 text-left">状态</th>
                  <th className="px-6 py-3 text-left">类型</th>
                  <th className="px-6 py-3 text-left">创建时间</th>
                  <th className="px-6 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game.id} className="border-t border-gray-700">
                    <td className="px-6 py-4">{game.id}</td>
                    <td className="px-6 py-4">{game.black_username || '未绑定'}</td>
                    <td className="px-6 py-4">{game.white_username || '未绑定'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          game.status === 'playing'
                            ? 'bg-yellow-500'
                            : game.status === 'finished'
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                        }`}
                      >
                        {game.status === 'playing'
                          ? '进行中'
                          : game.status === 'finished'
                          ? '已结束'
                          : '和局'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {game.is_public ? '公开' : '私密'}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(game.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteGame(game.id)}
                        className="px-3 py-1 bg-red-500 rounded hover:bg-red-600 text-sm"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

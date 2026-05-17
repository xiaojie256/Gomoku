'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 临时模拟的数据类型
interface Room {
    id: number;
    creatorName: string;
    createdAt: string;
    status: 'playing' | 'finished' | 'draw';
}

export default function LobbyPage() {
    const router = useRouter();
    const [secretCode, setSecretCode] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // 模拟大厅中展示的"公开局"数据
    const [publicRooms] = useState<Room[]>([
        { id: 101, creatorName: '小孑', createdAt: '2小时前', status: 'playing' },
        { id: 102, creatorName: '玩家A', createdAt: '5小时前', status: 'playing' },
    ]);

    // 处理创建棋局
    const handleCreateRoom = async (isPublic: boolean) => {
        setIsCreating(true);
        try {
            const res = await fetch('/api/game/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic })
            });
            const data = await res.json();
            
            if (data.success) {
                if (!isPublic) {
                    // 如果是私密局，通过弹窗告知房主暗码
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

    // 处理输入暗码加入
    const handleJoinPrivate = async () => {
        if (secretCode.length !== 6) {
            alert('请输入6位正确的暗码');
            return;
        }
        try {
            const res = await fetch('/api/game/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secretCode })
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
        <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-800">
            <div className="max-w-5xl mx-auto">
                
                {/* 头部标题 */}
                <header className="mb-10 text-center md:text-left">
                    <h1 className="text-4xl font-extrabold text-amber-900 tracking-tight mb-2">异步五子棋</h1>
                    <p className="text-gray-500">慢节奏的博弈，随时随地续写你的棋局。</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* 左侧：大厅列表 */}
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-2xl font-bold border-b pb-4 mb-4 text-gray-800">公开大厅</h2>
                        {publicRooms.length === 0 ? (
                            <p className="text-gray-400 text-center py-10">当前没有公开的棋局，快去开一局吧！</p>
                        ) : (
                            <div className="space-y-4">
                                {publicRooms.map((room) => (
                                    <div key={room.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-amber-50 transition-colors">
                                        <div>
                                            <div className="font-semibold text-lg">对局 #{room.id}</div>
                                            <div className="text-sm text-gray-500">房主: {room.creatorName} · {room.createdAt}</div>
                                        </div>
                                        <button 
                                            onClick={() => router.push(`/board/${room.id}`)}
                                            className="px-5 py-2 bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors font-medium shadow-sm"
                                        >
                                            进入对局
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 右侧：操作区 */}
                    <div className="space-y-6">
                        {/* 建局面板 */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-xl font-bold mb-4">开设新局</h3>
                            <p className="text-xs text-gray-500 mb-6">默认执黑先手。单人最多同开 5 局，数据保留 10 天。</p>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => handleCreateRoom(true)}
                                    disabled={isCreating}
                                    className="w-full py-3 bg-amber-800 text-white rounded-xl hover:bg-amber-900 transition-colors font-medium shadow-sm disabled:opacity-50"
                                >
                                    创建公开局
                                </button>
                                <button 
                                    onClick={() => handleCreateRoom(false)}
                                    disabled={isCreating}
                                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                                >
                                    创建私密局 (6位暗码)
                                </button>
                            </div>
                        </div>

                        {/* 私密加入面板 */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-xl font-bold mb-4">加入私密局</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    maxLength={6}
                                    placeholder="输入6位暗码" 
                                    value={secretCode}
                                    onChange={(e) => setSecretCode(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-800 font-mono tracking-widest text-center"
                                />
                            </div>
                            <button 
                                onClick={handleJoinPrivate}
                                className="w-full mt-3 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-medium"
                            >
                                验证并进入
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}

'use client';

import GomokuBoard from '@/components/GomokuBoard';
import { useRouter } from 'next/navigation';

export default function BoardPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    
    return (
        <main className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
            <div className="w-full max-w-3xl flex justify-between items-center mb-6 px-4">
                <h1 className="text-2xl font-bold text-gray-800">对局 #{params.id}</h1>
                <button 
                    onClick={() => router.push('/')}
                    className="px-4 py-2 bg-white text-gray-600 rounded-lg shadow-sm hover:bg-gray-50"
                >
                    返回大厅
                </button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8">
                {/* 这里的 GomokuBoard 就是你之前已经跑通的那个组件 */}
                {/* 稍后我们会修改它，让它接收 params.id 作为真实的棋盘 ID */}
                <GomokuBoard />
            </div>
        </main>
    );
}

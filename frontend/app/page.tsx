'use client';

import GomokuBoard from '@/components/GomokuBoard';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          五子棋
        </h1>
        <GomokuBoard />
      </div>
    </main>
  );
}

'use client';

import GomokuBoard from '@/components/GomokuBoard';
import Link from 'next/link';

export default function BoardPage({ params }: { params: { id: string } }) {
  const boardId = parseInt(params.id, 10);

  return (
    <main className="board-shell">
      <div className="page-container">
        <div className="board-header">
          <div>
            <p className="headline-tag">对局页面</p>
            <h1 className="page-title">对局 #{boardId}</h1>
            <p className="page-subtitle">棋局数据来自真实后端存储，落子记录会同步保存。</p>
          </div>
          <Link href="/" className="btn btn-tertiary">
            返回大厅
          </Link>
        </div>

        <div className="board-panel">
          <div className="board-info-card">
            <div className="info-item">
              <span className="info-label">棋局编号</span>
              <span className="info-value">#{boardId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">存储方式</span>
              <span className="info-value">PostgreSQL + Redis</span>
            </div>
          </div>

          <div className="board-widget">
            <GomokuBoard boardId={boardId} />
          </div>
        </div>
      </div>
    </main>
  );
}

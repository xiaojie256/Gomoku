import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '五子棋 - Gomoku',
  description: '基于 Canvas 的高自由度异步棋盘系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

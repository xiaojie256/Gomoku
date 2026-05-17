'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const BOARD_SIZE = 15;
const CELL_SIZE = 40;
const BOARD_PADDING = 30;

type Player = 1 | 2; // 1: 黑子, 2: 白子
type GameState = 0 | 1 | -1; // 0: 继续, 1: 胜利, -1: 和局

interface MoveRecord {
  x: number;
  y: number;
  player: Player;
}

interface BoardState {
  board: number[]; // 225 长度的一维数组
  currentPlayer: Player;
  gameState: GameState;
  winner: Player | null;
  moveHistory: MoveRecord[]; // 记录落子历史用以渲染序号
}

export default function GomokuBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boardState, setBoardState] = useState<BoardState>({
    board: Array(225).fill(0),
    currentPlayer: 1,
    gameState: 0,
    winner: null,
    moveHistory: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  // 绘制棋盘与棋子
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 绘制棋盘底色
    ctx.fillStyle = '#DEB887'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 绘制网格线
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING, BOARD_PADDING + i * CELL_SIZE);
      ctx.lineTo(BOARD_PADDING + (BOARD_SIZE - 1) * CELL_SIZE, BOARD_PADDING + i * CELL_SIZE);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING + i * CELL_SIZE, BOARD_PADDING);
      ctx.lineTo(BOARD_PADDING + i * CELL_SIZE, BOARD_PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
      ctx.stroke();
    }

    // 3. 绘制星位
    const starPoints = [[3, 3], [3, 7], [3, 11], [7, 3], [7, 7], [7, 11], [11, 3], [11, 7], [11, 11]];
    ctx.fillStyle = '#8B4513';
    starPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(BOARD_PADDING + x * CELL_SIZE, BOARD_PADDING + y * CELL_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. 绘制棋子本体与“气泡子”落子序号
    boardState.moveHistory.forEach((move, index) => {
      const xPixel = BOARD_PADDING + move.x * CELL_SIZE;
      const yPixel = BOARD_PADDING + move.y * CELL_SIZE;

      // 绘制棋子
      ctx.beginPath();
      ctx.arc(xPixel, yPixel, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(xPixel - 5, yPixel - 5, 2, xPixel, yPixel, CELL_SIZE / 2 - 2);
      if (move.player === 1) {
        gradient.addColorStop(0, '#666');
        gradient.addColorStop(1, '#000');
      } else {
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ddd');
      }
      ctx.fillStyle = gradient;
      ctx.fill();

      // 【特殊场景强制约束】气泡子样式渲染落子序号：中心镂空，绝对禁止 fillText
      const moveNumber = (index + 1).toString();
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 黑子用白边，白子用黑边，保留内部镂空视觉连贯性
      ctx.strokeStyle = move.player === 1 ? '#FFFFFF' : '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeText(moveNumber, xPixel, yPixel);
    });
  }, [boardState.moveHistory]);

  // 处理落子点击
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (boardState.gameState !== 0 || isLoading) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const gridX = Math.round((x - BOARD_PADDING) / CELL_SIZE);
    const gridY = Math.round((y - BOARD_PADDING) / CELL_SIZE);

    if (gridX < 0 || gridX >= BOARD_SIZE || gridY < 0 || gridY >= BOARD_SIZE) return;

    const index = gridY * BOARD_SIZE + gridX;
    if (boardState.board[index] !== 0) return;

    setIsLoading(true);

    try {
      // 【核心修复】boardId 改为数字 1，userId 改为数字对齐 Postgres INT 类型
      const response = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: 1, 
          userId: 99, 
          x: gridX,
          y: gridY,
          player: boardState.currentPlayer,
          currentBoardArray: boardState.board,
        }),
      });

      if (!response.ok) throw new Error('后端返回异常状态');

      const data = await response.json();

      const newBoard = [...boardState.board];
      newBoard[index] = boardState.currentPlayer;

      const newMove: MoveRecord = { x: gridX, y: gridY, player: boardState.currentPlayer };

      setBoardState({
        board: newBoard,
        currentPlayer: boardState.currentPlayer === 1 ? 2 : 1,
        gameState: data.gameState,
        winner: data.gameState === 1 ? boardState.currentPlayer : null,
        moveHistory: [...boardState.moveHistory, newMove],
      });
    } catch (error) {
      console.error('落子错误:', error);
      alert('落子失败，请确认后端 Node 端口已开启且数据库配置正确');
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = () => {
    setBoardState({
      board: Array(225).fill(0),
      currentPlayer: 1,
      gameState: 0,
      winner: null,
      moveHistory: [],
    });
  };

  useEffect(() => {
    drawBoard();
  }, [drawBoard]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex items-center gap-4">
        <div className="text-lg font-semibold text-gray-700">
          当前玩家: {boardState.currentPlayer === 1 ? '黑子' : '白子'}
        </div>
        {boardState.gameState !== 0 && (
          <div className="text-lg font-bold text-red-600">
            {boardState.gameState === 1 ? `${boardState.winner === 1 ? '黑子' : '白子'} 获胜!` : '和局!'}
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={BOARD_PADDING * 2 + (BOARD_SIZE - 1) * CELL_SIZE}
        height={BOARD_PADDING * 2 + (BOARD_SIZE - 1) * CELL_SIZE}
        onClick={handleCanvasClick}
        className="border-4 border-amber-900 rounded cursor-pointer shadow-lg"
        style={{ cursor: isLoading ? 'wait' : 'pointer' }}
      />

      <div className="mt-4 flex gap-4">
        {boardState.gameState !== 0 && (
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            重新开始
          </button>
        )}
        {isLoading && <div className="text-gray-600 font-medium">正在处理...</div>}
      </div>
    </div>
  );
}
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/auth';

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

interface GomokuBoardProps {
  boardId: number;
}

export default function GomokuBoard({ boardId }: GomokuBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boardState, setBoardState] = useState<BoardState>({
    board: Array(225).fill(0),
    currentPlayer: 1,
    gameState: 0,
    winner: null,
    moveHistory: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);
  const [boardInfo, setBoardInfo] = useState<any>({}); 
  const [replayStep, setReplayStep] = useState<number>(-1); // -1 表示最新进度

  // 1. 数据拉取逻辑中加入房主信息保存
  const fetchGameData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`/api/game/${boardId}`);
      if (!res.ok) throw new Error('对局不存在或服务器异常');
      const data = await res.json();

      if (data.success) {
        setBoardInfo(data.board); // 保存用来判断是否是房主
        // Check both move count and status changes to ensure updates for early end/draw scenarios
        if (data.moves.length === boardState.moveHistory.length && data.board.status === boardInfo.status) return;

        const newBoard = Array(225).fill(0);
        data.moves.forEach((move: MoveRecord) => {
          newBoard[move.y * 15 + move.x] = move.player;
        });

        const lastMove = data.moves[data.moves.length - 1];
        const nextPlayer = lastMove ? (lastMove.player === 1 ? 2 : 1) : 1;

        let currentGameState: GameState = 0;
        let currentWinner: Player | null = null;
        
        if (data.board.status === 'finished') {
          currentGameState = 1;
          currentWinner = lastMove ? lastMove.player : null; 
        } else if (data.board.status === 'draw') {
          currentGameState = -1;
        }

        setBoardState({
          board: newBoard,
          currentPlayer: nextPlayer as Player,
          gameState: currentGameState,
          winner: currentWinner,
          moveHistory: data.moves,
        });
      }
    } catch (error) {
      console.error('自动同步盘面异常:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [boardId, boardState.moveHistory.length, boardInfo.status]);

  // 2. 挂载智能可见性调度器 (Smart Polling Scheduler)
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.warn('获取当前用户失败:', error);
      }
    };

    loadCurrentUser();
    
    // 首次进入强制开启 Loading
    fetchGameData(true);

    let timerId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (timerId) clearInterval(timerId);
      // 慢节奏对局，设定 6 秒智能局部轻轮询即可
      timerId = setInterval(() => {
        // 仅在游戏未结束、非加载中、且页面处于激活可见状态时才请求后端
        if (boardState.gameState === 0 && document.visibilityState === 'visible' && !document.hidden) {
          fetchGameData(false); // 隐式无感刷新
        }
      }, 6000);
    };

    const stopPolling = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    // 监听浏览器标签页切换及休眠机制，严防空转对 1.8G 服务器造成多余负载
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGameData(false); // 回焦时主动拉取一次最新盘面
        startPolling();
      } else {
        stopPolling(); // 标签页切走时立刻断开轮询，腾出服务器 CPU
      }
    };

    // 启动轮询并注册监听
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 销毁时清理，严防前端内存泄漏
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchGameData, boardState.gameState]);

  // 3. 绘制逻辑改造：根据 replayStep 切割历史
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空重绘
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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

    // 切割需要展示的历史记录
    const movesToDraw = replayStep === -1 
        ? boardState.moveHistory 
        : boardState.moveHistory.slice(0, replayStep);

    movesToDraw.forEach((move, index) => {
      const xPixel = BOARD_PADDING + move.x * CELL_SIZE;
      const yPixel = BOARD_PADDING + move.y * CELL_SIZE;

      ctx.beginPath();
      ctx.arc(xPixel, yPixel, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(xPixel - 5, yPixel - 5, 2, xPixel, yPixel, CELL_SIZE / 2 - 2);
      if (move.player === 1) {
        gradient.addColorStop(0, '#666'); gradient.addColorStop(1, '#000');
      } else {
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#ddd');
      }
      ctx.fillStyle = gradient;
      ctx.fill();

      // 严格遵循小孑的"气泡子"视觉要求：中心镂空
      const moveNumber = (index + 1).toString();
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = move.player === 1 ? '#FFFFFF' : '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeText(moveNumber, xPixel, yPixel);
    });
  }, [boardState.moveHistory, replayStep]);

  // 处理落子点击
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (boardState.gameState !== 0 || isLoading || !currentUser) return;
    if (replayStep !== -1) return;

    // 验证回合与身份
    const isBlackTurn = boardState.currentPlayer === 1;
    const isWhiteTurn = boardState.currentPlayer === 2;
    const isBlackPlayer = boardInfo.black_user_id === currentUser.id;
    const isWhitePlayer = boardInfo.white_user_id === currentUser.id;

    if (isBlackTurn && !isBlackPlayer) {
      alert('当前是黑子回合，只有黑方玩家可以落子');
      return;
    }
    if (isWhiteTurn && !isWhitePlayer) {
      alert('当前是白子回合，只有白方玩家可以落子');
      return;
    }

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
      const response = await fetchWithAuth('/api/game/move', {
        method: 'POST',
        body: JSON.stringify({
          boardId,
          x: gridX,
          y: gridY,
          player: boardState.currentPlayer,
          currentBoardArray: boardState.board,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '后端返回异常状态');
      }

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
    } catch (error: any) {
      console.error('落子错误:', error);
      alert(`落子失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = async () => {
    // 如果是房主，调用后端重置接口以清空服务器端历史；否则仅重置本地视图作为临时体验
    if (boardInfo && boardInfo.black_user_id === currentUser?.id) {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth('/api/game/reset', {
          method: 'POST',
          body: JSON.stringify({ boardId }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await fetchGameData(true);
          setReplayStep(-1);
        } else {
          alert(data.error || '重置失败');
        }
      } catch (err) {
        console.error('重置请求失败:', err);
        alert('重置请求失败');
      } finally {
        setIsLoading(false);
      }
    } else {
      setBoardState({
        board: Array(225).fill(0),
        currentPlayer: 1,
        gameState: 0,
        winner: null,
        moveHistory: [],
      });
      setReplayStep(-1);
    }
  };

  // 处理提前结束
  const handleEndInAdvance = async () => {
      if (!confirm("确定要提前结束该局并认输吗？")) return;
      try {
          await fetchWithAuth('/api/game/end', {
              method: 'POST',
              body: JSON.stringify({ boardId }),
          });
          fetchGameData(true);
      } catch(e) {
          alert("操作失败");
      }
  };

  useEffect(() => {
    drawBoard();
  }, [drawBoard, replayStep]);

  return (
    <div className="gomoku-board-shell">
      <div className="board-status-row">
        <div className="board-status-card">
          <div className="board-status-label">当前玩家</div>
          <div className={`board-status-value board-status-${boardState.currentPlayer}`}>
            {boardState.currentPlayer === 1 ? '黑子' : '白子'}
          </div>
        </div>

        <div className="board-status-card">
          <div className="board-status-label">当前状态</div>
          <div className={`board-status-value board-result-${boardState.gameState}`}>
            {boardState.gameState === 0 ? '进行中' : boardState.gameState === 1 ? `${boardState.winner === 1 ? '黑子' : '白子'} 获胜` : '和局'}
          </div>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={BOARD_PADDING * 2 + (BOARD_SIZE - 1) * CELL_SIZE}
          height={BOARD_PADDING * 2 + (BOARD_SIZE - 1) * CELL_SIZE}
          onClick={handleCanvasClick}
          className="gomoku-canvas"
          style={{ cursor: isLoading ? 'wait' : 'pointer' }}
        />
      </div>

      <div className="board-footer">
        {boardState.gameState !== 0 && boardInfo.black_user_id === currentUser?.id && (
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            房主重置对局
          </button>
        )}
        {boardState.gameState !== 0 && boardInfo.black_user_id !== currentUser?.id && (
          <div className="board-note">本局已结束，仅房主可重置。</div>
        )}
        {!currentUser && (
          <div className="board-note">请先登录后才能落子或查看您的身份。</div>
        )}
        {isLoading && <div className="board-loading">正在处理...</div>}
      </div>

      <div className="board-controls" style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
          {boardState.moveHistory.length > 0 && (
              <input 
                  type="range" 
                  min={1} 
                  max={boardState.moveHistory.length} 
                  value={replayStep === -1 ? boardState.moveHistory.length : replayStep} 
                  onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setReplayStep(val === boardState.moveHistory.length ? -1 : val);
                  }}
                  style={{ flex: 1 }}
              />
          )}
          
          {boardInfo.black_user_id === currentUser?.id && boardState.gameState === 0 && (
              <button className="btn btn-secondary" onClick={handleEndInAdvance}>提前结束 (判负)</button>
          )}
      </div>
    </div>
  );
}
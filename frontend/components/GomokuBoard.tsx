'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/auth';

const BOARD_SIZE = 15;
const CELL_SIZE = 40;
const BOARD_PADDING = 30;

type Player = 1 | 2; 
type GameState = 0 | 1 | -1; 

interface MoveRecord {
  x: number;
  y: number;
  player: Player;
}

interface BoardState {
  board: number[]; 
  currentPlayer: Player;
  gameState: GameState;
  winner: Player | null;
  moveHistory: MoveRecord[]; 
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
  const [replayStep, setReplayStep] = useState<number>(-1);
  const [cellSize, setCellSize] = useState(CELL_SIZE);
  const [boardPadding, setBoardPadding] = useState(BOARD_PADDING);
  const [zoom, setZoom] = useState(1); 

  const fetchGameData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`/api/game/${boardId}`);
      if (!res.ok) throw new Error('对局不存在或服务器异常');
      const data = await res.json();

      if (data.success) {
        setBoardInfo(data.board); 
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
    fetchGameData(true);

    let timerId: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        if (boardState.gameState === 0 && document.visibilityState === 'visible' && !document.hidden) {
          fetchGameData(false); 
        }
      }, 6000);
    };

    const stopPolling = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGameData(false); 
        startPolling();
      } else {
        stopPolling(); 
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchGameData, boardState.gameState]);

  // 动态计算棋盘大小以适应屏幕
  useEffect(() => {
    const calculateBoardSize = () => {
      const screenWidth = window.innerWidth;
      const padding = 32; // 左右总边距
      const availableWidth = screenWidth - padding;
      
      // 计算合适的单元格大小，确保棋盘能完整显示
      // 棋盘需要 14 个格子宽度 + 2 个边距
      const maxCellSize = Math.floor((availableWidth - 60) / 14);
      
      // 设置最小和最大单元格大小
      const minCellSize = 20;
      const maxAllowedCellSize = 50;
      
      let newCellSize = Math.max(minCellSize, Math.min(maxAllowedCellSize, maxCellSize));
      let newBoardPadding = Math.max(15, Math.floor(newCellSize * 0.75));
      
      setCellSize(newCellSize);
      setBoardPadding(newBoardPadding);
    };

    calculateBoardSize();
    window.addEventListener('resize', calculateBoardSize);
    
    return () => {
      window.removeEventListener('resize', calculateBoardSize);
    };
  }, []);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#DEB887'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(boardPadding, boardPadding + i * cellSize);
      ctx.lineTo(boardPadding + (BOARD_SIZE - 1) * cellSize, boardPadding + i * cellSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boardPadding + i * cellSize, boardPadding);
      ctx.lineTo(boardPadding + i * cellSize, boardPadding + (BOARD_SIZE - 1) * cellSize);
      ctx.stroke();
    }

    const starPoints = [[3, 3], [3, 7], [3, 11], [7, 3], [7, 7], [7, 11], [11, 3], [11, 7], [11, 11]];
    ctx.fillStyle = '#8B4513';
    starPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(boardPadding + x * cellSize, boardPadding + y * cellSize, Math.max(3, cellSize * 0.1), 0, Math.PI * 2);
      ctx.fill();
    });

    const movesToDraw = replayStep === -1 
        ? boardState.moveHistory 
        : boardState.moveHistory.slice(0, replayStep);

    movesToDraw.forEach((move, index) => {
      const xPixel = boardPadding + move.x * cellSize;
      const yPixel = boardPadding + move.y * cellSize;

      ctx.beginPath();
      ctx.arc(xPixel, yPixel, cellSize / 2 - 2, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(xPixel - 5, yPixel - 5, 2, xPixel, yPixel, cellSize / 2 - 2);
      if (move.player === 1) {
        gradient.addColorStop(0, '#666'); gradient.addColorStop(1, '#000');
      } else {
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#ddd');
      }
      ctx.fillStyle = gradient;
      ctx.fill();

      // "气泡子"视觉中心孔状空心序号生成层
      const moveNumber = (index + 1).toString();
      ctx.font = `bold ${Math.max(10, cellSize * 0.35)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = move.player === 1 ? '#FFFFFF' : '#000000';
      ctx.lineWidth = Math.max(1, cellSize * 0.04);
      ctx.strokeText(moveNumber, xPixel, yPixel);
    });
  }, [boardState.moveHistory, replayStep, cellSize, boardPadding]);

  // 处理移动端手势解析
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (boardState.gameState !== 0 || isLoading || !currentUser) return;
    if (replayStep !== -1) return;

    const isBlackTurn = boardState.currentPlayer === 1;
    const isWhiteTurn = boardState.currentPlayer === 2;
    const isBlackPlayer = boardInfo.black_user_id === currentUser.id;
    const isWhitePlayer = boardInfo.white_user_id === currentUser.id;

    if (isBlackTurn && !isBlackPlayer) {
      alert('当前是黑子回合，只有黑方玩家可以落子');
      return;
    }
    if (isWhiteTurn && boardInfo.white_user_id && !isWhitePlayer) {
      alert('当前棋局的白子已被其他玩家抢先绑定，你无法落子');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // 兼容移动端各种缩放比例下的坐标精准抓取与像素对齐逻辑
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 考虑getBoundingClientRect在移动端受CSS拉伸产生的映射偏差，按画布固有宽高比例折算
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const gridX = Math.round(((x * scaleX) - boardPadding) / cellSize);
    const gridY = Math.round(((y * scaleY) - boardPadding) / cellSize);

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
      alert(`落子失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = async () => {
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
          <div className="board-status-label">当前回合</div>
          <div className={`board-status-value board-status-${boardState.currentPlayer}`}>
            {boardState.currentPlayer === 1 ? '黑子先行' : '白子下位'}
          </div>
        </div>

        <div className="board-status-card">
          <div className="board-status-label">判定结果</div>
          <div className={`board-status-value board-result-${boardState.gameState}`}>
            {boardState.gameState === 0 ? '激战中' : boardState.gameState === 1 ? `${boardState.winner === 1 ? '黑子' : '白子'} 胜` : '和局'}
          </div>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={boardPadding * 2 + (BOARD_SIZE - 1) * cellSize}
          height={boardPadding * 2 + (BOARD_SIZE - 1) * cellSize}
          onClick={handleCanvasClick}
          className="gomoku-canvas"
          style={{ 
            cursor: isLoading ? 'wait' : 'pointer',
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease-out'
          }}
        />
      </div>

      <div className="zoom-controls">
        <button 
          className="btn btn-secondary" 
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          disabled={zoom <= 0.5}
        >
          缩小
        </button>
        <span className="zoom-display">
          {Math.round(zoom * 100)}%
        </span>
        <button 
          className="btn btn-secondary" 
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          disabled={zoom >= 3}
        >
          放大
        </button>
        <button 
          className="btn btn-tertiary" 
          onClick={() => setZoom(1)}
        >
          重置
        </button>
      </div>

      <div className="board-controls">
          {boardState.moveHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(248,249,251,0.5)' }}>
                  拖动复盘历史轨迹：Step ({replayStep === -1 ? boardState.moveHistory.length : replayStep}/{boardState.moveHistory.length})
                </span>
                <input 
                    type="range" 
                    min={1} 
                    max={boardState.moveHistory.length} 
                    value={replayStep === -1 ? boardState.moveHistory.length : replayStep} 
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setReplayStep(val === boardState.moveHistory.length ? -1 : val);
                    }}
                    className="range-slider-mobile"
                />
              </div>
          )}
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
            {boardState.gameState !== 0 && boardInfo.black_user_id === currentUser?.id && (
              <button onClick={resetGame} className="btn btn-primary" style={{ flex: '1' }}>
                房主重置对局
              </button>
            )}
            {boardInfo.black_user_id === currentUser?.id && boardState.gameState === 0 && (
                <button className="btn btn-secondary" onClick={handleEndInAdvance} style={{ flex: '1' }}>投降认输 (判负)</button>
            )}
          </div>
      </div>

      <div className="board-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
        {boardState.gameState !== 0 && boardInfo.black_user_id !== currentUser?.id && (
          <div className="section-desc" style={{ margin: 0 }}>本局已定胜负，仅房主可以触发盘面洗牌重置。</div>
        )}
        {!currentUser && (
          <div className="section-desc" style={{ margin: 0, color: '#fca5a5' }}>检测到您未登录账号，无法承接落子身份。</div>
        )}
        {isLoading && <div className="status-badge status-playing" style={{ background: 'transparent' }}><span className="status-dot"></span>核心异步同步中...</div>}
      </div>
    </div>
  );
}
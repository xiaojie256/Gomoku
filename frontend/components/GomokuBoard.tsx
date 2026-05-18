'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/utils/auth';
import { io, Socket } from 'socket.io-client';

// 严格定义逻辑尺寸基准（Logical Coordinate Space Baseline）
const BOARD_SIZE = 15;
const BASE_CELL_SIZE = 40;
const BASE_PADDING = 30;
// 固定的逻辑画布基准总宽长：30 * 2 + 14 * 40 = 620
const LOGICAL_BOARD_SIZE = BASE_PADDING * 2 + (BOARD_SIZE - 1) * BASE_CELL_SIZE;

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
  const [pendingMove, setPendingMove] = useState<{ x: number; y: number } | null>(null);

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

    // WebSocket 连接（使用相对路径自动适配当前域名和协议）
    const socket: Socket = io('/', { path: '/socket.io' });

    socket.on('connect', () => {
      console.log('WebSocket 已连接');
      socket.emit('join_board', boardId);
    });

    socket.on('board_updated', (newData) => {
      console.log('收到棋盘更新:', newData);
      fetchGameData(false);
    });

    socket.on('board_terminated', (data) => {
      alert(data.message);
      window.location.href = '/';
    });

    socket.on('disconnect', () => {
      console.log('WebSocket 已断开');
    });

    return () => {
      socket.disconnect();
    };
  }, [boardId, fetchGameData]);

  // 高清重绘引擎（DPR Backing Store Rescale）
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 核心重构：自适应获取当前移动端物理像素比，重置物理分辨率，清除马赛克模糊
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = LOGICAL_BOARD_SIZE * dpr;
    canvas.height = LOGICAL_BOARD_SIZE * dpr;
    
    ctx.save();
    ctx.scale(dpr, dpr); // 矩阵整体缩放，内部绘图逻辑继续保持 620 基准，向下兼容

    ctx.clearRect(0, 0, LOGICAL_BOARD_SIZE, LOGICAL_BOARD_SIZE);
    
    // 1. 绘制棋盘底色
    ctx.fillStyle = '#DEB887'; 
    ctx.fillRect(0, 0, LOGICAL_BOARD_SIZE, LOGICAL_BOARD_SIZE);

    // 2. 绘制网格线
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(BASE_PADDING, BASE_PADDING + i * BASE_CELL_SIZE);
      ctx.lineTo(BASE_PADDING + (BOARD_SIZE - 1) * BASE_CELL_SIZE, BASE_PADDING + i * BASE_CELL_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(BASE_PADDING + i * BASE_CELL_SIZE, BASE_PADDING);
      ctx.lineTo(BASE_PADDING + i * BASE_CELL_SIZE, BASE_PADDING + (BOARD_SIZE - 1) * BASE_CELL_SIZE);
      ctx.stroke();
    }

    // 3. 绘制五子棋标准星位
    const starPoints = [[3, 3], [3, 7], [3, 11], [7, 3], [7, 7], [7, 11], [11, 3], [11, 7], [11, 11]];
    ctx.fillStyle = '#8B4513';
    starPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(BASE_PADDING + x * BASE_CELL_SIZE, BASE_PADDING + y * BASE_CELL_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. 动态切片落子渲染流程
    const movesToDraw = replayStep === -1 
        ? boardState.moveHistory 
        : boardState.moveHistory.slice(0, replayStep);

    movesToDraw.forEach((move, index) => {
      const xPixel = BASE_PADDING + move.x * BASE_CELL_SIZE;
      const yPixel = BASE_PADDING + move.y * BASE_CELL_SIZE;

      ctx.beginPath();
      ctx.arc(xPixel, yPixel, BASE_CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(xPixel - 5, yPixel - 5, 2, xPixel, yPixel, BASE_CELL_SIZE / 2 - 2);
      if (move.player === 1) {
        gradient.addColorStop(0, '#666'); gradient.addColorStop(1, '#000');
      } else {
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#ddd');
      }
      ctx.fillStyle = gradient;
      ctx.fill();

      // 气泡子视觉控制层（中心镂空，高清渲染）
      const moveNumber = (index + 1).toString();
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = move.player === 1 ? '#FFFFFF' : '#000000';
      ctx.lineWidth = 1.8;
      ctx.strokeText(moveNumber, xPixel, yPixel);
    });

    // 5. 绘制待确认的预选虚影与高亮准星
    if (pendingMove && replayStep === -1 && boardState.gameState === 0) {
      const xPixel = BASE_PADDING + pendingMove.x * BASE_CELL_SIZE;
      const yPixel = BASE_PADDING + pendingMove.y * BASE_CELL_SIZE;

      // 半透明棋子虚影
      ctx.beginPath();
      ctx.arc(xPixel, yPixel, BASE_CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = boardState.currentPlayer === 1 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      // 准星锁定框 (红色醒目提示再次点击)
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ef4444';
      const boxSize = BASE_CELL_SIZE - 4;
      ctx.strokeRect(xPixel - boxSize / 2, yPixel - boxSize / 2, boxSize, boxSize);
    }

    ctx.restore();
  }, [boardState.moveHistory, replayStep, pendingMove, boardState.currentPlayer, boardState.gameState]);

  // 高阶触控坐标归一化转换算法（Fix Click/Touch Alignment Bug）
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

    // 核心重构：弃用易受外部布局干扰的绝对像素点计算，转用视口相对比例逆推映射
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    // 严密公式：不论 CSS 将 Canvas 拉伸缩放到何种尺寸，比例乘逻辑总高宽皆能 100% 精准定位
    const logicalX = (clientX / rect.width) * LOGICAL_BOARD_SIZE;
    const logicalY = (clientY / rect.height) * LOGICAL_BOARD_SIZE;

    const gridX = Math.round((logicalX - BASE_PADDING) / BASE_CELL_SIZE);
    const gridY = Math.round((logicalY - BASE_PADDING) / BASE_CELL_SIZE);

    if (gridX < 0 || gridX >= BOARD_SIZE || gridY < 0 || gridY >= BOARD_SIZE) return;

    const index = gridY * BOARD_SIZE + gridX;
    if (boardState.board[index] !== 0) return;

    // 核心拦截：两次点击坐标不一致，设为预选并终止
    if (!pendingMove || pendingMove.x !== gridX || pendingMove.y !== gridY) {
      setPendingMove({ x: gridX, y: gridY });
      return;
    }

    // 两次点击坐标一致，进入落子提交流程
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
      setPendingMove(null);
    } catch (error: any) {
      alert(`落子失败: ${error.message}`);
      setPendingMove(null);
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
          setPendingMove(null);
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
      setPendingMove(null);
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
  }, [drawBoard, boardState.moveHistory, replayStep, pendingMove]);

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
          onClick={handleCanvasClick}
          className="gomoku-canvas"
          style={{ cursor: isLoading ? 'wait' : 'pointer' }}
        />
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
        {isLoading && <div className="status-badge status-playing" style={{ background: 'transparent' }}><span className="status-dot"></span>核心向后方同步中...</div>}
      </div>
    </div>
  );
}
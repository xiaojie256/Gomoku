'use client';

export function getOrCreateUserId(): number {
    if (typeof window === 'undefined') return 0; // 规避 Next.js SSR 报错
    
    const STORAGE_KEY = 'gomoku_user_id';
    let uidStr = localStorage.getItem(STORAGE_KEY);
    
    if (!uidStr) {
        // 生成 1 到 2147483647 之间的随机整数 (Postgres INT 最大值)
        const newUid = Math.floor(Math.random() * 2147483646) + 1;
        uidStr = newUid.toString();
        localStorage.setItem(STORAGE_KEY, uidStr);
    }
    
    return parseInt(uidStr, 10);
}

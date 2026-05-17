// test_wasm.js
const createGomokuLogic = require('./logic.js');

createGomokuLogic().then((wasmModule) => {
    // 1. 分配内存
    const pointer = wasmModule._malloc(900);
    
    // 2. 模拟盘面：黑子(1)在第一行横向连成5子 (坐标: 0,0 到 4,0)
    const mockBoard = new Int32Array(225).fill(0);
    for (let i = 0; i < 5; i++) mockBoard[i] = 1;

    // 3. 写入 WASM 内存
    for (let i = 0; i < 225; i++) {
        wasmModule.setValue(pointer + (i * 4), mockBoard[i], 'i32');
    }

    // 4. 调用判定函数
    // 假设最后一步落在 (4, 0)，当前玩家是黑子 (1)
    const state = wasmModule._check_game_state(pointer, 4, 0, 1);
    
    console.log("测试连五判定结果 (预期为 1，即黑胜):", state);

    // 5. 释放内存
    wasmModule._free(pointer);
}).catch(err => console.error(err));
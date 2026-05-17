#include <emscripten.h>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    // 移除前缀下划线，严格命名为 check_game_state
    int check_game_state(int* board, int last_x, int last_y, int player) {
        int dx[4] = {1, 0, 1, 1};
        int dy[4] = {0, 1, 1, -1};

        // 1. 连五检测
        for (int i = 0; i < 4; i++) {
            int count = 1; 
            for (int step = 1; step <= 4; step++) {
                int nx = last_x + dx[i] * step;
                int ny = last_y + dy[i] * step;
                if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny * 15 + nx] != player) break;
                count++;
            }
            for (int step = 1; step <= 4; step++) {
                int nx = last_x - dx[i] * step;
                int ny = last_y - dy[i] * step;
                if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[ny * 15 + nx] != player) break;
                count++;
            }
            if (count >= 5) return 1; 
        }

        // 2. 和局检测
        for (int i = 0; i < 225; i++) {
            if (board[i] == 0) return 0; 
        }

        return -1; 
    }
}
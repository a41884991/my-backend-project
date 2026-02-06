import express from 'express';
import { query, testConnection } from './db.js';
import { v7 as uuidv7 } from 'uuid'; // 引入 UUID v7
import redis from './cache.js';

const app = express();
const PORT = 3000;
// 讓 Express 能夠解析 JSON 格式的 Request Body (這行非常重要！)
app.use(express.json());

app.post('/api/users', async (req, res) => {
    const { username, email } = req.body;

    // 1. 生成時序遞增的 UUIDv7
    const newId = uuidv7();

    console.log(`📝 正在註冊新用戶: ${username}, ID: ${newId}`);

    try {
        // 2. 執行 SQL 寫入
        const sql = 'INSERT INTO users (id, username, email) VALUES ($1, $2, $3) RETURNING *';
        const result = await query(sql, [newId, username, email]);

        const cacheKey = `user:${newId}`;
        await redis.del(cacheKey);

        console.log(`🧹 已清理快取: ${cacheKey}`);

        // 3. 回傳成功狀態碼 201 (Created)
        res.status(201).json({
            message: '用戶建立成功！',
            user: result.rows[0]
        });
    } catch (err: any) {
        // 4. 錯誤處理：例如 Email 重複
        if (err.code === '23505') {
            return res.status(400).json({ error: '使用者名稱或 Email 已被使用' });
        }
        console.error('❌ 寫入失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body;
    const cacheKey = `user:${id}`;

    try {
        // 1. 先更新資料庫 (使用 COALESCE 確保沒傳的欄位保持原樣)
        const sql = `
            UPDATE users 
            SET username = COALESCE($1, username), 
                email = COALESCE($2, email) 
            WHERE id = $3 
            RETURNING *`;
        
        const result = await query(sql, [username, email, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '找不到該用戶' });
        }

        // 2. 關鍵步驟：主動刪除舊快取 (Invalidate Cache)
        // 為什麼是刪除而不是更新？因為刪除能確保下一次讀取絕對是從資料庫抓最新的！
        await redis.del(cacheKey);
        console.log(`🧹 資料已更新，已清理快取: ${cacheKey}`);

        res.json({
            message: '更新成功，快取已同步',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('❌ 更新失敗:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
    }
});

// 1. 新增一個最簡單的根路由測試
app.get('/', (req, res) => {
    console.log('🏠 根目錄被訪問了');
    res.send('Backend is running!');
});

app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `user:${id}`; // 定義快取的 Key

    try {
        // 1. 先去 Valkey 查詢
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            console.log('📦 Cache Hit! (從快取取得資料)');
            return res.json(JSON.parse(cachedData));
        }

        // 2. 如果快取沒有，去 PostgreSQL 查詢
        console.log('🔍 Cache Miss! (從資料庫查詢...)');
        const result = await query('SELECT id, username, email FROM users WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // 3. 把查詢結果存入 Valkey，並設定過期時間為 1 小時 (3600 秒)
        // 這樣可以確保資料不會永遠佔空間，也能在一段時間後自動更新
        await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);

        res.json(user);
    } catch (err) {
        console.error('❌ Server Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 伺服器啟動於 http://localhost:${PORT}`);
    try {
        await testConnection(); // 主動去敲門
        console.log('📡 網路與資料庫通道已全數就緒！');
    } catch (err) {
        console.error('❌ 啟動失敗：無法連線至資料庫', err);
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const cacheKey = `user:${id}`;

    try {
        await query('DELETE FROM users WHERE id = $1', [id]);
        await redis.del(cacheKey); // 刪除資料也要記得清快取
        res.status(204).send(); // 204 代表 No Content (成功但無回傳)
    } catch (err) {
        res.status(500).json({ error: '刪除失敗' });
    }
});

// 監聽 Ctrl+C (SIGINT)
process.on('SIGINT', () => {
    console.log('👋 收到關閉訊號，正在釋放資源...');
    // 這裡可以關閉資料庫連線
    // pool.end(); 
    process.exit(0);
});
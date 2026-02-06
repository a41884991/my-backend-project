import express from 'express';
import { query, testConnection } from './db.js';
import { v7 as uuidv7 } from 'uuid';
import redis from './cache.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs'; // 引入檔案系統模組

// 讀取獨立的 swagger.json 檔案
const swaggerDocument = JSON.parse(fs.readFileSync('./src/swagger.json', 'utf8'));

const app = express();
const PORT = 3000;

app.use(express.json());

// 直接載入 swaggerDocument，不再需要 swagger-jsdoc
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- 路由實作 ---

app.post('/api/posts', async (req, res) => {
  const { user_id, title, content } = req.body;
  const newPostId = uuidv7();
  try {
    const sql = 'INSERT INTO posts (id, user_id, title, content) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await query(sql, [newPostId, user_id, title, content]);
    res.status(201).json({ message: '文章發布成功！', post: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23503') return res.status(400).json({ error: '無效的使用者 ID' });
    res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, email } = req.body;
  const newId = uuidv7();
  try {
    await query('INSERT INTO users (id, username, email) VALUES ($1, $2, $3)', [newId, username, email]);
    await redis.del(`user:${newId}`);
    res.status(201).json({ message: '用戶建立成功！', id: newId });
  } catch (err: any) {
    res.status(500).json({ error: '寫入失敗' });
  }
});

/**
 * 使用 Hash 儲存使用者 Session 或狀態
 */
app.post('/api/debug/hash-user/:id', async (req, res) => {
  const { id } = req.params;
  const { status, lastLogin } = req.body;
  const key = `user:status:${id}`;

  try {
    // 使用 hset 儲存多個欄位
    await redis.hset(key, {
      status: status,
      lastLogin: lastLogin,
      updatedAt: new Date().toISOString()
    });

    // 設定過期時間 (Hash 也可以設定 TTL)
    await redis.expire(key, 3600);

    const fullData = await redis.hgetall(key);
    res.json({ message: 'Hash 儲存成功', data: fullData });
  } catch (err) {
    res.status(500).json({ error: 'Valkey 操作失敗' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `user:${id}`;
  try {
    const cached = await redis.hgetall(cacheKey);
    if (Object.keys(cached).length > 0) {
      // 如果快取裡標記著這是個不存在的 ID (我們自定義一個欄位 _is_null)
      if (cached._is_null === 'true') {
        console.log('🛡️ 快取穿透防禦：攔截不存在的 ID');
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(cached);
    }
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      console.log('⚠️ DB 沒資料，存入空快取以防穿透');
      await redis.hset(cacheKey, { _is_null: 'true' });
      await redis.expire(cacheKey, 300); // 只存 5 分鐘
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    const userToCache = {
      ...user,
      created_at: user.created_at ? user.created_at.toISOString() : ''
    };
    await redis.hset(cacheKey, userToCache);
    await redis.expire(cacheKey, 3600);

    res.json(user);
  } catch (err) {
    console.error('❌ 詳細錯誤資訊:', err);
    res.status(500).json({ error: 'Server error', details: err instanceof Error ? err.message : err });
  }
});

app.get('/api/users/:id/posts', async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT u.username, p.title, p.content, p.created_at
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      WHERE u.id = $1
    `;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: '找不到該使用者' });
    res.json({
      user: result.rows[0].username,
      posts: result.rows.filter(row => row.title !== null)
    });
  } catch (err) {
    res.status(500).json({ error: '查詢失敗' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email } = req.body;
  const cacheKey = `user:${id}`;
  try {
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
    // --- 策略變更：直接刪除快取 ---
    // 這樣可以保證下一次 GET 一定會去 DB 抓最新資料，避免併發造成的髒資料
    await redis.del(cacheKey);
    console.log(`🧹 Cache Aside: 已移除舊快取 ${cacheKey}`);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params; // 修正了原本 code 漏掉的解構
  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    await redis.del(`user:${id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server at http://localhost:${PORT}`);
  console.log(`📖 Swagger UI at http://localhost:${PORT}/api-docs`);
  await testConnection();
});
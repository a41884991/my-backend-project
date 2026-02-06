import { Router } from 'express';
import { query } from '../db.js';
import { v7 as uuidv7 } from 'uuid';
import redis from '../cache.js';
import { acquireLock, releaseLock } from '../services/lockService.js';

const router = Router();

router.post('/', async (req, res) => {
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

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `user:${id}`;
  try {
    const cached = await redis.hgetall(cacheKey);
    if (Object.keys(cached).length > 0) {
      if (cached._is_null === 'true') return res.status(404).json({ error: 'User not found' });
      return res.json(cached);
    }
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      await redis.hset(cacheKey, { _is_null: 'true' });
      await redis.expire(cacheKey, 300);
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    const userToCache = { ...user, created_at: user.created_at ? user.created_at.toISOString() : '' };
    await redis.hset(cacheKey, userToCache);
    await redis.expire(cacheKey, 3600);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email } = req.body;
  const cacheKey = `user:${id}`;
  try {
    const sql = `UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email) WHERE id = $3 RETURNING *`;
    const result = await query(sql, [username, email, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await redis.del(cacheKey);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// POST /api/users/:id/secure-update (W3D3 分散式鎖實戰)
router.post('/:id/secure-update', async (req, res) => {
  const { id } = req.params;
  const lockKey = `lock:user:${id}`;
  const hasLock = await acquireLock(lockKey, 5);

  if (!hasLock) return res.status(429).json({ error: '系統忙碌中，請稍後再試' });

  try {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 模擬耗時邏輯
    res.json({ message: '安全更新成功' });
  } finally {
    await releaseLock(lockKey);
  }
});

router.get('/:id/posts', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
  const { id } = req.params; // 修正了原本 code 漏掉的解構
  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    await redis.del(`user:${id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
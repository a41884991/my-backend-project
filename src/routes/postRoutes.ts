import { Router } from "express";
import { v7 as uuidv7 } from 'uuid';
import { query } from "../db.js";

const router = Router();

router.post('/api/posts', async (req, res) => {
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

export default router;
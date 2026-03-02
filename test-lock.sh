#!/bin/bash

# 請確保已啟動伺服器並替換下方的 UUID 為你資料庫中真實存在的 id
USER_ID="018d8000-0002-7000-8000-000000000002"
URL="http://localhost:3000/api/users/$USER_ID/secure-update"

echo "--- 開始測試：安全釋放鎖 ---"

# 請求 1：模擬正常執行
echo "發送請求 1 (持有鎖 5 秒)..."
curl -s -X POST $URL &

# 等待一下確保請求 1 拿到鎖
sleep 1

# 請求 2：模擬競爭失敗
echo "發送請求 2 (預期會因為鎖被佔用而失敗)..."
curl -s -X POST $URL | jq .

# 等待請求 1 完成
wait
echo "--- 測試結束 ---"
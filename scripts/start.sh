#!/bin/bash
# Script untuk menjalankan aplikasi (app.py + fragment_bot.py)

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Memulai Website Management API Server${NC}"
echo -e "${GREEN}========================================${NC}"

# Pindah ke direktori utama
cd "$(dirname "$0")/.."

# Cek apakah Python sudah terinstall
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 tidak ditemukan. Silakan install Python3 terlebih dahulu.${NC}"
    exit 1
fi

# Aktifkan virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment belum aktif. Mengaktifkan...${NC}"
    source myenv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null
fi

# ==================== JALANKAN APP.PY DI BACKGROUND ====================
echo -e "${GREEN}📡 Menjalankan Flask server di port 5050...${NC}"
python3 app.py &
APP_PID=$!
echo -e "${GREEN}✅ Flask server berjalan dengan PID: $APP_PID${NC}"

# Tunggu sebentar agar Flask server siap
sleep 3

# ==================== JALANKAN FRAGMENT_BOT.PY DI BACKGROUND ====================
echo -e "${GREEN}🤖 Menjalankan Fragment Bot (Telegram)...${NC}"
python3 fragment/fragment_bot.py &
BOT_PID=$!
echo -e "${GREEN}✅ Fragment Bot berjalan dengan PID: $BOT_PID${NC}"

# ==================== SAVE PIDS TO FILE ====================
echo "$APP_PID" > /tmp/flask_server.pid
echo "$BOT_PID" > /tmp/fragment_bot.pid

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Semua server berjalan!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "📊 Flask Server   : PID $APP_PID - Port 5050"
echo -e "🤖 Fragment Bot   : PID $BOT_PID"
echo -e ""
echo -e "${YELLOW}Gunakan './stop.sh' untuk menghentikan semua server${NC}"
echo -e "${YELLOW}Gunakan 'tail -f nohup.out' untuk melihat log${NC}"
echo -e "${GREEN}========================================${NC}"

# Tunggu proses (biarkan script berjalan)
wait
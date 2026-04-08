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

# ==================== CEK FOLDER GAMES ====================
if [ ! -d "games" ]; then
    echo -e "${YELLOW}⚠️  Folder games tidak ditemukan, membuat struktur folder...${NC}"
    mkdir -p games/css games/js
    echo -e "${GREEN}✅ Folder games created${NC}"
fi

if [ ! -f "games/app.py" ]; then
    echo -e "${RED}❌ File games/app.py tidak ditemukan!${NC}"
    echo -e "${YELLOW}Pastikan file games/app.py sudah dibuat.${NC}"
    exit 1
fi

if [ ! -f "games/html/base.html" ]; then
    echo -e "${RED}❌ File games/games.html tidak ditemukan!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Games module terdeteksi${NC}"

# Aktifkan virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment belum aktif. Mengaktifkan...${NC}"
    source myenv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Gagal mengaktifkan virtual environment${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Virtual environment aktif${NC}"
fi

# ==================== CEK IMPORT BLUEPRINT DI APP.PY ====================
if ! grep -q "from games.app import games_bp" app.py; then
    echo -e "${YELLOW}⚠️  Blueprint games belum terdaftar di app.py${NC}"
    echo -e "${YELLOW}Pastikan sudah menambahkan:${NC}"
    echo -e "  1. from games.app import games_bp"
    echo -e "  2. app.register_blueprint(games_bp)"
    echo -e "  3. Route /games dan static files"
fi

# ==================== JALANKAN APP.PY DI BACKGROUND ====================
echo -e "${GREEN}📡 Menjalankan Flask server di port 5050...${NC}"
python3 app.py &
APP_PID=$!
echo -e "${GREEN}✅ Flask server berjalan dengan PID: $APP_PID${NC}"

# Tunggu sebentar agar Flask server siap
sleep 3

# Cek apakah Flask server masih berjalan
if ! ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${RED}❌ Flask server gagal berjalan! Cek error di atas.${NC}"
    exit 1
fi

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
echo -e "🎮 Games Module   : Terintegrasi di Flask (blueprint)"
echo -e "🤖 Fragment Bot   : PID $BOT_PID"
echo -e ""
echo -e "${YELLOW}🌐 Akses Games: https://companel.shop/games${NC}"
echo -e ""
echo -e "${YELLOW}Gunakan './stop.sh' untuk menghentikan semua server${NC}"
echo -e "${YELLOW}Gunakan 'tail -f nohup.out' untuk melihat log${NC}"
echo -e "${GREEN}========================================${NC}"

# Tunggu proses (biarkan script berjalan)
wait
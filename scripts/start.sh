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

# Pindah ke direktori utama (satu level di atas scripts)
cd "$(dirname "$0")/.."

# Cek apakah Python sudah terinstall
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 tidak ditemukan. Silakan install Python3 terlebih dahulu.${NC}"
    exit 1
fi

# Cek apakah virtual environment aktif
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment belum aktif. Mengaktifkan...${NC}"
    source myenv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null
fi

# Fungsi untuk menunggu server siap
wait_for_server() {
    local port=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Menunggu server di port $port...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server Flask siap di port $port${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Server Flask gagal dimulai${NC}"
    return 1
}

# ==================== JALANKAN APP.PY (Flask) ====================
echo -e "${GREEN}📡 Menjalankan Flask server di port 5050...${NC}"
python3 app.py &
APP_PID=$!
echo -e "${GREEN}✅ Flask server berjalan dengan PID: $APP_PID${NC}"

# Tunggu Flask server siap
wait_for_server 5050

# ==================== JALANKAN FRAGMENT_BOT.PY (Telegram Bot) ====================
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

# Simpan output ke file log
echo "$(date): Flask server (PID $APP_PID) dan Fragment Bot (PID $BOT_PID) started" >> server.log
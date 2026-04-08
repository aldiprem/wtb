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

# ==================== FUNGSI MEMATIKAN PORT 5050 ====================
kill_port_5050() {
    echo -e "${YELLOW}🔍 Memeriksa port 5050...${NC}"
    
    # Cari proses yang menggunakan port 5050
    PIDS=$(lsof -ti :5050 2>/dev/null)
    
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}⚠️  Port 5050 sedang digunakan oleh PID: $PIDS${NC}"
        
        for PID in $PIDS; do
            # Cek apakah proses adalah Flask
            PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null)
            if [[ "$PROCESS_NAME" == *"python"* ]] || [[ "$PROCESS_NAME" == *"flask"* ]]; then
                echo -e "${YELLOW}📡 Menghentikan proses Flask (PID: $PID)...${NC}"
                kill -15 $PID 2>/dev/null
                sleep 2
                
                # Force kill jika masih berjalan
                if kill -0 $PID 2>/dev/null; then
                    echo -e "${RED}🔫 Force kill PID: $PID${NC}"
                    kill -9 $PID 2>/dev/null
                fi
                echo -e "${GREEN}✅ Proses PID $PID dihentikan${NC}"
            else
                echo -e "${YELLOW}⚠️  PID $PID bukan proses Flask ($PROCESS_NAME), tidak dihentikan${NC}"
            fi
        done
        
        # Tunggu sebentar dan cek lagi
        sleep 2
        if lsof -ti :5050 > /dev/null 2>&1; then
            echo -e "${RED}❌ Port 5050 masih digunakan! Memaksa kill semua...${NC}"
            lsof -ti :5050 | xargs kill -9 2>/dev/null
        fi
    else
        echo -e "${GREEN}✅ Port 5050 tersedia${NC}"
    fi
}

# ==================== FUNGSI MEMBERSIHKAN PID FILES ====================
clean_pid_files() {
    if [ -f "/tmp/flask_server.pid" ]; then
        OLD_PID=$(cat /tmp/flask_server.pid)
        if ! kill -0 $OLD_PID 2>/dev/null; then
            echo -e "${YELLOW}🗑️  Menghapus PID file stale: /tmp/flask_server.pid${NC}"
            rm -f /tmp/flask_server.pid
        fi
    fi
    
    if [ -f "/tmp/fragment_bot.pid" ]; then
        OLD_PID=$(cat /tmp/fragment_bot.pid)
        if ! kill -0 $OLD_PID 2>/dev/null; then
            echo -e "${YELLOW}🗑️  Menghapus PID file stale: /tmp/fragment_bot.pid${NC}"
            rm -f /tmp/fragment_bot.pid
        fi
    fi
}

# ==================== KILL PORT 5050 SEBELUM START ====================
kill_port_5050
clean_pid_files

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

if [ ! -f "games/games.html" ]; then
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
nohup python3 app.py > logs/flask.log 2>&1 &
APP_PID=$!
echo -e "${GREEN}✅ Flask server berjalan dengan PID: $APP_PID${NC}"

# Tunggu sebentar agar Flask server siap
sleep 3

# Cek apakah Flask server masih berjalan
if ! ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${RED}❌ Flask server gagal berjalan! Cek logs/flask.log${NC}"
    cat logs/flask.log 2>/dev/null | tail -20
    exit 1
fi

# Cek apakah port 5050 benar-benar terbuka
if lsof -ti :5050 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 5050 berhasil dibuka${NC}"
else
    echo -e "${RED}❌ Port 5050 tidak terbuka! Mungkin ada error.${NC}"
fi

# ==================== JALANKAN FRAGMENT_BOT.PY DI BACKGROUND ====================
echo -e "${GREEN}🤖 Menjalankan Fragment Bot (Telegram)...${NC}"
nohup python3 fragment/fragment_bot.py > logs/fragment_bot.log 2>&1 &
BOT_PID=$!
echo -e "${GREEN}✅ Fragment Bot berjalan dengan PID: $BOT_PID${NC}"

# ==================== SAVE PIDS TO FILE ====================
mkdir -p logs
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
echo -e "${YELLOW}Gunakan 'tail -f logs/flask.log' untuk melihat log Flask${NC}"
echo -e "${YELLOW}Gunakan 'tail -f logs/fragment_bot.log' untuk melihat log Bot${NC}"
echo -e "${GREEN}========================================${NC}"
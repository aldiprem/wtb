#!/bin/bash
# Script untuk menjalankan aplikasi (app.py + fragment_bot.py + giveaway/b.py)

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Memulai Website Management API Server${NC}"
echo -e "${GREEN}========================================${NC}"

# Pindah ke direktori utama (parent dari scripts)
cd "$(dirname "$0")/.."

# ==================== BUAT FOLDER LOGS ====================
mkdir -p logs

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
    
    if [ -f "/tmp/giveaway_bot.pid" ]; then
        OLD_PID=$(cat /tmp/giveaway_bot.pid)
        if ! kill -0 $OLD_PID 2>/dev/null; then
            echo -e "${YELLOW}🗑️  Menghapus PID file stale: /tmp/giveaway_bot.pid${NC}"
            rm -f /tmp/giveaway_bot.pid
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

# ==================== CEK FOLDER GIVEAWAY ====================
if [ ! -d "giveaway" ]; then
    echo -e "${YELLOW}⚠️  Folder giveaway tidak ditemukan, membuat struktur folder...${NC}"
    mkdir -p giveaway/database
    echo -e "${GREEN}✅ Folder giveaway created${NC}"
fi

if [ ! -f "giveaway/b.py" ]; then
    echo -e "${RED}❌ File giveaway/b.py tidak ditemukan!${NC}"
    echo -e "${YELLOW}Pastikan file giveaway/b.py sudah dibuat.${NC}"
else
    echo -e "${GREEN}✅ Giveaway module terdeteksi${NC}"
    
    if [ ! -f "giveaway/database/giveaway.py" ]; then
        echo -e "${RED}❌ File giveaway/database/giveaway.py tidak ditemukan!${NC}"
    fi
fi

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
sleep 5

# Cek apakah Flask server masih berjalan
if ! ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${RED}❌ Flask server gagal berjalan! Cek logs/flask.log${NC}"
    if [ -f logs/flask.log ]; then
        cat logs/flask.log
    else
        echo -e "${RED}Log file tidak ditemukan${NC}"
    fi
    exit 1
fi

# Cek apakah port 5050 benar-benar terbuka
sleep 2
if lsof -ti :5050 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 5050 berhasil dibuka${NC}"
else
    echo -e "${YELLOW}⚠️  Port 5050 belum terbuka, mungkin masih loading...${NC}"
fi

# ==================== JALANKAN FRAGMENT_BOT.PY DI BACKGROUND ====================
echo -e "${GREEN}🤖 Menjalankan Fragment Bot (Telegram)...${NC}"
if [ -f "fragment/fragment_bot.py" ]; then
    nohup python3 fragment/fragment_bot.py > logs/fragment_bot.log 2>&1 &
    BOT_PID=$!
    echo -e "${GREEN}✅ Fragment Bot berjalan dengan PID: $BOT_PID${NC}"
    echo "$BOT_PID" > /tmp/fragment_bot.pid
else
    echo -e "${YELLOW}⚠️  File fragment/fragment_bot.py tidak ditemukan, skip bot${NC}"
    BOT_PID="N/A"
fi

# ==================== JALANKAN GIVEAWAY BOT DI BACKGROUND ====================
echo -e "${BLUE}🎁 Menjalankan Giveaway Bot...${NC}"
if [ -f "giveaway/b.py" ] && [ -f "giveaway/database/giveaway.py" ]; then
    # Install required packages if not already installed
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
    # Buat folder database jika belum ada
    mkdir -p giveaway/database
    
    nohup python3 giveaway/b.py > logs/giveaway_bot.log 2>&1 &
    GIVEAWAY_PID=$!
    echo -e "${GREEN}✅ Giveaway Bot berjalan dengan PID: $GIVEAWAY_PID${NC}"
    echo "$GIVEAWAY_PID" > /tmp/giveaway_bot.pid
else
    echo -e "${YELLOW}⚠️  File giveaway/b.py atau giveaway/database/giveaway.py tidak ditemukan, skip giveaway bot${NC}"
    GIVEAWAY_PID="N/A"
fi

# ==================== SAVE PIDS TO FILE ====================
echo "$APP_PID" > /tmp/flask_server.pid

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Semua server berjalan!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "📊 Flask Server   : PID $APP_PID - Port 5050"
echo -e "🎮 Games Module   : Terintegrasi di Flask (blueprint)"
echo -e "🤖 Fragment Bot   : PID $BOT_PID"
echo -e "🎁 Giveaway Bot   : PID $GIVEAWAY_PID"
echo -e ""
echo -e "${YELLOW}🌐 Akses: https://companel.shop${NC}"
echo -e "${YELLOW}🌐 Akses Games: https://companel.shop/games${NC}"
echo -e "${BLUE}🎁 Giveaway Bot commands:${NC}"
echo -e "   /start - Start bot"
echo -e "   /newgiveaway - Create giveaway (admin)"
echo -e "   /join - Join active giveaway"
echo -e ""
echo -e "${YELLOW}📋 Log files:${NC}"
echo -e "   Flask log:     tail -f logs/flask.log"
echo -e "   Fragment log:  tail -f logs/fragment_bot.log"
echo -e "   Giveaway log:  tail -f logs/giveaway_bot.log"
echo -e ""
echo -e "${YELLOW}Gunakan './stop.sh' untuk menghentikan semua server${NC}"
echo -e "${GREEN}========================================${NC}"
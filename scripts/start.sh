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
    
    PIDS=$(lsof -ti :5050 2>/dev/null)
    
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}⚠️  Port 5050 sedang digunakan oleh PID: $PIDS${NC}"
        
        for PID in $PIDS; do
            PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null)
            if [[ "$PROCESS_NAME" == *"python"* ]] || [[ "$PROCESS_NAME" == *"flask"* ]]; then
                echo -e "${YELLOW}📡 Menghentikan proses Flask (PID: $PID)...${NC}"
                kill -15 $PID 2>/dev/null
                sleep 2
                
                if kill -0 $PID 2>/dev/null; then
                    echo -e "${RED}🔫 Force kill PID: $PID${NC}"
                    kill -9 $PID 2>/dev/null
                fi
                echo -e "${GREEN}✅ Proses PID $PID dihentikan${NC}"
            else
                echo -e "${YELLOW}⚠️  PID $PID bukan proses Flask ($PROCESS_NAME), tidak dihentikan${NC}"
            fi
        done
        
        sleep 2
        if lsof -ti :5050 > /dev/null 2>&1; then
            echo -e "${RED}❌ Port 5050 masih digunakan! Memaksa kill semua...${NC}"
            lsof -ti :5050 | xargs kill -9 2>/dev/null
        fi
    else
        echo -e "${GREEN}✅ Port 5050 tersedia${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN FRAGMENT BOT ====================
kill_fragment_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Fragment Bot...${NC}"
    
    # Cek dari PID file
    if [ -f "/tmp/fragment_bot.pid" ]; then
        PID=$(cat /tmp/fragment_bot.pid)
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}📡 Menghentikan Fragment Bot (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ Fragment Bot dihentikan${NC}"
        fi
        rm -f /tmp/fragment_bot.pid
    fi
    
    # Cek dari nama proses
    PIDS=$(ps aux | grep "fragment_bot.py" | grep -v grep | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan Fragment Bot process (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ Fragment Bot processes dihentikan${NC}"
    fi
    
    # Hentikan screen session jika ada
    if screen -list | grep -q "fragment_bot"; then
        screen -S fragment_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session fragment_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN GIVEAWAY BOT ====================
kill_giveaway_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Giveaway Bot...${NC}"
    
    # Cek dari PID file
    if [ -f "/tmp/giveaway_bot.pid" ]; then
        PID=$(cat /tmp/giveaway_bot.pid)
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}📡 Menghentikan Giveaway Bot (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ Giveaway Bot dihentikan${NC}"
        fi
        rm -f /tmp/giveaway_bot.pid
    fi
    
    # Cek dari nama proses
    PIDS=$(ps aux | grep "giveaway/b.py" | grep -v grep | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan Giveaway Bot process (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ Giveaway Bot processes dihentikan${NC}"
    fi
    
    # Cek dari session Telethon
    PIDS=$(lsof 2>/dev/null | grep "giveaway_bot_session" | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan session Telethon (PID: $PID)...${NC}"
            kill -9 $PID 2>/dev/null
        done
    fi
    
    # Hapus file session Telethon
    rm -f giveaway/giveaway_bot_session.session 2>/dev/null
    rm -f giveaway/*.session 2>/dev/null
    
    # Hentikan screen session jika ada
    if screen -list | grep -q "giveaway_bot"; then
        screen -S giveaway_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session giveaway_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMBERSIHKAN PID FILES ====================
clean_pid_files() {
    for pid_file in flask_server.pid fragment_bot.pid giveaway_bot.pid; do
        if [ -f "/tmp/$pid_file" ]; then
            OLD_PID=$(cat "/tmp/$pid_file")
            if ! kill -0 $OLD_PID 2>/dev/null; then
                echo -e "${YELLOW}🗑️  Menghapus PID file stale: /tmp/$pid_file${NC}"
                rm -f "/tmp/$pid_file"
            fi
        fi
    done
}

# ==================== KILL SEMUA PROSES SEBELUM START ====================
echo -e "${YELLOW}🛑 Membersihkan proses yang sudah berjalan...${NC}"
kill_port_5050
kill_fragment_bot
kill_giveaway_bot
clean_pid_files

# Tunggu sebentar agar proses benar-benar mati
sleep 2

# Cek Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 tidak ditemukan. Silakan install Python3 terlebih dahulu.${NC}"
    exit 1
fi

# ==================== CEK FOLDER GAMES ====================
if [ ! -d "games" ]; then
    echo -e "${YELLOW}⚠️  Folder games tidak ditemukan, membuat struktur folder...${NC}"
    mkdir -p games/css games/js
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
fi

if [ ! -f "giveaway/b.py" ]; then
    echo -e "${RED}❌ File giveaway/b.py tidak ditemukan!${NC}"
    GIVEAWAY_EXISTS=false
else
    echo -e "${GREEN}✅ Giveaway module terdeteksi${NC}"
    GIVEAWAY_EXISTS=true
    
    if [ ! -f "giveaway/database/giveaway.py" ]; then
        echo -e "${RED}❌ File giveaway/database/giveaway.py tidak ditemukan!${NC}"
        GIVEAWAY_EXISTS=false
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

# ==================== JALANKAN APP.PY DI BACKGROUND ====================
echo -e "${GREEN}📡 Menjalankan Flask server di port 5050...${NC}"
nohup python3 app.py > logs/flask.log 2>&1 &
APP_PID=$!
echo -e "${GREEN}✅ Flask server berjalan dengan PID: $APP_PID${NC}"
echo "$APP_PID" > /tmp/flask_server.pid

sleep 5

if ! ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${RED}❌ Flask server gagal berjalan! Cek logs/flask.log${NC}"
    exit 1
fi

sleep 2
if lsof -ti :5050 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 5050 berhasil dibuka${NC}"
else
    echo -e "${YELLOW}⚠️  Port 5050 belum terbuka, mungkin masih loading...${NC}"
fi

# ==================== JALANKAN FRAGMENT_BOT.PY DI BACKGROUND ====================
echo -e "${GREEN}🤖 Menjalankan Fragment Bot (Telegram)...${NC}"
if [ -f "fragment/fragment_bot.py" ]; then
    # Install dependencies jika perlu
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
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
if [ "$GIVEAWAY_EXISTS" = true ]; then
    # Install dependencies
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
    # Buat folder database jika belum ada
    mkdir -p giveaway/database
    
    # Hapus session lama jika ada
    rm -f giveaway/*.session
    
    # Jalankan bot dari direktori yang benar
    cd giveaway
    nohup python3 b.py > ../logs/giveaway_bot.log 2>&1 &
    GIVEAWAY_PID=$!
    echo $GIVEAWAY_PID > ../tmp/giveaway_bot.pid
    cd ..
    echo -e "${GREEN}✅ Giveaway Bot berjalan dengan PID: $GIVEAWAY_PID${NC}"
    echo "$GIVEAWAY_PID" > /tmp/giveaway_bot.pid
else
    echo -e "${YELLOW}⚠️  Giveaway Bot tidak bisa dijalankan - module tidak lengkap${NC}"
    GIVEAWAY_PID="N/A"
fi

# ==================== OUTPUT STATUS ====================
echo ""
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
echo -e "   /newgiveaway - Create giveaway"
echo -e "   /join - Join active giveaway"
echo -e ""
echo -e "${YELLOW}📋 Log files:${NC}"
echo -e "   Flask log:     tail -f logs/flask.log"
echo -e "   Fragment log:  tail -f logs/fragment_bot.log"
echo -e "   Giveaway log:  tail -f logs/giveaway_bot.log"
echo -e ""
echo -e "${YELLOW}Gunakan './stop.sh' untuk menghentikan semua server${NC}"
echo -e "${GREEN}========================================${NC}"
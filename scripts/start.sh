#!/bin/bash
# Script untuk menjalankan aplikasi (app.py + fragment_bot.py + giveaway/b.py + winedash/b.py + scamaction/b.py)

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
    
    if screen -list | grep -q "fragment_bot"; then
        screen -S fragment_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session fragment_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN GIVEAWAY BOT ====================
kill_giveaway_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Giveaway Bot...${NC}"
    
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
    
    PIDS=$(lsof 2>/dev/null | grep "giveaway_bot_session" | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan session Telethon (PID: $PID)...${NC}"
            kill -9 $PID 2>/dev/null
        done
    fi
    
    rm -f giveaway/giveaway_bot_session.session 2>/dev/null
    
    if screen -list | grep -q "giveaway_bot"; then
        screen -S giveaway_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session giveaway_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN WINEDASH BOT ====================
kill_winedash_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Winedash Bot...${NC}"
    
    if [ -f "/tmp/winedash_bot.pid" ]; then
        PID=$(cat /tmp/winedash_bot.pid)
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}📡 Menghentikan Winedash Bot (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ Winedash Bot dihentikan${NC}"
        fi
        rm -f /tmp/winedash_bot.pid
    fi
    
    PIDS=$(ps aux | grep "winedash/b.py" | grep -v grep | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan Winedash Bot process (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ Winedash Bot processes dihentikan${NC}"
    fi
    
    PIDS=$(lsof 2>/dev/null | grep "winedash_bot_session" | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan session Telethon (PID: $PID)...${NC}"
            kill -9 $PID 2>/dev/null
        done
    fi
    
    rm -f winedash/winedash_bot_session.session 2>/dev/null
    
    if screen -list | grep -q "winedash_bot"; then
        screen -S winedash_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session winedash_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN JASEB BOT ====================
kill_jaseb_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Jaseb Bot...${NC}"
    
    if [ -f "/tmp/jaseb_bot.pid" ]; then
        PID=$(cat /tmp/jaseb_bot.pid)
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}📡 Menghentikan Jaseb Bot (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ Jaseb Bot dihentikan${NC}"
        fi
        rm -f /tmp/jaseb_bot.pid
    fi
    
    PIDS=$(ps aux | grep "/root/jaseb/b.py" | grep -v grep | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan Jaseb Bot process (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ Jaseb Bot processes dihentikan${NC}"
    fi
    
    if screen -list | grep -q "jaseb_bot"; then
        screen -S jaseb_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session jaseb_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN SCAMACTION BOT ====================
kill_scamaction_bot() {
    echo -e "${YELLOW}🔍 Memeriksa ScamAction Bot...${NC}"
    
    if [ -f "/tmp/scamaction_bot.pid" ]; then
        PID=$(cat /tmp/scamaction_bot.pid)
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}📡 Menghentikan ScamAction Bot (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ ScamAction Bot dihentikan${NC}"
        fi
        rm -f /tmp/scamaction_bot.pid
    fi
    
    PIDS=$(ps aux | grep "scamaction/b.py" | grep -v grep | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan ScamAction Bot process (PID: $PID)...${NC}"
            kill -15 $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ ScamAction Bot processes dihentikan${NC}"
    fi
    
    PIDS=$(lsof 2>/dev/null | grep "scamaction_bot_session" | awk '{print $2}')
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${YELLOW}📡 Menghentikan session Telethon (PID: $PID)...${NC}"
            kill -9 $PID 2>/dev/null
        done
    fi
    
    rm -f scamaction/scamaction_bot_session.session 2>/dev/null
    
    if screen -list | grep -q "scamaction_bot"; then
        screen -S scamaction_bot -X quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session scamaction_bot dihentikan${NC}"
    fi
}

# ==================== FUNGSI MEMBERSIHKAN PID FILES ====================
clean_pid_files() {
    for pid_file in flask_server.pid fragment_bot.pid giveaway_bot.pid winedash_bot.pid jaseb_bot.pid scamaction_bot.pid; do
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
kill_winedash_bot
kill_jaseb_bot
kill_scamaction_bot
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

# ==================== CEK FOLDER WINEDASH ====================
if [ ! -d "winedash" ]; then
    echo -e "${YELLOW}⚠️  Folder winedash tidak ditemukan, membuat struktur folder...${NC}"
    mkdir -p winedash/database winedash/html winedash/css winedash/js
fi

if [ ! -f "winedash/b.py" ]; then
    echo -e "${RED}❌ File winedash/b.py tidak ditemukan!${NC}"
    WINEDASH_EXISTS=false
else
    echo -e "${GREEN}✅ Winedash module terdeteksi${NC}"
    WINEDASH_EXISTS=true
fi

# ==================== CEK FOLDER SCAMACTION ====================
if [ ! -d "scamaction" ]; then
    echo -e "${YELLOW}⚠️  Folder scamaction tidak ditemukan, membuat struktur folder...${NC}"
    mkdir -p scamaction/database scamaction/html scamaction/css scamaction/js scamaction/services
    mkdir -p scamaction/logs
fi

if [ ! -f "scamaction/b.py" ]; then
    echo -e "${RED}❌ File scamaction/b.py tidak ditemukan!${NC}"
    SCAMACTION_EXISTS=false
else
    echo -e "${GREEN}✅ ScamAction module terdeteksi${NC}"
    SCAMACTION_EXISTS=true
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
    echo -e "${YELLOW}--- Last 20 lines of flask.log ---${NC}"
    tail -20 logs/flask.log
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
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
    mkdir -p giveaway/database
    
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

# ==================== JALANKAN WINEDASH BOT DI BACKGROUND ====================
echo -e "${BLUE}💎 Menjalankan Winedash Bot...${NC}"
if [ "$WINEDASH_EXISTS" = true ]; then
    pip3 install telethon python-dotenv aiohttp > /dev/null 2>&1
    
    mkdir -p winedash/database
    
    rm -f winedash/*.session 2>/dev/null
    
    cd winedash
    nohup python3 b.py > ../logs/winedash_bot.log 2>&1 &
    WINEDASH_PID=$!
    echo $WINEDASH_PID > ../tmp/winedash_bot.pid
    cd ..
    echo -e "${GREEN}✅ Winedash Bot berjalan dengan PID: $WINEDASH_PID${NC}"
    echo "$WINEDASH_PID" > /tmp/winedash_bot.pid
else
    echo -e "${YELLOW}⚠️  Winedash Bot tidak bisa dijalankan - file winedash/b.py tidak ditemukan${NC}"
    WINEDASH_PID="N/A"
fi

# ==================== JALANKAN JASEB BOT ====================
echo -e "${BLUE}🤖 Menjalankan Jaseb Bot...${NC}"
if [ -f "/root/jaseb/b.py" ]; then
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
    cd /root/jaseb
    nohup python3 b.py > /root/wtb/logs/jaseb_bot.log 2>&1 &
    JASEB_PID=$!
    echo $JASEB_PID > /tmp/jaseb_bot.pid
    cd /root/wtb
    echo -e "${GREEN}✅ Jaseb Bot berjalan dengan PID: $JASEB_PID${NC}"
else
    echo -e "${YELLOW}⚠️  Jaseb Bot tidak ditemukan di /root/jaseb/b.py${NC}"
    JASEB_PID="N/A"
fi

# ==================== JALANKAN SCAMACTION BOT ====================
echo -e "${BLUE}🛡️ Menjalankan ScamAction Bot...${NC}"
if [ "$SCAMACTION_EXISTS" = true ]; then
    pip3 install telethon python-dotenv > /dev/null 2>&1
    
    mkdir -p scamaction/database scamaction/logs
    
    # HAPUS atau KOMENTARI baris ini:
    # rm -f scamaction/*.session 2>/dev/null
    
    cd scamaction
    nohup python3 b.py > logs/scamaction_bot.log 2>&1 &
    SCAMACTION_PID=$!
    echo $SCAMACTION_PID > ../tmp/scamaction_bot.pid
    cd ..
    echo -e "${GREEN}✅ ScamAction Bot berjalan dengan PID: $SCAMACTION_PID${NC}"
    echo "$SCAMACTION_PID" > /tmp/scamaction_bot.pid
else
    echo -e "${YELLOW}⚠️  ScamAction Bot tidak bisa dijalankan - file scamaction/b.py tidak ditemukan${NC}"
    SCAMACTION_PID="N/A"
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
echo -e "💎 Winedash Bot   : PID $WINEDASH_PID"
echo -e "🤖 Jaseb Bot      : PID $JASEB_PID"
echo -e "🛡️ ScamAction Bot : PID $SCAMACTION_PID"
echo -e ""
echo -e "${YELLOW}🌐 Akses: https://companel.shop${NC}"
echo -e "${YELLOW}🌐 Akses Games: https://companel.shop/games${NC}"
echo -e "${YELLOW}🌐 Akses Winedash: https://companel.shop/winedash${NC}"
echo -e "${YELLOW}🌐 Akses ScamAction Panel: https://companel.shop/scamaction/panel${NC}"
echo -e "${BLUE}🎁 Giveaway Bot commands:${NC}"
echo -e "   /start - Start bot"
echo -e "   /newgiveaway - Create giveaway"
echo -e "   /join - Join active giveaway"
echo -e ""
echo -e "${BLUE}🛡️ ScamAction Bot commands:${NC}"
echo -e "   /start - Start bot"
echo -e "   +ch <id> - Add scan channel"
echo -e "   -ch <id> - Remove scan channel"
echo -e "   %ch - List scan channels"
echo -e "   #ch - Reset scan channels"
echo -e "   /scan - Scan channels for scammer IDs"
echo -e ""
echo -e "${YELLOW}📋 Log files:${NC}"
echo -e "   Flask log:      tail -f logs/flask.log"
echo -e "   Fragment log:   tail -f logs/fragment_bot.log"
echo -e "   Giveaway log:   tail -f logs/giveaway_bot.log"
echo -e "   Winedash log:   tail -f logs/winedash_bot.log"
echo -e "   Jaseb log:      tail -f logs/jaseb_bot.log"
echo -e "   ScamAction log: tail -f scamaction/logs/scamaction_bot.log"
echo -e ""
echo -e "${YELLOW}Gunakan './stop.sh' untuk menghentikan semua server${NC}"
echo -e "${GREEN}========================================${NC}"
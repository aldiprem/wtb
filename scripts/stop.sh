#!/bin/bash
# Script untuk menghentikan aplikasi (app.py + fragment_bot.py + giveaway/b.py + indotag/b.py)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}🛑 Menghentikan Server, Fragment Bot, Giveaway Bot & INDOTAG Bot${NC}"
echo -e "${YELLOW}========================================${NC}"

cd "$(dirname "$0")/.."
mkdir -p logs

# ==================== FUNGSI MEMATIKAN PORT 5050 ====================
kill_port_5050() {
    echo -e "${YELLOW}🔍 Memeriksa port 5050...${NC}"
    PIDS=$(lsof -ti :5050 2>/dev/null)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            kill -9 $PID 2>/dev/null
        done
        echo -e "${GREEN}✅ Port 5050 dibersihkan${NC}"
    else
        echo -e "${GREEN}✅ Port 5050 sudah kosong${NC}"
    fi
}

# ==================== FUNGSI MEMATIKAN FRAGMENT BOT ====================
kill_fragment_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Fragment Bot...${NC}"
    
    # Kill berdasarkan PID file
    if [ -f "/tmp/fragment_bot.pid" ]; then
        PID=$(cat /tmp/fragment_bot.pid)
        kill -9 $PID 2>/dev/null
        rm -f /tmp/fragment_bot.pid
    fi
    
    # Kill berdasarkan nama proses
    pkill -9 -f "fragment_bot.py" 2>/dev/null
    
    # Kill screen session
    screen -S fragment_bot -X quit 2>/dev/null
    
    echo -e "${GREEN}✅ Fragment Bot dihentikan${NC}"
}

# ==================== FUNGSI MEMATIKAN GIVEAWAY BOT ====================
kill_giveaway_bot() {
    echo -e "${YELLOW}🔍 Memeriksa Giveaway Bot...${NC}"
    
    # Kill berdasarkan PID file
    if [ -f "/tmp/giveaway_bot.pid" ]; then
        PID=$(cat /tmp/giveaway_bot.pid)
        kill -9 $PID 2>/dev/null
        rm -f /tmp/giveaway_bot.pid
    fi
    
    # Kill berdasarkan nama proses
    pkill -9 -f "giveaway/b.py" 2>/dev/null
    pkill -9 -f "giveaway_bot_session" 2>/dev/null
    
    # Hapus session Telethon
    rm -f giveaway/*.session 2>/dev/null
    
    # Kill screen session
    screen -S giveaway_bot -X quit 2>/dev/null
    
    echo -e "${GREEN}✅ Giveaway Bot dihentikan${NC}"
}

# ==================== FUNGSI MEMATIKAN INDOTAG BOT ====================
kill_indotag_bot() {
    echo -e "${YELLOW}🔍 Memeriksa INDOTAG Bot...${NC}"
    
    # Kill berdasarkan PID file
    if [ -f "/tmp/indotag_bot.pid" ]; then
        PID=$(cat /tmp/indotag_bot.pid)
        kill -9 $PID 2>/dev/null
        rm -f /tmp/indotag_bot.pid
    fi
    
    # Kill berdasarkan nama proses
    pkill -9 -f "indotag/b.py" 2>/dev/null
    pkill -9 -f "indotag_bot_session" 2>/dev/null
    
    # Hapus session Telethon
    rm -f indotag/*.session 2>/dev/null
    
    # Kill screen session
    screen -S indotag_bot -X quit 2>/dev/null
    
    echo -e "${GREEN}✅ INDOTAG Bot dihentikan${NC}"
}

# ==================== EKSEKUSI ====================
kill_port_5050
kill_fragment_bot
kill_giveaway_bot
kill_indotag_bot

# Bersihkan semua PID files
rm -f /tmp/flask_server.pid /tmp/fragment_bot.pid /tmp/giveaway_bot.pid /tmp/indotag_bot.pid 2>/dev/null

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Semua server berhasil dihentikan${NC}"
echo -e "${GREEN}========================================${NC}"
echo "$(date): All servers stopped" >> logs/server.log
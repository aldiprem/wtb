#!/bin/bash
# Script untuk menghentikan aplikasi (app.py + fragment_bot.py)

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}🛑 Menghentikan Server & Fragment Bot${NC}"
echo -e "${YELLOW}========================================${NC}"

# Fungsi untuk menghentikan proses berdasarkan PID file
stop_process_from_file() {
    local pid_file=$1
    local process_name=$2
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}📡 Menghentikan $process_name (PID: $PID)${NC}"
            kill -15 $PID 2>/dev/null
            sleep 2
            
            if ps -p $PID > /dev/null 2>&1; then
                echo -e "${YELLOW}⚠️  $process_name tidak berhenti, memaksa penghentian...${NC}"
                kill -9 $PID 2>/dev/null
            fi
            echo -e "${GREEN}✅ $process_name dihentikan${NC}"
        else
            echo -e "${YELLOW}⚠️  $process_name (PID: $PID) tidak berjalan${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  File PID untuk $process_name tidak ditemukan${NC}"
    fi
}

# Fungsi untuk menghentikan proses berdasarkan nama
stop_process_by_name() {
    local process_name=$1
    local match_pattern=$2
    
    PIDS=$(ps aux | grep "$match_pattern" | grep -v grep | awk '{print $2}')
    
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            echo -e "${GREEN}📡 Menghentikan $process_name (PID: $PID)${NC}"
            kill -15 $PID 2>/dev/null
        done
        sleep 2
        
        # Force kill jika masih berjalan
        PIDS=$(ps aux | grep "$match_pattern" | grep -v grep | awk '{print $2}')
        if [ -n "$PIDS" ]; then
            for PID in $PIDS; do
                echo -e "${YELLOW}⚠️  Memaksa menghentikan $process_name (PID: $PID)${NC}"
                kill -9 $PID 2>/dev/null
            done
        fi
        echo -e "${GREEN}✅ $process_name dihentikan${NC}"
    else
        echo -e "${YELLOW}⚠️  Tidak ada proses $process_name yang berjalan${NC}"
    fi
}

# Hentikan Flask server dari PID file
stop_process_from_file "/tmp/flask_server.pid" "Flask Server"

# Hentikan Fragment Bot dari PID file
stop_process_from_file "/tmp/fragment_bot.pid" "Fragment Bot"

# Fallback: cari berdasarkan nama proses
stop_process_by_name "Flask Server" "python3 app.py"
stop_process_by_name "Fragment Bot" "fragment_bot.py"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Semua server berhasil dihentikan${NC}"
echo -e "${GREEN}========================================${NC}"

# Catat ke log
echo "$(date): All servers stopped" >> server.log
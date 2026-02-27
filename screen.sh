#!/bin/bash
# Script untuk mengelola screen session

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SESSION_NAME="website_api"

show_help() {
    echo -e "${GREEN}Penggunaan: ./screen.sh [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  start    - Memulai session baru"
    echo "  stop     - Menghentikan session"
    echo "  restart  - Merestart session"
    echo "  attach   - Melampirkan ke session (screen -r)"
    echo "  list     - Menampilkan daftar session"
    echo "  logs     - Melihat logs (jika menggunakan file log)"
    echo ""
}

case "$1" in
    start)
        echo -e "${GREEN}📡 Memulai screen session: $SESSION_NAME${NC}"
        cd "$(dirname "$0")/.."
        screen -dmS $SESSION_NAME bash -c "python3 app.py; exec bash"
        sleep 1
        screen -ls | grep $SESSION_NAME
        echo -e "${GREEN}✅ Session $SESSION_NAME dimulai${NC}"
        echo -e "${YELLOW}Gunakan './screen.sh attach' untuk melihat output${NC}"
        ;;
    stop)
        echo -e "${YELLOW}🛑 Menghentikan screen session: $SESSION_NAME${NC}"
        screen -S $SESSION_NAME -X quit
        sleep 1
        if ! screen -ls | grep -q $SESSION_NAME; then
            echo -e "${GREEN}✅ Session $SESSION_NAME dihentikan${NC}"
        else
            echo -e "${RED}❌ Gagal menghentikan session${NC}"
        fi
        ;;
    restart)
        echo -e "${YELLOW}🔄 Merestart screen session: $SESSION_NAME${NC}"
        $0 stop
        sleep 2
        $0 start
        ;;
    attach)
        echo -e "${GREEN}📱 Melampirkan ke session: $SESSION_NAME${NC}"
        echo -e "${YELLOW}Tekan Ctrl+A kemudian D untuk keluar dari screen${NC}"
        sleep 2
        screen -r $SESSION_NAME
        ;;
    list)
        echo -e "${GREEN}📋 Daftar screen session:${NC}"
        screen -ls
        ;;
    logs)
        echo -e "${GREEN}📜 Melihat logs (jika ada)...${NC}"
        if [ -f "../nohup.out" ]; then
            tail -f ../nohup.out
        else
            echo -e "${YELLOW}⚠️  File log tidak ditemukan${NC}"
        fi
        ;;
    *)
        show_help
        ;;
esac
#!/bin/bash
# Script untuk mengelola screen session untuk kedua server

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FLASK_SESSION="flask_server"
BOT_SESSION="fragment_bot"

show_help() {
    echo -e "${GREEN}Penggunaan: ./screen.sh [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  start    - Memulai kedua session"
    echo "  stop     - Menghentikan kedua session"
    echo "  restart  - Merestart kedua session"
    echo "  attach   - Melampirkan ke session (pilih)"
    echo "  list     - Menampilkan daftar session"
    echo "  logs     - Melihat logs"
    echo "  status   - Cek status semua service"
    echo ""
}

check_games_module() {
    if [ -f "games/app.py" ] && [ -f "games/games.html" ]; then
        echo -e "${GREEN}✅ Games module detected${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Games module not found or incomplete${NC}"
        return 1
    fi
}

start_sessions() {
    echo -e "${GREEN}📡 Memulai screen sessions...${NC}"
    cd "$(dirname "$0")/.."
    
    # Cek games module
    check_games_module
    
    # Start Flask server (sudah include games blueprint)
    screen -dmS $FLASK_SESSION bash -c "source myenv/bin/activate && python3 app.py; exec bash"
    echo -e "${GREEN}✅ Flask server session: $FLASK_SESSION (includes /games route)${NC}"
    
    sleep 2
    
    # Start Fragment Bot
    screen -dmS $BOT_SESSION bash -c "source myenv/bin/activate && python3 fragment/fragment_bot.py; exec bash"
    echo -e "${GREEN}✅ Fragment Bot session: $BOT_SESSION${NC}"
    
    echo -e "${GREEN}✅ Semua session dimulai${NC}"
    echo -e "${YELLOW}🌐 Akses Games: https://companel.shop/games${NC}"
    echo -e "${YELLOW}Gunakan './screen.sh attach' untuk melihat output${NC}"
}

stop_sessions() {
    echo -e "${YELLOW}🛑 Menghentikan screen sessions...${NC}"
    screen -S $FLASK_SESSION -X quit 2>/dev/null
    screen -S $BOT_SESSION -X quit 2>/dev/null
    echo -e "${GREEN}✅ Semua session dihentikan${NC}"
}

restart_sessions() {
    echo -e "${YELLOW}🔄 Merestart semua session...${NC}"
    stop_sessions
    sleep 2
    start_sessions
}

attach_session() {
    echo -e "${GREEN}Pilih session:${NC}"
    echo "1) Flask Server ($FLASK_SESSION) - Includes /games"
    echo "2) Fragment Bot ($BOT_SESSION)"
    echo "3) Batal"
    read -p "Pilih [1-3]: " choice
    
    case $choice in
        1) screen -r $FLASK_SESSION ;;
        2) screen -r $BOT_SESSION ;;
        *) echo "Batal" ;;
    esac
}

list_sessions() {
    echo -e "${GREEN}📋 Daftar screen session:${NC}"
    screen -ls
}

view_logs() {
    echo -e "${GREEN}Pilih log:${NC}"
    echo "1) Flask Server Logs (includes games)"
    echo "2) Fragment Bot Logs"
    read -p "Pilih [1-2]: " choice
    
    case $choice in
        1) 
            if [ -f "/root/wtb/logs/flask.log" ]; then
                tail -f /root/wtb/logs/flask.log
            else
                echo -e "${RED}Log file not found, showing screen output...${NC}"
                screen -r $FLASK_SESSION
            fi
            ;;
        2)
            if [ -f "/root/wtb/logs/fragment_bot.log" ]; then
                tail -f /root/wtb/logs/fragment_bot.log
            else
                echo -e "${RED}Log file not found, showing screen output...${NC}"
                screen -r $BOT_SESSION
            fi
            ;;
        *) echo "Batal" ;;
    esac
}

show_status() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}📊 STATUS SERVICE${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Cek Flask server
    if screen -list | grep -q "$FLASK_SESSION"; then
        echo -e "${GREEN}✅ Flask Server: RUNNING (Port 5050)${NC}"
        echo -e "   🎮 Games route: https://companel.shop/games"
    else
        echo -e "${RED}❌ Flask Server: STOPPED${NC}"
    fi
    
    # Cek Fragment Bot
    if screen -list | grep -q "$BOT_SESSION"; then
        echo -e "${GREEN}✅ Fragment Bot: RUNNING${NC}"
    else
        echo -e "${RED}❌ Fragment Bot: STOPPED${NC}"
    fi
    
    # Cek games module
    cd "$(dirname "$0")/.."
    if [ -f "games/app.py" ]; then
        echo -e "${GREEN}✅ Games Module: INSTALLED${NC}"
    else
        echo -e "${RED}❌ Games Module: MISSING${NC}"
    fi
    
    echo -e "${GREEN}========================================${NC}"
}

case "$1" in
    start) start_sessions ;;
    stop) stop_sessions ;;
    restart) restart_sessions ;;
    attach) attach_session ;;
    list) list_sessions ;;
    logs) view_logs ;;
    status) show_status ;;
    *) show_help ;;
esac
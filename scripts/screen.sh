#!/bin/bash
# Script untuk mengelola screen session dengan opsi fleksibel

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

declare -A SESSIONS
SESSIONS[1]="flask_server:Flask Server (Port 5050):cd /root/wtb && source myenv/bin/activate && python3 app.py"
SESSIONS[2]="fragment_bot:Fragment Bot:cd /root/wtb && source myenv/bin/activate && python3 fragment/fragment_bot.py"
SESSIONS[3]="giveaway_bot:Giveaway Bot:cd /root/wtb/giveaway && source ../myenv/bin/activate && python3 b.py"
SESSIONS[4]="games_module:Games Module (via Flask):cd /root/wtb && source myenv/bin/activate && python3 app.py"
SESSIONS[5]="indotag_bot:INDOTAG Bot:cd /root/wtb/indotag && source ../myenv/bin/activate && python3 b.py"

show_help() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎮 SCREEN SESSION MANAGER${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}Penggunaan: ./screen.sh [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  start     - Memulai session (dengan opsi)"
    echo "  stop      - Menghentikan session (dengan opsi)"
    echo "  restart   - Merestart session (dengan opsi)"
    echo "  attach    - Melampirkan ke session (pilih)"
    echo "  list      - Menampilkan daftar session aktif"
    echo "  status    - Cek status semua service"
    echo "  logs      - Melihat logs"
    echo "  all       - Menjalankan semua session"
    echo "  stopall   - Menghentikan semua session"
    echo ""
    echo -e "${CYAN}Contoh multi pilih:${NC}"
    echo "  Masukkan angka: 1,2,3 atau 1-3 atau 1,2-4"
    echo "  Contoh: '1,3' atau '1-3' atau '2,4'"
    echo ""
}

show_menu() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}📋 DAFTAR SESSION${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "  ${CYAN}1.${NC} Flask Server (Port 5050)"
    echo -e "  ${CYAN}2.${NC} Fragment Bot"
    echo -e "  ${CYAN}3.${NC} Giveaway Bot"
    echo -e "  ${CYAN}4.${NC} Games Module (via Flask)"
    echo -e "  ${CYAN}0.${NC} SEMUA SESSION"
    echo -e "${GREEN}========================================${NC}"
}

parse_selection() {
    local input="$1"
    local selected=()
    
    if [[ "$input" == "0" ]] || [[ "$input" == "all" ]]; then
        echo "1 2 3 4"
        return
    fi
    
    IFS=',' read -ra parts <<< "$input"
    for part in "${parts[@]}"; do
        if [[ "$part" == *"-"* ]]; then
            start=$(echo "$part" | cut -d'-' -f1)
            end=$(echo "$part" | cut -d'-' -f2)
            for i in $(seq $start $end); do
                selected+=($i)
            done
        else
            selected+=($part)
        fi
    done
    
    echo "${selected[@]}"
}

start_session() {
    local num=$1
    local name=$(echo "${SESSIONS[$num]}" | cut -d':' -f1)
    local desc=$(echo "${SESSIONS[$num]}" | cut -d':' -f2)
    local cmd=$(echo "${SESSIONS[$num]}" | cut -d':' -f3-)
    
    # Cek apakah session sudah berjalan
    if screen -list | grep -q "$name"; then
        echo -e "${YELLOW}⚠️  Session $name sudah berjalan${NC}"
        return 1
    fi
    
    echo -e "${GREEN}🚀 Menjalankan $desc...${NC}"
    
    # Buat command dengan handling yang baik
    screen -dmS "$name" bash -c "$cmd; echo 'Session $name exited'; exec bash"
    
    sleep 2
    if screen -list | grep -q "$name"; then
        echo -e "${GREEN}✅ $desc berjalan (session: $name)${NC}"
        return 0
    else
        echo -e "${RED}❌ Gagal menjalankan $desc${NC}"
        return 1
    fi
}

stop_session() {
    local num=$1
    local name=$(echo "${SESSIONS[$num]}" | cut -d':' -f1)
    local desc=$(echo "${SESSIONS[$num]}" | cut -d':' -f2)
    
    if screen -list | grep -q "$name"; then
        echo -e "${YELLOW}🛑 Menghentikan $desc...${NC}"
        screen -S "$name" -X quit 2>/dev/null
        sleep 1
        echo -e "${GREEN}✅ $desc dihentikan${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $desc tidak berjalan${NC}"
        return 1
    fi
}

restart_session() {
    local num=$1
    echo -e "${BLUE}🔄 Merestart session $num...${NC}"
    stop_session "$num"
    sleep 2
    start_session "$num"
}

attach_session() {
    local num=$1
    local name=$(echo "${SESSIONS[$num]}" | cut -d':' -f1)
    local desc=$(echo "${SESSIONS[$num]}" | cut -d':' -f2)
    
    if screen -list | grep -q "$name"; then
        echo -e "${GREEN}📡 Melampirkan ke $desc...${NC}"
        echo -e "${YELLOW}Tekan Ctrl+A, D untuk detach${NC}"
        sleep 1
        screen -r "$name"
    else
        echo -e "${RED}❌ Session $desc tidak berjalan${NC}"
    fi
}

start_with_selection() {
    show_menu
    echo -e "${CYAN}Masukkan pilihan (contoh: 1,3 atau 1-3 atau 0 untuk semua):${NC}"
    read -p "Pilihan: " selection
    
    selections=$(parse_selection "$selection")
    
    for num in $selections; do
        start_session "$num"
        sleep 1
    done
    
    echo -e "${GREEN}✅ Selesai!${NC}"
}

stop_with_selection() {
    show_menu
    echo -e "${CYAN}Masukkan pilihan yang akan dihentikan (contoh: 1,3 atau 0 untuk semua):${NC}"
    read -p "Pilihan: " selection
    
    selections=$(parse_selection "$selection")
    
    for num in $selections; do
        stop_session "$num"
        sleep 1
    done
    
    echo -e "${GREEN}✅ Selesai!${NC}"
}

restart_with_selection() {
    show_menu
    echo -e "${CYAN}Masukkan pilihan yang akan direstart (contoh: 1,3 atau 0 untuk semua):${NC}"
    read -p "Pilihan: " selection
    
    selections=$(parse_selection "$selection")
    
    for num in $selections; do
        restart_session "$num"
        sleep 2
    done
    
    echo -e "${GREEN}✅ Selesai!${NC}"
}

attach_with_selection() {
    show_menu
    echo -e "${CYAN}Pilih session yang akan dilampiri:${NC}"
    read -p "Nomor: " selection
    
    attach_session "$selection"
}

list_sessions() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}📋 DAFTAR SCREEN SESSION${NC}"
    echo -e "${GREEN}========================================${NC}"
    screen -ls
    echo -e "${GREEN}========================================${NC}"
}

show_status() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}📊 STATUS SERVICE${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    for num in 1 2 3 4 5; do
        local name=$(echo "${SESSIONS[$num]}" | cut -d':' -f1)
        local desc=$(echo "${SESSIONS[$num]}" | cut -d':' -f2)
        
        if screen -list | grep -q "$name"; then
            echo -e "${GREEN}✅ $desc: RUNNING${NC}"
        else
            echo -e "${RED}❌ $desc: STOPPED${NC}"
        fi
    done
    
    echo -e "${GREEN}========================================${NC}"
    
    # Tambahan info untuk giveaway bot
    if [ -f "/root/wtb/giveaway/giveaway.db" ]; then
        echo -e "${BLUE}🎁 Giveaway Database: EXISTS${NC}"
    fi
    
    # Tambahan info untuk indotag bot
    if [ -f "/root/wtb/indotag/indotag.db" ]; then
        echo -e "${BLUE}🏷️ INDOTAG Database: EXISTS${NC}"
    fi
}

view_logs() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}📋 PILIH LOG${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "  ${CYAN}1.${NC} Flask Server Log"
    echo -e "  ${CYAN}2.${NC} Fragment Bot Log"
    echo -e "  ${CYAN}3.${NC} Giveaway Bot Log"
    echo -e "  ${CYAN}4.${NC} Semua Log (multitail)"
    echo -e "${GREEN}========================================${NC}"
    read -p "Pilihan: " choice
    
    case $choice in
        1)
            if [ -f "/root/wtb/logs/flask.log" ]; then
                tail -f /root/wtb/logs/flask.log
            else
                echo -e "${RED}Log file not found${NC}"
            fi
            ;;
        2)
            if [ -f "/root/wtb/logs/fragment_bot.log" ]; then
                tail -f /root/wtb/logs/fragment_bot.log
            else
                echo -e "${RED}Log file not found${NC}"
            fi
            ;;
        3)
            if [ -f "/root/wtb/logs/giveaway_bot.log" ]; then
                tail -f /root/wtb/logs/giveaway_bot.log
            else
                echo -e "${RED}Log file not found${NC}"
            fi
            ;;
        4)
            if command -v multitail &> /dev/null; then
                multitail /root/wtb/logs/flask.log /root/wtb/logs/fragment_bot.log /root/wtb/logs/giveaway_bot.log
            else
                echo -e "${YELLOW}Multitail tidak terinstall. Install dengan: apt install multitail${NC}"
                tail -f /root/wtb/logs/*.log
            fi
            ;;
        *)
            echo -e "${RED}Pilihan tidak valid${NC}"
            ;;
    esac
}

start_all() {
    echo -e "${GREEN}🚀 Menjalankan SEMUA session...${NC}"
    for num in 1 2 3 4; do
        start_session "$num"
        sleep 2
    done
    echo -e "${GREEN}✅ Semua session berjalan!${NC}"
}

stop_all() {
    echo -e "${YELLOW}🛑 Menghentikan SEMUA session...${NC}"
    for num in 1 2 3 4; do
        stop_session "$num"
        sleep 1
    done
    echo -e "${GREEN}✅ Semua session dihentikan!${NC}"
}

# Main menu untuk interaktif
interactive_menu() {
    while true; do
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}🎮 SCREEN SESSION MANAGER${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "  ${CYAN}1.${NC} Start Sessions (pilih)"
        echo -e "  ${CYAN}2.${NC} Stop Sessions (pilih)"
        echo -e "  ${CYAN}3.${NC} Restart Sessions (pilih)"
        echo -e "  ${CYAN}4.${NC} Attach to Session"
        echo -e "  ${CYAN}5.${NC} List Sessions"
        echo -e "  ${CYAN}6.${NC} Status"
        echo -e "  ${CYAN}7.${NC} View Logs"
        echo -e "  ${CYAN}8.${NC} Start ALL Sessions"
        echo -e "  ${CYAN}9.${NC} Stop ALL Sessions"
        echo -e "  ${CYAN}0.${NC} Exit"
        echo -e "${GREEN}========================================${NC}"
        read -p "Pilih menu: " menu_choice
        
        case $menu_choice in
            1) start_with_selection ;;
            2) stop_with_selection ;;
            3) restart_with_selection ;;
            4) attach_with_selection ;;
            5) list_sessions ;;
            6) show_status ;;
            7) view_logs ;;
            8) start_all ;;
            9) stop_all ;;
            0) echo -e "${GREEN}Bye!${NC}"; break ;;
            *) echo -e "${RED}Pilihan tidak valid${NC}" ;;
        esac
    done
}

# Parse command line arguments
case "$1" in
    start)
        if [ -n "$2" ]; then
            # Jika ada parameter langsung
            selections=$(parse_selection "$2")
            for num in $selections; do
                start_session "$num"
            done
        else
            start_with_selection
        fi
        ;;
    stop)
        if [ -n "$2" ]; then
            selections=$(parse_selection "$2")
            for num in $selections; do
                stop_session "$num"
            done
        else
            stop_with_selection
        fi
        ;;
    restart)
        if [ -n "$2" ]; then
            selections=$(parse_selection "$2")
            for num in $selections; do
                restart_session "$num"
            done
        else
            restart_with_selection
        fi
        ;;
    attach)
        if [ -n "$2" ]; then
            attach_session "$2"
        else
            attach_with_selection
        fi
        ;;
    list)
        list_sessions
        ;;
    status)
        show_status
        ;;
    logs)
        view_logs
        ;;
    all)
        start_all
        ;;
    stopall)
        stop_all
        ;;
    menu)
        interactive_menu
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        # Jika tidak ada argumen, tampilkan help
        show_help
        echo ""
        echo -e "${CYAN}Atau jalankan './screen.sh menu' untuk mode interaktif${NC}"
        ;;
esac
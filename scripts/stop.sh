#!/bin/bash
# Script untuk menghentikan aplikasi

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}🛑 Menghentikan Website Management API Server${NC}"
echo -e "${YELLOW}========================================${NC}"

# Cari proses Python yang menjalankan app.py
PID=$(ps aux | grep '[p]ython3 app.py' | awk '{print $2}')

if [ -z "$PID" ]; then
    echo -e "${RED}❌ Tidak ada server yang berjalan${NC}"
else
    echo -e "${GREEN}📡 Menghentikan server dengan PID: $PID${NC}"
    kill -15 $PID
    sleep 2
    
    # Cek apakah proses masih berjalan
    if ps -p $PID > /dev/null; then
        echo -e "${YELLOW}⚠️  Proses tidak berhenti, memaksa penghentian...${NC}"
        kill -9 $PID
    fi
    
    echo -e "${GREEN}✅ Server berhasil dihentikan${NC}"
fi
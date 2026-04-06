#!/bin/bash
# Script untuk menjalankan aplikasi

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Memulai Website Management API Server${NC}"
echo -e "${GREEN}========================================${NC}"

# Pindah ke direktori utama (satu level di atas scripts)
cd "$(dirname "$0")/.."

# Cek apakah Python sudah terinstall
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python3 tidak ditemukan. Silakan install Python3 terlebih dahulu.${NC}"
    exit 1
fi

# Jalankan aplikasi
echo -e "${GREEN}📡 Menjalankan server di port 5050...${NC}"
python3 app.py
python3 /root/fragment/fragment_bot.py

echo -e "${GREEN}✅ Server berhenti${NC}"
#!/bin/bash
# Script untuk membuat semua script dapat dieksekusi

cd "$(dirname "$0")"

echo -e "\033[0;32m🔧 Membuat script dapat dieksekusi...\033[0m"

chmod +x start.sh
chmod +x stop.sh
chmod +x screen.sh

echo -e "\033[0;32m✅ Selesai! Semua script sekarang dapat dieksekusi.\033[0m"
echo ""
echo -e "Gunakan:"
echo -e "  ./start.sh  - Untuk menjalankan server"
echo -e "  ./stop.sh   - Untuk menghentikan server"
echo -e "  ./screen.sh - Untuk mengelola screen session"
#!/bin/bash
# Script khusus untuk menjalankan Fragment Bot saja (testing)

cd "$(dirname "$0")/.."
source myenv/bin/activate

echo "🤖 Menjalankan Fragment Bot..."
python3 fragment/fragment_bot.py
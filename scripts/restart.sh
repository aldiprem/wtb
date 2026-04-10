#!/bin/bash
# Script untuk merestart semua service

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Merestart semua service...${NC}"

# Stop semua service
./scripts/stop.sh

# Tunggu sebentar
sleep 3

# Start semua service
./scripts/start.sh

echo -e "${GREEN}✅ Restart selesai!${NC}"
echo -e "${BLUE}🎁 Giveaway Bot termasuk dalam service yang direstart${NC}"
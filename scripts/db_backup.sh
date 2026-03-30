#!/bin/bash
BACKUP_DIR="/root/wtb/backups"
mkdir -p $BACKUP_DIR
FILE_NAME="$BACKUP_DIR/wtb_backup_$(date +%Y%m%d_%H%M%S).sql"

# Jalankan dump
mysqldump -u root -p'password_kamu' wtb_database > $FILE_NAME

echo "✅ Backup selesai: $FILE_NAME"
# Hapus backup lama (lebih dari 7 hari)
find $BACKUP_DIR -type f -mtime +7 -name "*.sql" -delete
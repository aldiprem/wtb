#!/bin/bash
if [ -z "$1" ]; then
    echo "Gunakan: ./db_restore.sh nama_file_backup.sql"
    exit 1
fi

mysql -u root -p'password_kamu' wtb_database < $1
echo "✅ Restore database dari $1 berhasil!"
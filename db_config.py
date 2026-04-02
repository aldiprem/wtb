# db_config.py
import mysql.connector
from mysql.connector import pooling
import os

IMAGE_BASE_URL = "https://companel.shop/ii?"
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024

# Konfigurasi Database
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "Asdf1234_",
    "database": "wtb_database"
}

connection_pool = None

try:
    connection_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="wtb_pool",
        pool_size=10,
        pool_reset_session=True,
        **db_config
    )
    print("✅ MySQL Connection Pool created successfully")
except mysql.connector.Error as err:
    print(f"❌ Error creating pool: {err}")

def get_db_connection():
    global connection_pool
    if connection_pool is None:
        # Fallback: buat koneksi biasa jika pool gagal
        return mysql.connector.connect(**db_config)
    return connection_pool.get_connection()
    
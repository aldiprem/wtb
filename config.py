import os
from dotenv import load_dotenv

load_dotenv()

# Telegram API
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

# Cloudflare Credentials
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN')

# Database
DATABASE_URL = 'sqlite:///ai.db'

# Owner ID
OWNER_ID = int(os.getenv('OWNER_ID', '0'))

# Interval cek pesan (detik)
CHECK_INTERVAL = 0.1

CLOUDFLARE_MODEL = "@cf/qwen/qwen1.5-14b-chat-awq"

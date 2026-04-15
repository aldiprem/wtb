import os
import asyncio
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button
from telethon.errors import ChatAdminRequiredError, RPCError
import sys
import re
import random
import string

# Load .env
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent.parent / '.env',
    Path('/root/wtb/.env'),
]

loaded = False
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"✅ Loaded .env from: {env_path}")
        loaded = True
        break

if not loaded:
    print("⚠️ No .env file found, using system environment variables")
    load_dotenv()

# Import database
from database.data import IndotagDatabase

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
API_ID = os.getenv("API_ID", "")
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("INDOTAG_TOKEN", "")
OWNER_ID = os.getenv("OWNER_ID", "")

if not API_ID or not API_HASH or not BOT_TOKEN:
    logger.error("❌ Missing configuration!")
    print("\n📋 Environment variables found:")
    for key in ['API_ID', 'API_HASH', 'INDOTAG_TOKEN', 'OWNER_ID']:
        value = os.getenv(key)
        if value:
            if key == 'INDOTAG_TOKEN':
                print(f"   {key}: {value[:10]}... (length: {len(value)})")
            else:
                print(f"   {key}: {value}")
        else:
            print(f"   {key}: NOT SET")
    sys.exit(1)

API_ID = int(API_ID)
OWNER_ID = int(OWNER_ID) if OWNER_ID else 0

# Inisialisasi database
db = IndotagDatabase(db_path="/root/wtb/indotag/database/indotag.db")
bot = TelegramClient('indotag_bot_session', API_ID, API_HASH)

# User states
user_states = {}

def format_price(price: int) -> str:
    return f"{price:,}".replace(",", ".")

def generate_verification_id() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

# ============ DATABASE PENDING METHODS (sudah ada di data.py, panggil saja) ============

async def main_menu(user_id: int, first_name: str = ""):
    user = db.get_user(user_id)
    balance = user['balance'] if user else 0
    
    msg = f"""
╔══════════════════════════╗
║      🏷️ INDOTAG MARKET     ║
╚══════════════════════════╝

👤 **{first_name}**
💰 **Saldo:** Rp {format_price(balance)}

📌 **Menu Utama:**
• Jual username Telegram
• Lihat daftar username saya
• Lihat profil

━━━━━━━━━━━━━━━━━━━━━
Gunakan tombol di bawah
"""
    
    buttons = [
        [Button.inline("➕ ADD USERNAME", data="add_username")],
        [Button.inline("📦 MY LISTINGS", data="my_listings")],
        [Button.inline("📊 PROFIL", data="profile")]
    ]
    
    return msg, buttons

@bot.on(events.NewMessage(pattern="^/start$"))
async def start(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    username = user.username or ""
    
    db.save_user(user_id, username, first_name, last_name)
    
    msg, buttons = await main_menu(user_id, first_name)
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="main_menu"))
async def back_to_main(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    
    if user_id in user_states:
        del user_states[user_id]
    
    msg, buttons = await main_menu(user_id, first_name)
    await event.edit(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="add_username"))
async def add_username_start(event):
    user_id = event.sender_id
    user_states[user_id] = {'step': 'waiting_username'}
    
    msg = """
╔══════════════════════════╗
║      ➕ ADD USERNAME       ║
╚══════════════════════════╝

Kirimkan **username Telegram** yang ingin dijual.

📝 Format: `@username` atau `username`
Contoh: `@johndoe`

⚠️ Pemilik username harus konfirmasi.
Ketik /cancel untuk batal
"""
    await event.edit(msg, buttons=[[Button.inline("❌ Batal", data="main_menu")]])

async def check_entity_type(entity):
    if hasattr(entity, 'broadcast') and entity.broadcast:
        return 'channel', entity.title or entity.username or str(entity.id)
    elif hasattr(entity, 'megagroup') and entity.megagroup:
        return 'supergroup', entity.title or entity.username or str(entity.id)
    elif hasattr(entity, 'group') and entity.group:
        return 'group', entity.title or entity.username or str(entity.id)
    else:
        return 'user', f"{entity.first_name or ''} {entity.last_name or ''}".strip() or entity.username or str(entity.id)

@bot.on(events.NewMessage)
async def handle_add_username_input(event):
    user_id = event.sender_id
    
    if user_id not in user_states:
        return
    
    state = user_states[user_id]
    
    if event.raw_text.startswith('/'):
        if event.raw_text == '/cancel':
            del user_states[user_id]
            msg, buttons = await main_menu(user_id, "")
            await event.respond("❌ Dibatalkan.", buttons=buttons)
            return
        return
    
    # STEP 1: WAITING USERNAME
    if state.get('step') == 'waiting_username':
        username_input = event.raw_text.strip().lstrip('@')
        
        if not re.match(r'^[a-zA-Z0-9_]{5,32}$', username_input):
            await event.reply("❌ Username tidak valid! (huruf, angka, underscore, 5-32 karakter)")
            return
        
        try:
            entity = await bot.get_entity(username_input)
            entity_type, entity_name = await check_entity_type(entity)
            
            user_states[user_id]['username'] = username_input
            user_states[user_id]['target_type'] = entity_type
            user_states[user_id]['target_id'] = entity.id
            user_states[user_id]['target_name'] = entity_name
            user_states[user_id]['step'] = 'waiting_price'
            
            await event.reply(f"""
✅ Ditemukan: **{entity_name}** ({entity_type.upper()})

Masukkan **harga jual** (Rupiah):
Contoh: `50000` atau `100000`

Ketik /cancel untuk batal
""")
            return
        except Exception as e:
            await event.reply(f"❌ Username @{username_input} tidak ditemukan!")
            return
    
    # STEP 2: WAITING PRICE
    elif state.get('step') == 'waiting_price':
        try:
            price = int(event.raw_text.strip())
            if price < 10000:
                await event.reply("❌ Harga minimal Rp 10.000")
                return
            if price > 100000000:
                await event.reply("❌ Harga maksimal Rp 100.000.000")
                return
        except ValueError:
            await event.reply("❌ Harga harus angka! Contoh: `50000`")
            return
        
        user_states[user_id]['price'] = price
        user_states[user_id]['step'] = 'waiting_description'
        
        await event.reply(f"""
💰 Harga: Rp {format_price(price)}

Masukkan **deskripsi** (opsional):
Ketik `-` untuk skip

Ketik /cancel untuk batal
""")
        return
    
    # STEP 3: WAITING DESCRIPTION
    elif state.get('step') == 'waiting_description':
        description = event.raw_text.strip()
        if description == '-':
            description = ""
        
        username = user_states[user_id]['username']
        target_type = user_states[user_id]['target_type']
        target_id = user_states[user_id]['target_id']
        price = user_states[user_id]['price']
        
        # Info penjual
        seller = await bot.get_entity(user_id)
        seller_name = f"{seller.first_name or ''} {seller.last_name or ''}".strip() or seller.username or str(user_id)
        
        # CEK AKSES BOT UNTUK CHANNEL
        if target_type in ['channel', 'supergroup', 'group']:
            try:
                await bot.send_message(target_id, "🔐 Cek akses...")
            except ChatAdminRequiredError:
                await event.reply("❌ Bot bukan admin di channel ini! Tambahkan bot sebagai admin dulu.")
                del user_states[user_id]
                return
            except Exception as e:
                await event.reply(f"❌ Tidak dapat mengakses channel: {str(e)[:100]}")
                del user_states[user_id]
                return
        
        # CEK AKSES UNTUK USER
        if target_type == 'user':
            try:
                await bot.send_message(target_id, "🔐 Verifikasi username...")
            except RPCError:
                await event.reply(f"❌ User @{username} belum start bot atau memblokir bot!")
                del user_states[user_id]
                return
        
        # SIMPAN KE PENDING DATABASE
        verification_id = generate_verification_id()
        success_save = db.save_pending_verification(
            verification_id=verification_id,
            username=username,
            seller_id=user_id,
            seller_name=seller_name,
            price=price,
            description=description,
            target_id=target_id,
            target_type=target_type
        )
        
        if not success_save:
            await event.reply("❌ Gagal menyimpan data verifikasi!")
            del user_states[user_id]
            return
        
        # KIRIM VERIFIKASI
        try:
            msg_verif = f"""
🔐 **VERIFIKASI KEPEMILIKAN USERNAME**

Seseorang ingin menjual username **@{username}**

👤 **Penjual:** {seller_name}
💰 **Harga:** Rp {format_price(price)}
📝 **Deskripsi:** {description if description else '-'}

━━━━━━━━━━━━━━━━━━━━━

⚠️ **Apakah Anda pemilik username @{username}?**

Klik tombol di bawah untuk mengkonfirmasi.
"""
            buttons_verif = [[Button.inline("✅ KONFIRMASI", data=f"verify:{verification_id}")]]
            
            await bot.send_message(target_id, msg_verif, buttons=buttons_verif)
            
            await event.reply(f"""
✅ **Permintaan verifikasi telah dikirim!**

📝 Username: @{username}
🏷️ Tipe: {target_type.upper()}
💰 Harga: Rp {format_price(price)}

⏳ Menunggu konfirmasi dari pemilik username.
Anda akan mendapat notifikasi jika sudah diverifikasi.

🆔 ID Verifikasi: `{verification_id}`
""")
        except Exception as e:
            db.delete_pending_verification(verification_id)
            await event.reply(f"❌ Gagal mengirim verifikasi: {str(e)[:100]}")
        
        # Clear state
        del user_states[user_id]
        
        # Kembali ke menu
        msg_menu, buttons = await main_menu(user_id, "")
        await event.respond(msg_menu, buttons=buttons)

# ============ CALLBACK VERIFIKASI ============
@bot.on(events.CallbackQuery(pattern=r"verify:([^:]+)"))
async def verify_callback(event):
    """Handle verifikasi dari channel atau user"""
    verification_id = event.data_match.group(1)
    clicker_id = event.sender_id
    
    # Ambil data pending dari DATABASE
    pending = db.get_pending_verification(verification_id)
    
    if not pending:
        await event.answer("❌ Verifikasi tidak ditemukan! Mungkin sudah diproses.", alert=True)
        return
    
    # CEK: Apakah yang klik adalah target yang benar?
    if pending['target_id'] != clicker_id:
        await event.answer("❌ Anda bukan pemilik username ini!", alert=True)
        return
    
    # KONFIRMASI BERHASIL
    await event.answer("✅ Verifikasi berhasil!", alert=True)
    
    # Simpan ke database usernames
    success = db.add_username(
        pending['username'],
        pending['seller_id'],
        pending['price'],
        pending['description']
    )
    
    if success:
        # Update pesan verifikasi
        await event.edit(f"""
✅ **VERIFIKASI BERHASIL!**

Username **@{pending['username']}** telah diverifikasi dan masuk ke marketplace.

📝 **Detail:**
• Harga: Rp {format_price(pending['price'])}
• Status: Available
""")
        
        # Notifikasi ke penjual
        try:
            await bot.send_message(
                pending['seller_id'],
                f"""
✅ **USERNAME BERHASIL DIVERIFIKASI!**

Username @{pending['username']} telah dikonfirmasi oleh pemiliknya.

💰 Harga: Rp {format_price(pending['price'])}
📊 Status: Available

Cek di menu MY LISTINGS.
"""
            )
        except:
            pass
        
        # Hapus dari pending
        db.delete_pending_verification(verification_id)
        
        # Notifikasi ke admin
        try:
            await bot.send_message(
                OWNER_ID,
                f"✅ Username @{pending['username']} diverifikasi. Penjual: {pending['seller_name']}"
            )
        except:
            pass
    else:
        await event.edit(f"❌ Gagal: Username @{pending['username']} sudah terdaftar!")
        db.delete_pending_verification(verification_id)

# ============ MY LISTINGS ============
@bot.on(events.CallbackQuery(data="my_listings"))
async def my_listings(event):
    user_id = event.sender_id
    usernames = db.get_my_usernames(user_id)
    
    if not usernames:
        msg = """
╔══════════════════════════╗
║      📦 MY LISTINGS        ║
╚══════════════════════════╝

Belum ada listing.

Tekan 「➕ ADD USERNAME」
"""
        buttons = [[Button.inline("➕ ADD USERNAME", data="add_username")],
                   [Button.inline("🔙 Kembali", data="main_menu")]]
        await event.edit(msg, buttons=buttons)
        return
    
    msg = f"""
╔══════════════════════════╗
║      📦 MY LISTINGS        ║
╚══════════════════════════╝
Total {len(usernames)} username

"""
    for i, u in enumerate(usernames, 1):
        status_icon = "✅" if u['status'] == 'available' else "❌"
        status_text = "Available" if u['status'] == 'available' else "Terjual"
        msg += f"\n{i}. {status_icon} @{u['username']}\n"
        msg += f"   💰 Rp {format_price(u['price'])}\n"
        msg += f"   📊 {status_text}\n"
        if u.get('description'):
            msg += f"   📝 {u['description'][:50]}\n"
        msg += f"   🆔 ID: {u['id']}\n"
    
    buttons = [
        [Button.inline("🗑 Hapus Listing", data="delete_listing")],
        [Button.inline("🔙 Kembali", data="main_menu")]
    ]
    await event.edit(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="delete_listing"))
async def delete_listing_start(event):
    user_id = event.sender_id
    user_states[user_id] = {'step': 'waiting_delete_id'}
    
    msg = """
╔══════════════════════════╗
║      🗑 HAPUS LISTING      ║
╚══════════════════════════╝

Masukkan ID Username yang ingin dihapus.

ID bisa dilihat di MY LISTINGS.

Ketik /cancel untuk batal
"""
    await event.edit(msg, buttons=[[Button.inline("🔙 Kembali", data="my_listings")]])

@bot.on(events.NewMessage)
async def handle_delete_listing(event):
    user_id = event.sender_id
    if user_id not in user_states:
        return
    
    state = user_states[user_id]
    if state.get('step') != 'waiting_delete_id':
        return
    
    if event.raw_text.startswith('/'):
        if event.raw_text == '/cancel':
            del user_states[user_id]
            msg, buttons = await main_menu(user_id, "")
            await event.respond("❌ Dibatalkan.", buttons=buttons)
            return
        return
    
    try:
        username_id = int(event.raw_text.strip())
    except ValueError:
        await event.reply("❌ ID harus angka!")
        return
    
    success = db.delete_username(username_id, user_id)
    if success:
        await event.reply(f"✅ Listing ID `{username_id}` berhasil dihapus!")
    else:
        await event.reply(f"❌ Gagal hapus listing ID `{username_id}`")
    
    del user_states[user_id]
    user = await bot.get_entity(user_id)
    msg, buttons = await main_menu(user_id, user.first_name or "")
    await event.respond(msg, buttons=buttons)

# ============ PROFIL ============
@bot.on(events.CallbackQuery(data="profile"))
async def profile(event):
    user_id = event.sender_id
    user = db.get_user(user_id)
    
    if not user:
        msg = "❌ Data tidak ditemukan"
        buttons = [[Button.inline("🔙 Kembali", data="main_menu")]]
        await event.edit(msg, buttons=buttons)
        return
    
    usernames = db.get_my_usernames(user_id)
    msg = f"""
╔══════════════════════════╗
║      📊 PROFIL ANDA        ║
╚══════════════════════════╝

🆔 ID: `{user['user_id']}`
👤 @{user['username'] or '-'}
📛 {user['first_name'] or ''} {user['last_name'] or ''}
💰 Saldo: Rp {format_price(user['balance'])}
👑 Admin: {'Ya' if user['is_admin'] else 'Tidak'}

📦 Listing: {len(usernames)}
"""
    buttons = [[Button.inline("🔙 Kembali", data="main_menu")]]
    await event.edit(msg, buttons=buttons)

# ============ ADMIN COMMANDS ============
@bot.on(events.NewMessage(pattern="^/addbalance (\\d+) (\\d+)$"))
async def admin_add_balance(event):
    if event.sender_id != OWNER_ID:
        return
    user_id = int(event.data_match.group(1))
    amount = int(event.data_match.group(2))
    if db.add_balance(user_id, amount):
        await event.reply(f"✅ +Rp {format_price(amount)} ke user {user_id}")
    else:
        await event.reply("❌ Gagal")

@bot.on(events.NewMessage(pattern="^/listusers$"))
async def admin_list_users(event):
    if event.sender_id != OWNER_ID:
        return
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT user_id, username, first_name, balance FROM users ORDER BY balance DESC LIMIT 20')
        rows = cursor.fetchall()
    if not rows:
        await event.reply("Belum ada user")
        return
    msg = "📊 TOP 20 USERS\n\n"
    for i, row in enumerate(rows, 1):
        msg += f"{i}. ID: `{row[0]}` | @{row[1] or '-'} | {row[2] or '-'}\n   💰 Rp {format_price(row[3])}\n\n"
    await event.reply(msg)

@bot.on(events.NewMessage(pattern="^/stats$"))
async def admin_stats(event):
    if event.sender_id != OWNER_ID:
        return
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM usernames WHERE status = "available"')
        available = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM usernames WHERE status = "sold"')
        sold = cursor.fetchone()[0]
    msg = f"""
📊 INDOTAG STATS

👥 Users: {total_users}
🏷️ Available: {available}
✅ Sold: {sold}
"""
    await event.reply(msg)

@bot.on(events.NewMessage(pattern="^/pending$"))
async def admin_list_pending(event):
    if event.sender_id != OWNER_ID:
        return
    
    pendings = db.get_all_pending_verifications()
    
    if not pendings:
        await event.reply("Tidak ada verifikasi pending.")
        return
    
    msg = "⏳ **PENDING VERIFICATIONS**\n\n"
    for p in pendings:
        msg += f"🆔 ID: `{p['verification_id']}`\n"
        msg += f"📝 Username: @{p['username']}\n"
        msg += f"👤 Penjual: {p['seller_name']}\n"
        msg += f"💰 Harga: Rp {format_price(p['price'])}\n"
        msg += f"🏷️ Target: {p['target_type']} (ID: {p['target_id']})\n"
        msg += f"📅 Dibuat: {p['created_at'][:19]}\n\n"
    
    await event.reply(msg)

# ============ MAIN ============
async def main():
    logger.info("🚀 Starting INDOTAG Market Bot...")
    
    db.init_database()
    db.init_pending_table()
    
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ INDOTAG Bot is running")
    
    await bot.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 INDOTAG Bot dihentikan")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")
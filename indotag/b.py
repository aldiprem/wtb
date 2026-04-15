import os
import asyncio
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Perbaiki import - gunakan dari database.data
from database.data import IndotagDatabase

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("INDOTAG_TOKEN", "")
OWNER_ID = int(os.getenv("OWNER_ID", 0))

# Inisialisasi database dengan path yang benar
db = IndotagDatabase(db_path="/root/wtb/indotag/database/indotag.db")
bot = TelegramClient('indotag_bot_session', API_ID, API_HASH)

# User states untuk multi-step input
user_states = {}

def format_price(price: int) -> str:
    """Format price with thousand separator"""
    return f"{price:,}".replace(",", ".")

async def main_menu(user_id: int, first_name: str = ""):
    """Display main menu"""
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
• Beli username Telegram
• Lihat daftar username

━━━━━━━━━━━━━━━━━━━━━
Gunakan tombol di bawah
"""
    
    buttons = [
        [Button.inline("➕ ADD USERNAME", data="add_username")],
        [Button.inline("🛒 MARKETPLACE", data="marketplace"),
         Button.inline("📦 MY LISTINGS", data="my_listings")],
        [Button.inline("💰 TOP UP SALDO", data="topup"),
         Button.inline("📊 PROFIL", data="profile")]
    ]
    
    return msg, buttons

@bot.on(events.NewMessage(pattern="^/start$"))
async def start(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    username = user.username or ""
    
    # Save user to database
    db.save_user(user_id, username, first_name, last_name)
    
    msg, buttons = await main_menu(user_id, first_name)
    
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="main_menu"))
async def back_to_main(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    
    # Clear user state
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

Silakan kirimkan **username Telegram** yang ingin dijual.

📝 **Format:** `@username` atau `username`

Contoh: `@johndoe` atau `johndoe`

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
    
    await event.edit(msg, buttons=[[Button.inline("❌ Batal", data="main_menu")]])

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
            await event.respond("❌ Dibatalakan.", buttons=buttons)
            return
        return
    
    if state.get('step') == 'waiting_username':
        username_input = event.raw_text.strip().lstrip('@')
        
        # Validasi username (hanya huruf, angka, underscore)
        import re
        if not re.match(r'^[a-zA-Z0-9_]{5,32}$', username_input):
            await event.reply("❌ Format username tidak valid!\n\nUsername hanya boleh berisi huruf, angka, underscore, panjang 5-32 karakter.")
            return
        
        user_states[user_id]['username'] = username_input
        user_states[user_id]['step'] = 'waiting_price'
        
        msg = f"""
╔══════════════════════════╗
║      ➕ ADD USERNAME       ║
╚══════════════════════════╝

📝 **Username:** @{username_input}

Sekarang masukkan **harga jual** (dalam Rupiah).

Contoh: `50000` atau `100000`

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
        await event.reply(msg)
        return
    
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
            await event.reply("❌ Harga harus berupa angka!\n\nContoh: `50000`")
            return
        
        user_states[user_id]['price'] = price
        user_states[user_id]['step'] = 'waiting_description'
        
        msg = f"""
╔══════════════════════════╗
║      ➕ ADD USERNAME       ║
╚══════════════════════════╝

📝 **Username:** @{user_states[user_id]['username']}
💰 **Harga:** Rp {format_price(price)}

Sekarang masukkan **deskripsi** (opsional).

Contoh: `Username premium, no pinalty`

Ketik `-` untuk skip atau langsung kirim pesan.

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
        await event.reply(msg)
        return
    
    elif state.get('step') == 'waiting_description':
        description = event.raw_text.strip()
        if description == '-':
            description = ""
        
        username = user_states[user_id]['username']
        price = user_states[user_id]['price']
        
        # Simpan ke database
        success = db.add_username(username, user_id, price, description)
        
        if success:
            msg = f"""
✅ **Username Berhasil Ditambahkan!**

📝 **Username:** @{username}
💰 **Harga:** Rp {format_price(price)}
📝 **Deskripsi:** {description if description else '-'}

Username akan muncul di marketplace.
"""
            await event.reply(msg)
        else:
            await event.reply("❌ Gagal menambahkan username. Mungkin username sudah terdaftar di sistem.")
        
        # Clear state dan kembali ke menu
        del user_states[user_id]
        msg_menu, buttons = await main_menu(user_id, "")
        await event.respond(msg_menu, buttons=buttons)

@bot.on(events.CallbackQuery(data="marketplace"))
async def show_marketplace(event, page: int = 0):
    user_id = event.sender_id
    
    usernames = db.get_all_available_usernames(limit=10, offset=page * 10)
    total = len(db.get_all_available_usernames(limit=10000))
    total_pages = (total + 9) // 10
    
    if not usernames:
        msg = """
╔══════════════════════════╗
║      🛒 MARKETPLACE        ║
╚══════════════════════════╝

Belum ada username yang dijual.

Jadilah yang pertama dengan menekan tombol
「➕ ADD USERNAME」
"""
        buttons = [[Button.inline("➕ ADD USERNAME", data="add_username")],
                   [Button.inline("🔙 Kembali", data="main_menu")]]
        await event.edit(msg, buttons=buttons)
        return
    
    msg = f"""
╔══════════════════════════╗
║      🛒 MARKETPLACE        ║
╚══════════════════════════╝
📊 Total {total} username tersedia

"""
    
    for i, u in enumerate(usernames, 1 + (page * 10)):
        msg += f"\n{i}. **@{u['username']}**\n   💰 Rp {format_price(u['price'])}\n"
        if u.get('description'):
            msg += f"   📝 {u['description'][:50]}\n"
        msg += f"   🆔 ID: `{u['id']}`\n"
    
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━\n📄 Halaman {page + 1}/{total_pages}"
    
    buttons = []
    
    # Pagination buttons
    nav_buttons = []
    if page > 0:
        nav_buttons.append(Button.inline("◀ Sebelumnya", data=f"marketplace_page_{page - 1}"))
    if page + 1 < total_pages:
        nav_buttons.append(Button.inline("Selanjutnya ▶", data=f"marketplace_page_{page + 1}"))
    if nav_buttons:
        buttons.append(nav_buttons)
    
    buttons.append([Button.inline("🛒 Beli Username", data="buy_username")])
    buttons.append([Button.inline("🔙 Kembali", data="main_menu")])
    
    await event.edit(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern=r"marketplace_page_(\d+)"))
async def marketplace_page(event):
    page = int(event.data_match.group(1))
    await show_marketplace(event, page)

@bot.on(events.CallbackQuery(data="buy_username"))
async def buy_username_start(event):
    user_id = event.sender_id
    
    user_states[user_id] = {'step': 'waiting_username_id'}
    
    msg = """
╔══════════════════════════╗
║      🛒 BELI USERNAME      ║
╚══════════════════════════╝

Masukkan **ID Username** yang ingin dibeli.

ID bisa dilihat di marketplace (contoh: `1`, `2`, `3`)

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
    
    await event.edit(msg, buttons=[[Button.inline("🔙 Kembali", data="marketplace")]])

# Handler untuk input ID pembelian
@bot.on(events.NewMessage)
async def handle_buy_username_input(event):
    user_id = event.sender_id
    
    if user_id not in user_states:
        return
    
    state = user_states[user_id]
    
    if state.get('step') != 'waiting_username_id':
        return
    
    if event.raw_text.startswith('/'):
        if event.raw_text == '/cancel':
            del user_states[user_id]
            msg, buttons = await main_menu(user_id, "")
            await event.respond("❌ Dibatalakan.", buttons=buttons)
            return
        return
    
    try:
        username_id = int(event.raw_text.strip())
    except ValueError:
        await event.reply("❌ ID harus berupa angka!")
        return
    
    # Cari username berdasarkan ID
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, seller_id, price, description
            FROM usernames WHERE id = ? AND status = 'available'
        ''', (username_id,))
        row = cursor.fetchone()
    
    if not row:
        await event.reply("❌ Username tidak ditemukan atau sudah terjual!")
        del user_states[user_id]
        return
    
    username_data = {
        'id': row[0],
        'username': row[1],
        'seller_id': row[2],
        'price': row[3],
        'description': row[4]
    }
    
    # Cek saldo user
    user = db.get_user(user_id)
    if not user or user['balance'] < username_data['price']:
        await event.reply(f"❌ Saldo tidak cukup!\n💰 Saldo: Rp {format_price(user['balance']) if user else 0}\n💵 Harga: Rp {format_price(username_data['price'])}\n\nSilakan top up saldo terlebih dahulu.")
        del user_states[user_id]
        return
    
    # Tampilkan konfirmasi pembelian
    user_states[user_id]['buy_username'] = username_data
    
    confirm_msg = f"""
╔══════════════════════════╗
║      ✅ KONFIRMASI          ║
╚══════════════════════════╝

📝 **Username:** @{username_data['username']}
💰 **Harga:** Rp {format_price(username_data['price'])}
👤 **Penjual ID:** `{username_data['seller_id']}`

💳 **Saldo Anda:** Rp {format_price(user['balance'])}
💵 **Setelah beli:** Rp {format_price(user['balance'] - username_data['price'])}

━━━━━━━━━━━━━━━━━━━━━
Konfirmasi pembelian?
"""
    
    buttons = [
        [Button.inline("✅ Ya, Beli", data="confirm_buy"),
         Button.inline("❌ Batal", data="cancel_buy")]
    ]
    
    await event.reply(confirm_msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="confirm_buy"))
async def confirm_buy(event):
    user_id = event.sender_id
    
    if user_id not in user_states or 'buy_username' not in user_states[user_id]:
        await event.answer("Data tidak ditemukan", alert=True)
        return
    
    username_data = user_states[user_id]['buy_username']
    
    # Proses pembelian
    success = db.deduct_balance(user_id, username_data['price'])
    
    if not success:
        await event.edit("❌ Saldo tidak cukup untuk melakukan pembelian!")
        del user_states[user_id]
        return
    
    # Tambah saldo ke penjual
    db.add_balance(username_data['seller_id'], username_data['price'])
    
    # Update status username
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute('''
            UPDATE usernames 
            SET status = 'sold', sold_at = ?, buyer_id = ?
            WHERE id = ?
        ''', (now, user_id, username_data['id']))
        conn.commit()
    
    # Buat transaksi
    transaction_id = db.create_transaction(
        username_data['username'],
        username_data['seller_id'],
        user_id,
        username_data['price']
    )
    
    # Notifikasi ke pembeli
    await event.edit(f"""
✅ **PEMBELIAN BERHASIL!**

📝 **Username:** @{username_data['username']}
💰 **Harga:** Rp {format_price(username_data['price'])}
🆔 **Transaksi ID:** `{transaction_id}`

Username akan segera dikirim oleh penjual.
Terima kasih telah berbelanja di INDOTAG MARKET! 🎉
""")
    
    # Notifikasi ke penjual
    try:
        await bot.send_message(
            username_data['seller_id'],
            f"""
🎉 **USERNAME TERJUAL!**

📝 **Username:** @{username_data['username']}
💰 **Harga:** Rp {format_price(username_data['price'])}
👤 **Dibeli oleh:** User ID `{user_id}`

💰 **Saldo Anda bertambah Rp {format_price(username_data['price'])}**

Silakan hubungi pembeli untuk mengirimkan username.
"""
        )
    except:
        pass
    
    del user_states[user_id]
    
    # Kembali ke menu utama
    user = await bot.get_entity(user_id)
    msg, buttons = await main_menu(user_id, user.first_name or "")
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="cancel_buy"))
async def cancel_buy(event):
    user_id = event.sender_id
    
    if user_id in user_states:
        del user_states[user_id]
    
    await event.edit("❌ Pembelian dibatalkan.")
    
    # Kembali ke menu utama
    user = await bot.get_entity(user_id)
    msg, buttons = await main_menu(user_id, user.first_name or "")
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="my_listings"))
async def my_listings(event):
    user_id = event.sender_id
    
    usernames = db.get_my_usernames(user_id)
    
    if not usernames:
        msg = """
╔══════════════════════════╗
║      📦 MY LISTINGS        ║
╚══════════════════════════╝

Anda belum memiliki listing.

Tekan tombol 「➕ ADD USERNAME」 untuk menjual.
"""
        buttons = [[Button.inline("➕ ADD USERNAME", data="add_username")],
                   [Button.inline("🔙 Kembali", data="main_menu")]]
        await event.edit(msg, buttons=buttons)
        return
    
    msg = f"""
╔══════════════════════════╗
║      📦 MY LISTINGS        ║
╚══════════════════════════╝
Total {len(usernames)} username terdaftar

"""
    
    for i, u in enumerate(usernames, 1):
        status_icon = "✅" if u['status'] == 'available' else "❌"
        msg += f"\n{i}. {status_icon} **@{u['username']}**\n"
        msg += f"   💰 Rp {format_price(u['price'])}\n"
        msg += f"   📊 Status: {u['status']}\n"
        if u.get('description'):
            msg += f"   📝 {u['description'][:50]}\n"
        msg += f"   🆔 ID: `{u['id']}`\n"
    
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

Masukkan **ID Username** yang ingin dihapus.

ID bisa dilihat di menu 「📦 MY LISTINGS」

⚠️ **Peringatan:** Hanya listing dengan status "available" yang bisa dihapus.

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
    
    await event.edit(msg, buttons=[[Button.inline("🔙 Kembali", data="my_listings")]])

# Handler untuk hapus listing
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
        await event.reply("❌ ID harus berupa angka!")
        return
    
    success = db.delete_username(username_id, user_id)
    
    if success:
        await event.reply(f"✅ Listing dengan ID `{username_id}` berhasil dihapus!")
    else:
        await event.reply(f"❌ Gagal menghapus listing. Pastikan ID `{username_id}` milik Anda dan masih tersedia.")
    
    del user_states[user_id]
    
    # Kembali ke menu utama
    user = await bot.get_entity(user_id)
    msg, buttons = await main_menu(user_id, user.first_name or "")
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="profile"))
async def profile(event):
    user_id = event.sender_id
    user = db.get_user(user_id)
    
    if not user:
        msg = "❌ Data user tidak ditemukan"
        buttons = [[Button.inline("🔙 Kembali", data="main_menu")]]
        await event.edit(msg, buttons=buttons)
        return
    
    msg = f"""
╔══════════════════════════╗
║      📊 PROFIL ANDA        ║
╚══════════════════════════╝

🆔 **User ID:** `{user['user_id']}`
👤 **Username:** @{user['username'] or '-'}
📛 **Nama:** {user['first_name'] or ''} {user['last_name'] or ''}
💰 **Saldo:** Rp {format_price(user['balance'])}
👑 **Admin:** {'Ya' if user['is_admin'] else 'Tidak'}

━━━━━━━━━━━━━━━━━━━━━
📌 **Fitur:**
• Jual username Telegram
• Beli username dengan saldo
• Top up saldo (Admin)

"""
    
    buttons = [[Button.inline("🔙 Kembali", data="main_menu")]]
    
    await event.edit(msg, buttons=buttons)

@bot.on(events.CallbackQuery(data="topup"))
async def topup(event):
    user_id = event.sender_id
    user = db.get_user(user_id)
    
    msg = f"""
╔══════════════════════════╗
║      💰 TOP UP SALDO       ║
╚══════════════════════════╝

💰 **Saldo saat ini:** Rp {format_price(user['balance']) if user else '0'}

📌 **Cara Top Up:**
1. Hubungi admin @indotag_admin
2. Transfer ke rekening yang tersedia
3. Kirim bukti transfer
4. Saldo akan ditambahkan otomatis

💳 **Metode Pembayaran:**
• Bank BCA / Mandiri / BNI
• QRIS
• Dana / OVO

━━━━━━━━━━━━━━━━━━━━━
Hubungi admin untuk top up.
"""
    
    buttons = [
        [Button.url("📞 Hubungi Admin", url="https://t.me/indotag_admin")],
        [Button.inline("🔙 Kembali", data="main_menu")]
    ]
    
    await event.edit(msg, buttons=buttons)

# ==================== ADMIN COMMANDS ====================

@bot.on(events.NewMessage(pattern="^/addbalance (\\d+) (\\d+)$"))
async def admin_add_balance(event):
    if event.sender_id != OWNER_ID:
        return
    
    user_id = int(event.data_match.group(1))
    amount = int(event.data_match.group(2))
    
    success = db.add_balance(user_id, amount)
    
    if success:
        await event.reply(f"✅ Berhasil menambah saldo Rp {format_price(amount)} ke user ID {user_id}")
    else:
        await event.reply("❌ Gagal menambah saldo")

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
    
    msg = "📊 **TOP 20 USERS BY BALANCE**\n\n"
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
        
        cursor.execute('SELECT COUNT(*) FROM transactions')
        total_transactions = cursor.fetchone()[0]
    
    msg = f"""
📊 **INDOTAG MARKET STATISTICS**

👥 **Total Users:** {total_users}
🏷️ **Username Available:** {available}
✅ **Username Sold:** {sold}
🔄 **Total Transactions:** {total_transactions}
"""
    
    await event.reply(msg)

# ==================== MAIN ====================

async def main():
    logger.info("🚀 Starting INDOTAG Market Bot...")
    
    # Initialize database
    db.init_database()
    
    # Start bot
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
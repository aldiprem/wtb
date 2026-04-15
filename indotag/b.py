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

# Coba load .env dari beberapa lokasi
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

# Logging - PERBAIKI TYPO
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
pending_verifications = {}  # {verification_id: data}

def format_price(price: int) -> str:
    return f"{price:,}".replace(",", ".")

def generate_verification_id() -> str:
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

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

Silakan kirimkan **username Telegram** yang ingin dijual.

📝 **Format:** `@username` atau `username`

Contoh: `@johndoe` atau `johndoe`

⚠️ **Catatan:**
• Username akan diverifikasi terlebih dahulu
• Pemilik username harus mengkonfirmasi
• Jika channel, bot harus menjadi admin

━━━━━━━━━━━━━━━━━━━━━
Ketik /cancel untuk membatalkan
"""
    
    await event.edit(msg, buttons=[[Button.inline("❌ Batal", data="main_menu")]])

async def check_entity_type(entity):
    """Cek apakah entity adalah channel atau user"""
    if hasattr(entity, 'broadcast') and entity.broadcast:
        return 'channel', entity.title or entity.username or str(entity.id)
    elif hasattr(entity, 'megagroup') and entity.megagroup:
        return 'supergroup', entity.title or entity.username or str(entity.id)
    elif hasattr(entity, 'group') and entity.group:
        return 'group', entity.title or entity.username or str(entity.id)
    else:
        return 'user', f"{entity.first_name or ''} {entity.last_name or ''}".strip() or entity.username or str(entity.id)

async def send_verification_to_channel(channel_id, verification_id, username_input, seller_id, seller_name, price, description):
    """Kirim verifikasi ke channel"""
    try:
        # Cek apakah bot admin di channel
        try:
            chat = await bot.get_entity(channel_id)
            # Coba kirim pesan untuk cek akses
            test_msg = await bot.send_message(channel_id, "✅ Bot sedang melakukan pengecekan akses...")
            await test_msg.delete()
        except ChatAdminRequiredError:
            return False, "❌ Bot bukan admin di channel ini! Tambahkan bot sebagai admin terlebih dahulu."
        except Exception as e:
            return False, f"❌ Tidak dapat mengakses channel: {str(e)[:100]}"
        
        msg = f"""
🔐 **VERIFIKASI KEPEMILIKAN USERNAME**

Seseorang ingin menjual username **@{username_input}** dengan detail:

👤 **Penjual:** {seller_name} (ID: `{seller_id}`)
💰 **Harga:** Rp {format_price(price)}
📝 **Deskripsi:** {description if description else '-'}

━━━━━━━━━━━━━━━━━━━━━

⚠️ **Apakah Anda pemilik username @{username_input}?**

Jika ya, klik tombol di bawah untuk mengkonfirmasi.
Verifikasi ini diperlukan untuk memastikan kepemilikan username.

━━━━━━━━━━━━━━━━━━━━━
🆔 **ID Verifikasi:** `{verification_id}`
"""
        
        buttons = [[Button.inline("✅ Konfirmasi Kepemilikan", data=f"verify_channel:{verification_id}:{username_input}")]]
        
        await bot.send_message(channel_id, msg, buttons=buttons)
        return True, "✅ Pesan verifikasi telah dikirim ke channel."
        
    except Exception as e:
        return False, f"❌ Gagal mengirim verifikasi: {str(e)[:100]}"

async def send_verification_to_user(user_id, verification_id, username_input, seller_id, seller_name, price, description):
    """Kirim verifikasi ke user (harus start bot dulu)"""
    try:
        # Cek apakah user bisa dihubungi
        try:
            await bot.send_message(user_id, "🔐 **Verifikasi Kepemilikan Username**\n\nSedang memproses verifikasi...")
        except RPCError as e:
            error_msg = str(e).lower()
            if 'user is not acquainted' in error_msg or 'bot was blocked' in error_msg:
                return False, f"❌ Tidak dapat mengirim pesan ke @{username_input}. Pastikan user sudah start bot (klik /start) dan tidak memblokir bot."
            elif 'bot was kicked' in error_msg:
                return False, f"❌ Bot telah dikick oleh @{username_input}."
            else:
                return False, f"❌ Gagal mengirim pesan: {str(e)[:100]}"
        except Exception as e:
            return False, f"❌ Gagal mengirim pesan: {str(e)[:100]}"
        
        msg = f"""
🔐 **VERIFIKASI KEPEMILIKAN USERNAME**

Seseorang ingin menjual username **@{username_input}** dengan detail:

👤 **Penjual:** {seller_name} (ID: `{seller_id}`)
💰 **Harga:** Rp {format_price(price)}
📝 **Deskripsi:** {description if description else '-'}

━━━━━━━━━━━━━━━━━━━━━

⚠️ **Apakah Anda pemilik username @{username_input}?**

Jika ya, klik tombol di bawah untuk mengkonfirmasi.
Verifikasi ini diperlukan untuk memastikan kepemilikan username.

━━━━━━━━━━━━━━━━━━━━━
🆔 **ID Verifikasi:** `{verification_id}`
"""
        
        buttons = [[Button.inline("✅ Konfirmasi Kepemilikan", data=f"verify_user:{verification_id}:{username_input}")]]
        
        await bot.send_message(user_id, msg, buttons=buttons)
        return True, "✅ Pesan verifikasi telah dikirim ke pemilik username."
        
    except Exception as e:
        return False, f"❌ Gagal mengirim verifikasi: {str(e)[:100]}"

@bot.on(events.CallbackQuery(pattern=r"verify_channel:([^:]+):(.+)"))
async def verify_channel_callback(event):
    """Handle verifikasi dari channel"""
    verification_id = event.data_match.group(1)
    username_input = event.data_match.group(2)
    channel_id = event.chat_id
    
    # Cek apakah verifikasi pending
    if verification_id not in pending_verifications:
        await event.answer("❌ Verifikasi sudah kadaluwarsa atau tidak ditemukan!", alert=True)
        return
    
    data = pending_verifications[verification_id]
    
    # Verifikasi bahwa yang klik adalah channel itu sendiri
    if data['target_id'] != channel_id:
        await event.answer("❌ Hanya pemilik channel yang dapat melakukan verifikasi!", alert=True)
        return
    
    # Konfirmasi verifikasi
    await event.answer("✅ Verifikasi berhasil! Username akan ditambahkan ke marketplace.", alert=True)
    
    # Simpan username ke database dengan status available
    success = db.add_username(
        username_input, 
        data['seller_id'], 
        data['price'], 
        data['description']
    )
    
    if success:
        # Update pesan di channel
        await event.edit(f"""
✅ **VERIFIKASI BERHASIL!**

Username **@{username_input}** telah diverifikasi dan berhasil ditambahkan ke marketplace.

📝 **Detail:**
• Penjual: {data['seller_name']} (ID: `{data['seller_id']}`)
• Harga: Rp {format_price(data['price'])}
• Deskripsi: {data['description'] if data['description'] else '-'}

Username sekarang tersedia untuk dijual.
""")
        
        # Kirim notifikasi ke penjual
        try:
            await bot.send_message(
                data['seller_id'],
                f"""
✅ **USERNAME BERHASIL DIVERIFIKASI!**

Username **@{username_input}** telah dikonfirmasi oleh pemiliknya dan berhasil ditambahkan ke marketplace.

📝 **Detail:**
• Harga: Rp {format_price(data['price'])}
• Status: Available

Username sekarang dapat dilihat di menu MY LISTINGS Anda.
"""
            )
        except:
            pass
        
        # Hapus pending verifikasi
        del pending_verifications[verification_id]
        
        # Kirim notifikasi ke admin
        try:
            await bot.send_message(
                OWNER_ID,
                f"""
📢 **USERNAME BARU TERVERTIFIKASI!**

Username: @{username_input}
Penjual: {data['seller_name']} (ID: {data['seller_id']})
Harga: Rp {format_price(data['price'])}
"""
            )
        except:
            pass
    else:
        await event.edit(f"❌ Gagal menambahkan username @{username_input}. Mungkin sudah terdaftar.")

@bot.on(events.CallbackQuery(pattern=r"verify_user:([^:]+):(.+)"))
async def verify_user_callback(event):
    """Handle verifikasi dari user"""
    verification_id = event.data_match.group(1)
    username_input = event.data_match.group(2)
    user_id = event.sender_id
    
    # Cek apakah verifikasi pending
    if verification_id not in pending_verifications:
        await event.answer("❌ Verifikasi sudah kadaluwarsa atau tidak ditemukan!", alert=True)
        return
    
    data = pending_verifications[verification_id]
    
    # Verifikasi bahwa yang klik adalah user yang dimaksud
    if data['target_id'] != user_id:
        await event.answer("❌ Hanya pemilik username yang dapat melakukan verifikasi!", alert=True)
        return
    
    # Konfirmasi verifikasi
    await event.answer("✅ Verifikasi berhasil! Username akan ditambahkan ke marketplace.", alert=True)
    
    # Simpan username ke database dengan status available
    success = db.add_username(
        username_input, 
        data['seller_id'], 
        data['price'], 
        data['description']
    )
    
    if success:
        # Update pesan ke user
        await event.edit(f"""
✅ **VERIFIKASI BERHASIL!**

Username **@{username_input}** telah diverifikasi dan berhasil ditambahkan ke marketplace.

📝 **Detail:**
• Penjual: {data['seller_name']} (ID: `{data['seller_id']}`)
• Harga: Rp {format_price(data['price'])}
• Deskripsi: {data['description'] if data['description'] else '-'}

Username sekarang tersedia untuk dijual.
""")
        
        # Kirim notifikasi ke penjual
        try:
            await bot.send_message(
                data['seller_id'],
                f"""
✅ **USERNAME BERHASIL DIVERIFIKASI!**

Username **@{username_input}** telah dikonfirmasi oleh pemiliknya dan berhasil ditambahkan ke marketplace.

📝 **Detail:**
• Harga: Rp {format_price(data['price'])}
• Status: Available

Username sekarang dapat dilihat di menu MY LISTINGS Anda.
"""
            )
        except:
            pass
        
        # Hapus pending verifikasi
        del pending_verifications[verification_id]
        
        # Kirim notifikasi ke admin
        try:
            await bot.send_message(
                OWNER_ID,
                f"""
📢 **USERNAME BARU TERVERTIFIKASI!**

Username: @{username_input}
Penjual: {data['seller_name']} (ID: {data['seller_id']})
Harga: Rp {format_price(data['price'])}
"""
            )
        except:
            pass
    else:
        await event.edit(f"❌ Gagal menambahkan username @{username_input}. Mungkin sudah terdaftar.")

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
    
    if state.get('step') == 'waiting_username':
        username_input = event.raw_text.strip().lstrip('@')
        
        import re
        if not re.match(r'^[a-zA-Z0-9_]{5,32}$', username_input):
            await event.reply("❌ Format username tidak valid!\n\nUsername hanya boleh berisi huruf, angka, underscore, panjang 5-32 karakter.")
            return
        
        # Cek apakah username adalah channel atau user
        try:
            entity = await bot.get_entity(username_input)
            entity_type, entity_name = await check_entity_type(entity)
            
            if entity_type in ['channel', 'supergroup', 'group']:
                target_id = entity.id
                await event.reply(f"✅ Ditemukan: **{entity_name}** ({entity_type.upper()})")
                
                # Langsung kirim verifikasi tanpa minta harga dulu?
                # Sesuai permintaan: tunggu verifikasi dulu baru input harga
                
                # Simpan data sementara
                user_states[user_id]['username'] = username_input
                user_states[user_id]['target_type'] = 'channel'
                user_states[user_id]['target_id'] = target_id
                user_states[user_id]['target_name'] = entity_name
                user_states[user_id]['step'] = 'waiting_verification'  # Tunggu verifikasi dulu
                
                # Dapatkan info penjual
                seller = await bot.get_entity(user_id)
                seller_name = f"{seller.first_name or ''} {seller.last_name or ''}".strip() or seller.username or str(user_id)
                
                # Generate ID verifikasi
                verification_id = generate_verification_id()
                
                # Simpan pending verifikasi (tanpa harga dulu)
                pending_verifications[verification_id] = {
                    'username': username_input,
                    'seller_id': user_id,
                    'seller_name': seller_name,
                    'price': None,  # Akan diisi setelah verifikasi
                    'description': None,
                    'target_id': target_id,
                    'target_type': 'channel',
                    'created_at': datetime.now().isoformat(),
                    'step': 'waiting_price'  # Setelah verifikasi, minta harga
                }
                
                # Kirim verifikasi ke channel
                success, message = await send_verification_to_channel(
                    target_id, verification_id, username_input, user_id, seller_name, 0, ""
                )
                
                if success:
                    user_states[user_id]['verification_id'] = verification_id
                    await event.reply(f"""
✅ **Permintaan verifikasi telah dikirim ke channel!**

📝 **Username:** @{username_input}
🏷️ **Tipe:** CHANNEL

{message}

⏳ Menunggu konfirmasi dari pemilik channel.
Anda akan diminta memasukkan harga setelah channel mengkonfirmasi.

🆔 **ID Verifikasi:** `{verification_id}`
""")
                else:
                    del user_states[user_id]
                    del pending_verifications[verification_id]
                    await event.reply(f"""
❌ **Gagal mengirim permintaan verifikasi!**

{message}

**Solusi:**
1. Pastikan bot sudah menjadi admin di channel @{username_input}
2. Berikan izin "Post Messages" ke bot
3. Coba lagi dengan mengulangi proses ADD USERNAME

Jika masalah berlanjut, hubungi admin.
""")
                return
                
            else:
                # Ini adalah user
                target_id = entity.id
                await event.reply(f"✅ Ditemukan: **{entity_name}** (USER)")
                
                # Simpan data sementara
                user_states[user_id]['username'] = username_input
                user_states[user_id]['target_type'] = 'user'
                user_states[user_id]['target_id'] = target_id
                user_states[user_id]['target_name'] = entity_name
                user_states[user_id]['step'] = 'waiting_verification'
                
                # Dapatkan info penjual
                seller = await bot.get_entity(user_id)
                seller_name = f"{seller.first_name or ''} {seller.last_name or ''}".strip() or seller.username or str(user_id)
                
                # Generate ID verifikasi
                verification_id = generate_verification_id()
                
                # Simpan pending verifikasi
                pending_verifications[verification_id] = {
                    'username': username_input,
                    'seller_id': user_id,
                    'seller_name': seller_name,
                    'price': None,
                    'description': None,
                    'target_id': target_id,
                    'target_type': 'user',
                    'created_at': datetime.now().isoformat(),
                    'step': 'waiting_price'
                }
                
                # Kirim verifikasi ke user
                success, message = await send_verification_to_user(
                    target_id, verification_id, username_input, user_id, seller_name, 0, ""
                )
                
                if success:
                    user_states[user_id]['verification_id'] = verification_id
                    await event.reply(f"""
✅ **Permintaan verifikasi telah dikirim ke pemilik username!**

📝 **Username:** @{username_input}
🏷️ **Tipe:** USER

{message}

⏳ Menunggu konfirmasi dari @{username_input}.
Anda akan diminta memasukkan harga setelah user mengkonfirmasi.

🆔 **ID Verifikasi:** `{verification_id}`
""")
                else:
                    del user_states[user_id]
                    del pending_verifications[verification_id]
                    await event.reply(f"""
❌ **Gagal mengirim permintaan verifikasi!**

{message}

**Solusi:**
1. Pastikan @{username_input} sudah start bot dengan mengklik /start
2. Pastikan @{username_input} tidak memblokir bot
3. Coba lagi dengan mengulangi proses ADD USERNAME

Jika masalah berlanjut, hubungi admin.
""")
                return
                
        except Exception as e:
            await event.reply(f"❌ Username @{username_input} tidak ditemukan!\n\nError: {str(e)[:100]}")
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
🏷️ **Tipe:** {user_states[user_id]['target_type'].upper()}
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
        
        # Update pending verifikasi dengan harga dan deskripsi
        verification_id = user_states[user_id].get('verification_id')
        if verification_id and verification_id in pending_verifications:
            pending_verifications[verification_id]['price'] = user_states[user_id]['price']
            pending_verifications[verification_id]['description'] = description
        
        # Clear state
        del user_states[user_id]
        
        await event.reply(f"""
✅ **Data harga dan deskripsi telah disimpan!**

📝 **Username:** @{user_states[user_id]['username']}
💰 **Harga:** Rp {format_price(user_states[user_id]['price'])}
📝 **Deskripsi:** {description if description else '-'}

⏳ Menunggu konfirmasi dari pemilik username.
Anda akan menerima notifikasi setelah diverifikasi.
""")
        
        # Kembali ke menu utama
        msg_menu, buttons = await main_menu(user_id, "")
        await event.respond(msg_menu, buttons=buttons)
    
    elif state.get('step') == 'waiting_verification':
        # User sedang menunggu verifikasi, beri info
        await event.reply("""
⏳ **Menunggu Verifikasi**

Permintaan verifikasi sedang dalam proses.
Anda akan menerima notifikasi setelah pemilik username mengkonfirmasi.

Gunakan menu lain atau tunggu sebentar.
""")

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
        status_text = "Available" if u['status'] == 'available' else "Terjual"
        msg += f"\n{i}. {status_icon} **@{u['username']}**\n"
        msg += f"   💰 Rp {format_price(u['price'])}\n"
        msg += f"   📊 Status: {status_text}\n"
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
    
    usernames = db.get_my_usernames(user_id)
    total_listings = len(usernames)
    available_listings = len([u for u in usernames if u['status'] == 'available'])
    sold_listings = len([u for u in usernames if u['status'] == 'sold'])
    
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
📦 **Statistik Listing:**
• Total Listing: {total_listings}
• Tersedia: {available_listings}
• Terjual: {sold_listings}

━━━━━━━━━━━━━━━━━━━━━
📌 **Fitur:**
• Jual username Telegram (dengan verifikasi)
• Lihat daftar username sendiri
• Hapus listing yang belum terjual

"""
    
    buttons = [[Button.inline("🔙 Kembali", data="main_menu")]]
    
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

@bot.on(events.NewMessage(pattern="^/pending$"))
async def admin_list_pending(event):
    if event.sender_id != OWNER_ID:
        return
    
    if not pending_verifications:
        await event.reply("Tidak ada verifikasi pending.")
        return
    
    msg = "⏳ **PENDING VERIFICATIONS**\n\n"
    for vid, data in pending_verifications.items():
        msg += f"🆔 ID: `{vid}`\n"
        msg += f"📝 Username: @{data['username']}\n"
        msg += f"👤 Penjual: {data['seller_name']}\n"
        msg += f"💰 Harga: {format_price(data['price']) if data['price'] else 'Belum diisi'}\n"
        msg += f"🏷️ Target: {data['target_type']} (ID: {data['target_id']})\n"
        msg += f"📅 Dibuat: {data['created_at']}\n\n"
    
    await event.reply(msg)

# ==================== MAIN ====================

async def main():
    logger.info("🚀 Starting INDOTAG Market Bot...")
    
    db.init_database()
    
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
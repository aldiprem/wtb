from telethon import TelegramClient, events
import asyncio
from datetime import datetime
from loguru import logger
import re

from config import *
from database import init_db
from ai import AIEngine  # Ini sudah pakai Cloudflare AI

# Inisialisasi
logger.add("wtb_bot.log", rotation="10 MB")
init_db()
ai = AIEngine()  # TANPA PARAMETER API KEY! (karena pakai env)

# Database pesan yang sudah diproses
processed_wtb = set()
processed_messages = set()

class WTBBot:
    def __init__(self):
        self.client = TelegramClient('wtb_session', API_ID, API_HASH)
        self.channels_to_watch = []  # Channel WTB yang dipantau
        self.bot_id = None  # Akan diisi setelah start
        self.owner_id = OWNER_ID
    
    async def start(self):
        """Mulai bot"""
        await self.client.start(phone=PHONE_NUMBER)
        me = await self.client.get_me()
        self.bot_id = me.id
        logger.info(f"✅ Bot started as {me.first_name} (ID: {self.bot_id})")
        logger.info(f"👤 Owner ID: {self.owner_id}")
        logger.info(f"🤖 Menggunakan Cloudflare AI dengan model: {CLOUDFLARE_MODEL}")
        
        # SATU HANDLER UNTUK SEMUA PESAN!
        @self.client.on(events.NewMessage)
        async def handle_all_messages(event):
            await self.process_message(event)
        
        logger.info("🎯 Bot SIAP dengan 3 mode:")
        logger.info("   - OWNER → Mode MENGAJAR (semua disimpan)")
        logger.info("   - BOT → IGNORE (tidak respon diri sendiri)")
        logger.info("   - BUYER → Mode MENJAWAB (di channel WTB)")
        
        await self.send_startup_message()
        await self.client.run_until_disconnected()
    
    async def send_startup_message(self):
        """Kirim pesan siap ke OWNER"""
        await self.client.send_message(self.owner_id, 
            "🤖 **Bot AI Siap dengan Cloudflare!**\n\n"
            "✅ **Mode 1: OWNER (ANDA)**\n"
            "   • Semua chat Anda akan DISIMPAN ke otak\n"
            "   • Tidak perlu perintah khusus\n"
            "   • Contoh: 'saya jual diamond ML 86=21k, 172=42k'\n\n"
            "✅ **Mode 2: BOT (DIRI SENDIRI)**\n"
            "   • Otomatis IGNORE (tidak respon)\n\n"
            "✅ **Mode 3: BUYER (CHANNEL WTB)**\n"
            "   • Jawab pertanyaan sesuai memori\n"
            "   • Tidak OOT\n\n"
            "📝 **Perintah:**\n"
            "   • 'pantau channel @nama' → Tambah channel WTB\n"
            "   • 'lihat memori' → Lihat yang sudah diajar"
        )
    
    async def process_message(self, event):
        """PROSES SEMUA PESAN dengan 3 aturan utama"""
        message = event.message
        
        # CEK 1: Pesan valid?
        if not message or not message.text:
            return
        
        # CEK 2: Dapatkan info pengirim
        sender = await event.get_sender()
        sender_id = sender.id
        chat = await event.get_chat()
        chat_id = chat.id
        
        # CEK 3: Apakah ini pesan dari BOT SENDIRI?
        if sender_id == self.bot_id:
            logger.debug(f"🚫 Ignore: Pesan dari bot sendiri")
            return
        
        # CEK 4: Cegah duplikasi
        message_key = f"{chat_id}_{message.id}"
        if message_key in processed_messages:
            return
        processed_messages.add(message_key)
        
        # ========================================
        # ATURAN 1: OWNER MODE (MENGAJAR)
        # ========================================
        if sender_id == self.owner_id:
            logger.info(f"👑 OWNER: {message.text[:50]}...")
            
            # Perintah khusus
            if message.text.startswith('pantau channel'):
                channel = message.text.split('@')[-1].strip()
                if channel:
                    channel_full = f'@{channel}'
                    if channel_full not in self.channels_to_watch:
                        self.channels_to_watch.append(channel_full)
                        await message.reply(f"✅ Sekarang saya akan pantau {channel_full}")
                        logger.info(f"📡 Tambah channel: {channel_full}")
                    else:
                        await message.reply(f"✅ {channel_full} sudah dipantau")
                return
            
            elif message.text.lower() == 'lihat memori':
                from database import Session, Memory
                session = Session()
                memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(10).all()
                if memories:
                    reply = "📚 **Memori yang diajarkan:**\n\n"
                    for i, m in enumerate(memories, 1):
                        preview = m.content[:100].replace('\n', ' ')
                        reply += f"{i}. {preview}...\n"
                    await message.reply(reply)
                else:
                    await message.reply("📭 Belum ada memori. Ajari saya!")
                session.close()
                return
            
            # Selain perintah, SEMUA PESAN OWNER DISIMPAN
            response = ai.process_user_message(message.text, is_owner=True)
            await message.reply(response)
            return
        
        # ========================================
        # ATURAN 2: BOT MODE (SUDAH DI CEK - IGNORE)
        # ========================================
        
        # ========================================
        # ATURAN 3: BUYER MODE (HANYA DI CHANNEL WTB)
        # ========================================
        # Cek apakah ini dari channel yang dipantau
        is_wtb_channel = False
        if hasattr(chat, 'username') and chat.username:
            channel_with_at = f"@{chat.username}"
            if channel_with_at in self.channels_to_watch:
                is_wtb_channel = True
        
        if is_wtb_channel:
            logger.info(f"🛒 BUYER di {channel_with_at}: {message.text[:50]}...")
            
            # Cegah duplikasi WTB
            if message.id in processed_wtb:
                return
            processed_wtb.add(message.id)
            
            # Tanya AI: Harus respon?
            decision = ai.should_respond_to_wtb(message.text, channel_with_at)
            
            if decision.get("should_respond"):
                response_text = ai.generate_response(
                    message.text,
                    decision["product"],
                    channel_with_at
                )
                
                # Kirim ke COMSET
                try:
                    await message.reply(response_text)
                    logger.success(f"✅ Respon buyer: {response_text[:50]}...")
                except Exception as e:
                    logger.error(f"Gagal kirim: {e}")
            else:
                logger.info(f"🤐 Tidak respon: {decision.get('reason', 'Tidak cocok')}")
            
            return
        
        # ========================================
        # PESAN LAINNYA - IGNORE
        # ========================================
        logger.debug(f"🚫 Ignore: Pesan dari {sender_id} di chat {chat_id}")

async def main():
    bot = WTBBot()
    await bot.start()

if __name__ == "__main__":
    asyncio.run(main())

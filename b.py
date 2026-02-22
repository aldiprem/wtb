from telethon import TelegramClient, events
import asyncio
from datetime import datetime
from loguru import logger
import re

from config import *
from database import init_db, Memory
from ai import AIEngine

# Inisialisasi
logger.add("wtb_bot.log", rotation="10 MB")
init_db()
ai = AIEngine()

# Database pesan yang sudah diproses
processed_messages = set()
processed_wtb = set()

class WTBBot:
    def __init__(self):
        self.client = TelegramClient('wtb_session', API_ID, API_HASH)
        self.channels_to_watch = []
        self.bot_id = None
        self.owner_id = OWNER_ID
    
    async def start(self):
        await self.client.start(phone=PHONE_NUMBER)
        me = await self.client.get_me()
        self.bot_id = me.id
        
        logger.info(f"✅ Bot started as {me.first_name} (ID: {self.bot_id})")
        logger.info(f"👤 Owner ID: {self.owner_id}")
        logger.info(f"🤖 Model: {CLOUDFLARE_MODEL}")
        
        @self.client.on(events.NewMessage)
        async def handle_all_messages(event):
            await self.process_message(event)
        
        logger.info("🎯 Mode:")
        logger.info("   • OWNER → SEMUA DISIMPAN")
        logger.info("   • BUYER → DIJAWAB dari memori")
        logger.info("   • BOT → IGNORE")
        
        await self.send_startup_message()
        await self.client.run_until_disconnected()
    
    async def send_startup_message(self):
        await self.client.send_message(self.owner_id,
            "🤖 **Bot AI Upgrade!**\n\n"
            "📌 **OWNER MODE:**\n"
            "• Semua chat Anda akan DISIMPAN\n"
            "• Produk, harga, jam, pembayaran, dll\n\n"
            "📌 **BUYER MODE:**\n"
            "• Jawab pertanyaan dari memori\n"
            "• Bisa tanya produk, harga, jam, dll\n\n"
            "📌 **Perintah:**\n"
            "• `pantau channel @nama` - Tambah channel\n"
            "• `lihat memori` - Lihat yang sudah diajar"
        )
    
    async def process_message(self, event):
        message = event.message
        if not message or not message.text:
            return
        
        sender = await event.get_sender()
        sender_id = sender.id
        chat = await event.get_chat()
        chat_id = chat.id
        
        # CEK 1: Pesan dari bot sendiri?
        if sender_id == self.bot_id:
            return
        
        # CEK 2: Duplikasi?
        msg_key = f"{chat_id}_{message.id}"
        if msg_key in processed_messages:
            return
        processed_messages.add(msg_key)
        
        # ========== OWNER MODE ==========
        if sender_id == self.owner_id:
            logger.info(f"👑 OWNER: {message.text[:50]}...")
            
            # Perintah khusus
            if message.text.startswith('pantau channel'):
                channel = message.text.split('@')[-1].strip()
                if channel:
                    ch = f'@{channel}'
                    if ch not in self.channels_to_watch:
                        self.channels_to_watch.append(ch)
                        await message.reply(f"✅ Sekarang pantau {ch}")
                    else:
                        await message.reply(f"✅ {ch} sudah dipantau")
                return
            
            elif message.text.lower() == 'lihat memori':
                memories = Memory.get_all(10)
                if memories:
                    reply = "📚 **Memori yang diajarkan:**\n\n"
                    for i, m in enumerate(memories, 1):
                        # PERBAIKAN: Gunakan .get() dengan default value
                        cat = m.get('category', 'general')
                        content = m.get('content', '')
                        preview = content[:100].replace('\n', ' ')
                        reply += f"{i}. [{cat}] {preview}...\n"
                    await message.reply(reply)
                else:
                    await message.reply("📭 Belum ada memori")
                return
            
            # Selain perintah: SEMUA DISIMPAN
            response = ai.process_owner_message(message.text)
            await message.reply(response)
            return
        
        # ========== BOT MODE ========== (sudah dicek di atas)
        
        # ========== BUYER MODE ==========
        # Kalau dari channel, cek apakah channel dipantau
        if hasattr(chat, 'username') and chat.username:
            channel_with_at = f"@{chat.username}"
            if channel_with_at in self.channels_to_watch:
                # Ini WTB di channel
                if message.id in processed_wtb:
                    return
                processed_wtb.add(message.id)
                
                logger.info(f"🛒 WTB di {channel_with_at}: {message.text[:50]}...")
                
                decision = ai.should_respond_to_wtb(message.text, channel_with_at)
                
                if decision.get("should_respond"):
                    resp = ai.generate_response(message.text, decision.get("product", ""), channel_with_at)
                    try:
                        await message.reply(resp)
                        logger.success(f"✅ Respon WTB: {resp[:50]}...")
                    except Exception as e:
                        logger.error(f"Gagal kirim: {e}")
                else:
                    logger.info(f"🤐 Tidak respon WTB: {decision.get('reason', 'Tidak cocok')}")
                return
            
            # Kalau channel tapi bukan dipantau, ignore
            if getattr(chat, 'type', '') == 'channel':
                return
        
        # BUYER di chat pribadi
        logger.info(f"💬 BUYER {sender_id}: {message.text[:50]}...")
        response = ai.process_buyer_message(message.text, sender_id, "private")
        await message.reply(response)

async def main():
    bot = WTBBot()
    await bot.start()

if __name__ == "__main__":
    asyncio.run(main())

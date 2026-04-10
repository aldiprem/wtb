import os
import asyncio
import random
import string
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telethon import TelegramClient, events
import sys
import logging

# Logging seperti fragment_bot.py
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Load environment dari path yang sama seperti fragment_bot.py
from pathlib import Path
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configuration
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_GIVEAWAY", "")

# Add parent directory to path for database import
sys.path.append('/root/wtb')
from giveaway.database.giveaway import GiveawayDatabase

db = GiveawayDatabase()

# ==================== INI YANG PALING PENTING ====================
# Gunakan nama session yang BERBEDA dan UNIK
# SAMA PERSIS seperti fragment_bot.py yang pakai 'master_bot_session'
bot = TelegramClient('giveaway_bot_session', API_ID, API_HASH)

def generate_giveaway_id():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

@bot.on(events.NewMessage(pattern='/start'))
async def start_command(event):
    welcome_text = """
🎁 **Welcome to Giveaway Bot!** 🎁

**Commands:**
/newgiveaway - Create a new giveaway
/join - Join active giveaway
/mygiveaways - Check your active giveaways
/endgiveaway - End giveaway early
"""
    await event.reply(welcome_text)

@bot.on(events.NewMessage(pattern='/join'))
async def join_giveaway(event):
    active_giveaways_list = db.get_active_giveaways()
    
    if not active_giveaways_list:
        await event.reply("❌ No active giveaways!")
        return
    
    current_giveaway = None
    for giveaway in active_giveaways_list:
        if giveaway['chat_id'] == event.chat_id:
            current_giveaway = giveaway
            break
    
    if not current_giveaway:
        await event.reply("❌ No active giveaway in this chat!")
        return
    
    username = event.sender.username or ""
    first_name = event.sender.first_name or ""
    
    if db.add_participant(current_giveaway['giveaway_id'], event.sender_id, username, first_name):
        participants_count = len(db.get_participants(current_giveaway['giveaway_id']))
        await event.reply(f"✅ Joined! Participants: {participants_count}")
    else:
        await event.reply("⚠️ Already joined!")

@bot.on(events.NewMessage(pattern='/newgiveaway'))
async def new_giveaway_command(event):
    try:
        await event.reply("📝 Send prize description:")
        
        @bot.on(events.NewMessage(chats=event.chat_id))
        async def get_prize(prize_event):
            if prize_event.sender_id == event.sender_id:
                prize = prize_event.text
                await prize_event.reply("👥 How many winners?")
                
                @bot.on(events.NewMessage(chats=event.chat_id))
                async def get_winners(winners_event):
                    if winners_event.sender_id == event.sender_id:
                        try:
                            winners_count = int(winners_event.text)
                        except:
                            winners_count = 1
                        
                        await winners_event.reply("⏰ Duration in minutes:")
                        
                        @bot.on(events.NewMessage(chats=event.chat_id))
                        async def get_duration(duration_event):
                            if duration_event.sender_id == event.sender_id:
                                try:
                                    minutes = int(duration_event.text)
                                    end_time = datetime.now() + timedelta(minutes=minutes)
                                except:
                                    end_time = datetime.now() + timedelta(hours=24)
                                    minutes = 1440
                                
                                giveaway_id = generate_giveaway_id()
                                
                                msg = await event.reply(f"""
🎉 NEW GIVEAWAY 🎉

Prize: {prize}
Winners: {winners_count}
Duration: {minutes} minutes
Ends at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}

Send /join to participate!
""")
                                
                                db.create_giveaway(giveaway_id, event.chat_id, msg.id, prize, winners_count, end_time.isoformat())
                                await event.reply(f"✅ Giveaway created! ID: {giveaway_id}")
                                
                                bot.remove_event_handler(get_prize)
                                bot.remove_event_handler(get_winners)
                                bot.remove_event_handler(get_duration)
                                raise StopAsyncIteration
                        
                        bot.remove_event_handler(get_duration)
                
                bot.remove_event_handler(get_winners)
        
        bot.remove_event_handler(get_prize)
    except StopAsyncIteration:
        pass

@bot.on(events.NewMessage(pattern='/endgiveaway'))
async def end_giveaway_command(event):
    active_giveaways_list = db.get_active_giveaways()
    
    for giveaway in active_giveaways_list:
        if giveaway['chat_id'] == event.chat_id:
            winners = db.select_winners(giveaway['giveaway_id'], giveaway['winners_count'])
            if winners:
                await event.reply(f"🏆 Winners selected! {winners}")
            else:
                await event.reply("❌ No participants!")
            return
    
    await event.reply("❌ No active giveaway!")

@bot.on(events.NewMessage(pattern='/mygiveaways'))
async def my_giveaways(event):
    active_giveaways_list = db.get_active_giveaways()
    user_giveaways = []
    
    for giveaway in active_giveaways_list:
        participants = db.get_participants(giveaway['giveaway_id'])
        if any(p['user_id'] == event.sender_id for p in participants):
            user_giveaways.append(giveaway)
    
    if not user_giveaways:
        await event.reply("📭 No active entries!")
        return
    
    message = "🎁 Your Active Giveaways:\n\n"
    for i, giveaway in enumerate(user_giveaways, 1):
        participants = db.get_participants(giveaway['giveaway_id'])
        message += f"{i}. {giveaway['prize']} - {len(participants)} participants\n"
    
    await event.reply(message)

async def check_expired_giveaways():
    while True:
        try:
            expired_giveaways = db.end_expired_giveaways()
            for giveaway in expired_giveaways:
                winners = db.select_winners(giveaway['giveaway_id'], giveaway['winners_count'])
                if winners:
                    await bot.send_message(giveaway['chat_id'], f"🏆 Giveaway ended! Winners: {winners}")
        except Exception as e:
            logger.error(f"Error checking expired giveaways: {e}")
        await asyncio.sleep(60)

# ==================== MAIN - SAMA PERSIS SEPERTI fragment_bot.py ====================
async def main():
    logger.info("🚀 Starting Giveaway Bot...")
    
    # Initialize database
    db.init_database()
    
    # Start master bot - SAMA PERSIS CARANYA
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ Giveaway Bot is running")
    
    # Start checking for expired giveaways
    asyncio.create_task(check_expired_giveaways())
    
    await bot.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Giveaway Bot dihentikan")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")
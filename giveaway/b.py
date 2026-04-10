import os
import asyncio
import random
import string
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.tl.types import MessageEntityMentionName
import sys

# Add parent directory to path for database import
sys.path.append('/root/wtb')
from giveaway.database.giveaway import GiveawayDatabase

# Load environment variables
load_dotenv('/root/wtb/.env')

# Configuration
API_ID = int(os.getenv('API_ID'))
API_HASH = os.getenv('API_HASH')
BOT_TOKEN = os.getenv('GIVEAWAY_TOKEN')

# Initialize bot and database
bot = TelegramClient('giveaway_bot', API_ID, API_HASH).start(bot_token=BOT_TOKEN)
db = GiveawayDatabase()

# Store active giveaway messages for editing
active_giveaways = {}

def generate_giveaway_id():
    """Generate unique giveaway ID"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

async def update_giveaway_message(giveaway_id: str):
    """Update giveaway message with current stats"""
    giveaway = db.get_giveaway(giveaway_id)
    if not giveaway:
        return
    
    participants = db.get_participants(giveaway_id)
    end_time = datetime.fromisoformat(giveaway['end_time'].replace('Z', '+00:00'))
    time_left = end_time - datetime.now(end_time.tzinfo)
    
    message_text = f"""
🎉 **GIVEAWAY** 🎉

**Prize:** {giveaway['prize']}
**Winners:** {giveaway['winners_count']}
**Participants:** {len(participants)}
**Ends in:** {time_left.days}d {time_left.seconds//3600}h {(time_left.seconds//60)%60}m

**How to join:**
Click /join command in this group to participate!

Good luck everyone! 🍀
"""
    
    try:
        await bot.edit_message(giveaway['chat_id'], giveaway['message_id'], message_text)
    except Exception as e:
        print(f"Error updating message: {e}")

@bot.on(events.NewMessage(pattern='/start'))
async def start_command(event):
    """Handle /start command"""
    welcome_text = """
🎁 **Welcome to Giveaway Bot!** 🎁

**Commands:**
/newgiveaway - Create a new giveaway (Admin only)
/join - Join active giveaway
/mygiveaways - Check your active giveaways
/endgiveaway - End giveaway early (Admin only)

**How it works:**
1. Admin creates a giveaway with prize and duration
2. Users join using /join command
3. Winners are selected randomly when giveaway ends
4. Winners get notified automatically

Made with ❤️ for Telegram
"""
    await event.reply(welcome_text)

@bot.on(events.NewMessage(pattern='/newgiveaway'))
async def new_giveaway_command(event):
    """Create new giveaway (admin only)"""
    # Check if user is admin (you can modify this check)
    # For now, allow all users, but you can add admin check
    
    # In a real bot, you should check if user is admin of the group
    # This is a simple implementation
    
    try:
        # Ask for prize
        await event.reply("📝 **Send the prize description:**\n(Example: 1 month Telegram Premium)")
        
        @bot.on(events.NewMessage(chats=event.chat_id))
        async def get_prize(prize_event):
            if prize_event.sender_id == event.sender_id:
                prize = prize_event.text
                
                # Ask for winners count
                await prize_event.reply("👥 **How many winners?**\n(Enter a number, default: 1)")
                
                @bot.on(events.NewMessage(chats=event.chat_id))
                async def get_winners(winners_event):
                    if winners_event.sender_id == event.sender_id:
                        try:
                            winners_count = int(winners_event.text)
                        except:
                            winners_count = 1
                        
                        # Ask for duration
                        await winners_event.reply("⏰ **Giveaway duration:**\nEnter in minutes (example: 60 for 1 hour)")
                        
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
                                
                                # Create initial message
                                message_text = f"""
🎉 **NEW GIVEAWAY** 🎉

**Prize:** {prize}
**Winners:** {winners_count}
**Duration:** {minutes} minutes
**Ends at:** {end_time.strftime('%Y-%m-%d %H:%M:%S')}

**How to join:**
Type /join in this group to participate!

Good luck! 🍀
"""
                                
                                msg = await event.reply(message_text)
                                
                                # Save to database
                                db.create_giveaway(
                                    giveaway_id,
                                    event.chat_id,
                                    msg.id,
                                    prize,
                                    winners_count,
                                    end_time.isoformat()
                                )
                                
                                await event.reply(f"✅ **Giveaway created successfully!**\nID: `{giveaway_id}`")
                                
                                # Remove temporary handlers
                                [bot.remove_event_handler(handler) for handler in [get_prize, get_winners, get_duration]]
                                
                                # Schedule end check
                                asyncio.create_task(schedule_giveaway_end(giveaway_id, end_time))
                                
                                # Break the chain
                                raise StopAsyncIteration
                        
                        # Remove handler after getting duration
                        bot.remove_event_handler(get_duration)
                
                # Remove handler after getting winners
                bot.remove_event_handler(get_winners)
        
        # Remove handler after getting prize
        bot.remove_event_handler(get_prize)
        
    except StopAsyncIteration:
        pass

@bot.on(events.NewMessage(pattern='/join'))
async def join_giveaway(event):
    """Join active giveaway"""
    active_giveaways_list = db.get_active_giveaways()
    
    if not active_giveaways_list:
        await event.reply("❌ **No active giveaways at the moment!**")
        return
    
    # Check if there's a giveaway in current chat
    current_giveaway = None
    for giveaway in active_giveaways_list:
        if giveaway['chat_id'] == event.chat_id:
            current_giveaway = giveaway
            break
    
    if not current_giveaway:
        await event.reply("❌ **No active giveaway in this chat!**")
        return
    
    # Add participant
    username = event.sender.username or ""
    first_name = event.sender.first_name or ""
    
    if db.add_participant(current_giveaway['giveaway_id'], event.sender_id, username, first_name):
        participants_count = len(db.get_participants(current_giveaway['giveaway_id']))
        await event.reply(f"✅ **You've joined the giveaway!**\n\nTotal participants: {participants_count}\n\nGood luck! 🍀")
        
        # Update giveaway message
        await update_giveaway_message(current_giveaway['giveaway_id'])
    else:
        await event.reply("⚠️ **You're already participating in this giveaway!**")

@bot.on(events.NewMessage(pattern='/mygiveaways'))
async def my_giveaways(event):
    """Show user's active giveaways"""
    active_giveaways_list = db.get_active_giveaways()
    user_giveaways = []
    
    for giveaway in active_giveaways_list:
        participants = db.get_participants(giveaway['giveaway_id'])
        if any(p['user_id'] == event.sender_id for p in participants):
            user_giveaways.append(giveaway)
    
    if not user_giveaways:
        await event.reply("📭 **You haven't joined any active giveaways!**")
        return
    
    message = "🎁 **Your Active Giveaways:**\n\n"
    for i, giveaway in enumerate(user_giveaways, 1):
        participants = db.get_participants(giveaway['giveaway_id'])
        end_time = datetime.fromisoformat(giveaway['end_time'].replace('Z', '+00:00'))
        time_left = end_time - datetime.now(end_time.tzinfo)
        
        message += f"{i}. **{giveaway['prize']}**\n"
        message += f"   Participants: {len(participants)}\n"
        message += f"   Ends in: {time_left.days}d {time_left.seconds//3600}h\n\n"
    
    await event.reply(message)

@bot.on(events.NewMessage(pattern='/endgiveaway'))
async def end_giveaway_command(event):
    """End giveaway early (admin only)"""
    active_giveaways_list = db.get_active_giveaways()
    
    if not active_giveaways_list:
        await event.reply("❌ **No active giveaways to end!**")
        return
    
    current_giveaway = None
    for giveaway in active_giveaways_list:
        if giveaway['chat_id'] == event.chat_id:
            current_giveaway = giveaway
            break
    
    if not current_giveaway:
        await event.reply("❌ **No active giveaway in this chat!**")
        return
    
    await process_giveaway_end(current_giveaway['giveaway_id'], manual=True)
    await event.reply("✅ **Giveaway ended and winners selected!**")

async def process_giveaway_end(giveaway_id: str, manual: bool = False):
    """Process giveaway end and select winners"""
    giveaway = db.get_giveaway(giveaway_id)
    if not giveaway or giveaway['status'] != 'active':
        return
    
    # Select winners
    winners = db.select_winners(giveaway_id, giveaway['winners_count'])
    
    if winners:
        # Get winner details
        winner_mentions = []
        for winner_id in winners:
            try:
                user = await bot.get_entity(winner_id)
                winner_mentions.append(f"[{user.first_name}](tg://user?id={winner_id})")
            except:
                winner_mentions.append(f"User {winner_id}")
        
        # Announce winners
        winner_text = f"""
🏆 **GIVEAWAY ENDED** 🏆

**Prize:** {giveaway['prize']}

**Winner(s):**
{chr(10).join(f'🎉 {mention}' for mention in winner_mentions)}

Congratulations to the winner(s)! 🎊

Please contact the admin to claim your prize.
"""
        
        await bot.send_message(giveaway['chat_id'], winner_text, parse_mode='markdown')
        
        # Notify winners privately
        for winner_id in winners:
            try:
                await bot.send_message(
                    winner_id,
                    f"🏆 **Congratulations! You won the giveaway!**\n\n"
                    f"**Prize:** {giveaway['prize']}\n"
                    f"**Giveaway ID:** `{giveaway_id}`\n\n"
                    f"Please contact the group admin to claim your prize.",
                    parse_mode='markdown'
                )
            except:
                pass
    else:
        await bot.send_message(
            giveaway['chat_id'],
            f"❌ **Giveaway ended but no participants joined!**\n\nPrize: {giveaway['prize']}"
        )

async def schedule_giveaway_end(giveaway_id: str, end_time: datetime):
    """Schedule giveaway end"""
    now = datetime.now(end_time.tzinfo)
    wait_time = (end_time - now).total_seconds()
    
    if wait_time > 0:
        await asyncio.sleep(wait_time)
        await process_giveaway_end(giveaway_id)

async def check_expired_giveaways():
    """Periodically check for expired giveaways"""
    while True:
        try:
            expired_giveaways = db.end_expired_giveaways()
            for giveaway in expired_giveaways:
                await process_giveaway_end(giveaway['giveaway_id'])
        except Exception as e:
            print(f"Error checking expired giveaways: {e}")
        
        await asyncio.sleep(60)

async def main():
    client = TelegramClient('giveaway_bot', API_ID, API_HASH)
    
    # Start with bot token
    await client.start(bot_token=BOT_TOKEN)
    
    print("✅ Bot connected!")
    print(f"Bot ID: {await client.get_me()}")
    
    await client.disconnected()

if __name__ == "__main__":
    asyncio.run(main())
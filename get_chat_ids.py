#!/usr/bin/env python3
"""
Run this script to find the correct Telegram chat IDs of users who messaged your bot.
Usage: TELEGRAM_BOT_TOKEN=<your_token> python3 get_chat_ids.py
"""
import os
import urllib.request
import json

token = os.getenv("TELEGRAM_BOT_TOKEN")
if not token:
    print("ERROR: Set TELEGRAM_BOT_TOKEN environment variable first.")
    exit(1)

url = f"https://api.telegram.org/bot{token}/getUpdates"
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read())

if not data.get("ok"):
    print("Error:", data)
    exit(1)

results = data.get("result", [])
if not results:
    print("No messages found. Make sure the new user has sent a message to the bot first.")
    exit(0)

print("\n=== Users who have messaged your bot ===\n")
seen = set()
for update in results:
    msg = update.get("message") or update.get("channel_post")
    if not msg:
        continue
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    if chat_id in seen:
        continue
    seen.add(chat_id)
    name = chat.get("first_name", "") + " " + chat.get("last_name", "")
    username = chat.get("username", "N/A")
    chat_type = chat.get("type", "")
    print(f"  Name     : {name.strip()}")
    print(f"  Username : @{username}")
    print(f"  Chat ID  : {chat_id}   <-- use this as TELEGRAM_CHAT_ID_2")
    print(f"  Type     : {chat_type}")
    print()

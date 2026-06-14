import re
import os
import sys
import urllib.request
import urllib.parse
from playwright.sync_api import sync_playwright

def send_telegram_message(message):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        print("Telegram notification skipped: Environment variables not set.")
        return

    print(f"Sending Telegram notification: {message}")
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}).encode("utf-8")
        with urllib.request.urlopen(url, data=data) as response:
            if response.status == 200:
                print("Telegram message sent successfully!")
            else:
                print(f"Failed to send Telegram message. Status: {response.status}")
    except Exception as e:
        print(f"Error sending Telegram message: {e}")

def check_gold_price():
    targets = [
        {
            "name": "Tanishq Product Page",
            "url": "https://www.tanishq.co.in/product/1-gram-24-karat-gold-coin-with-lakshmi-motif-600105zgbraw00.html?lang=en_IN"
        },
        {
            "name": "Joyalukkas Home",
            "url": "https://www.joyalukkas.in/"
        },
        {
            "name": "Malabar Gold Coins",
            "url": "https://www.malabargoldanddiamonds.com/gold-coins.html"
        },
        {
            "name": "CaratLane Gold Coins",
            "url": "https://www.caratlane.com/gold-coins.html"
        },
        {
            "name": "GoodReturns Gold Rates India",
            "url": "https://www.goodreturns.in/gold-rates/"
        }
    ]
    
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            viewport={"width": 1920, "height": 1080},
            locale="en-US,en;q=0.9",
            timezone_id="Asia/Kolkata"
        )
        page = context.new_page()
        
        for target in targets:
            name = target["name"]
            url = target["url"]
            print(f"\n--- Testing {name} at {url} ---")
            try:
                response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(3000)
                print(f"Status: {response.status if response else 'No response'}")
                print(f"Final URL: {page.url}")
                print(f"Title: {page.title()}")
                
                content = page.content()
                if "Attention Required" in content or "cf-challenge" in content or "security service" in content:
                    print("Block check: Detected Cloudflare / Bot Protection block page.")
                else:
                    print("Block check: No block page detected.")
                    # Print some preview of content to see if we can find price info
                    # e.g., search for numbers or price selectors
                    print("Searching for currency patterns...")
                    matches = re.findall(r'(?:₹|Rs\.?)\s*([\d,]+)', content)
                    print(f"Found matches: {matches[:10]}")
            except Exception as e:
                print(f"Error loading {name}: {e}")
                
        browser.close()

if __name__ == "__main__":
    check_gold_price()

import re
import os
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from pymongo import MongoClient


def send_telegram_message(message):
    primary_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not primary_token:
        print("Telegram notification skipped: TELEGRAM_BOT_TOKEN not set.")
        return

    recipients = [
        (primary_token, os.getenv("TELEGRAM_CHAT_ID")),
        (os.getenv("TELEGRAM_BOT_TOKEN_2") or primary_token, os.getenv("TELEGRAM_CHAT_ID_2")),
    ]
    recipients = [(tok, cid) for tok, cid in recipients if cid]

    if not recipients:
        print("Telegram notification skipped: No chat IDs configured.")
        return

    for token, chat_id in recipients:
        print(f"Sending Telegram notification to {chat_id}...")
        try:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            data = urllib.parse.urlencode({"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}).encode("utf-8")
            with urllib.request.urlopen(url, data=data) as response:
                if response.status == 200:
                    print(f"Telegram message sent successfully to {chat_id}!")
                else:
                    print(f"Failed to send Telegram message to {chat_id}. Status: {response.status}")
        except Exception as e:
            print(f"Error sending Telegram message to {chat_id}: {e}")


def save_to_mongodb(brand, rate):
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("MongoDB save skipped: MONGODB_URI not set.")
        return
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client["gold_prices"]
        collection = db["rates"]
        now = datetime.now(timezone.utc)
        doc = {
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "ingested_at": now.isoformat(),
            "rate": rate,
            "brand": brand
        }
        collection.insert_one(doc)
        print(f"MongoDB: saved {brand} rate ₹{rate}")
        client.close()
    except Exception as e:
        print(f"MongoDB save failed: {e}")


def scrape_with_playwright(p, url, wait_after_load=5000):
    browser = p.firefox.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        viewport={"width": 1920, "height": 1080},
        locale="en-US,en;q=0.9",
        timezone_id="Asia/Kolkata"
    )
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(wait_after_load)
    return page, browser


def check_joyalukkas_gold_rate():
    url = "https://www.joyalukkas.in/goldrate"
    print(f"Checking Joyalukkas online gold rate at: {url}")

    with sync_playwright() as p:
        page, browser = None, None
        try:
            page, browser = scrape_with_playwright(p, url, 8000)

            content = page.content()
            if "Attention Required" in content or "cf-challenge" in content or "security service" in content.lower():
                print("DETECTED: Cloudflare blocked Joyalukkas.")
                page.screenshot(path="gold_debug_screenshot.png")
                return None

            page.wait_for_timeout(3000)
            online_btn = page.locator("span:has-text(\"Online Store Rate\")").first
            if online_btn.count() == 0:
                page.wait_for_timeout(5000)
                online_btn = page.locator("span:has-text(\"Online Store Rate\")").first
                if online_btn.count() == 0:
                    page.screenshot(path="gold_debug_screenshot.png")
                    print("Could not find Online Store Rate button")
                    return None

            online_btn.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            online_btn.click()
            page.wait_for_timeout(3000)

            body_text = page.inner_text("body")
            match = re.search(r'GOLD\s*24KT\s*RATE\s*₹([\d,]+)', body_text)
            if match:
                rate = int(match.group(1).replace(',', ''))
                print(f"Joyalukkas 24KT online rate: ₹{rate}")
                save_to_mongodb("Joyalukkas", rate)
                return rate

            print("Could not find 24KT rate text on Joyalukkas")
            return None

        except Exception as e:
            print(f"Error scraping Joyalukkas: {e}")
            return None
        finally:
            if browser:
                browser.close()


if __name__ == "__main__":
    joyalukkas_rate = check_joyalukkas_gold_rate()

    joyalukkas_url = "https://www.joyalukkas.in/goldrate"

    if joyalukkas_rate:
        formatted_rate = f"{joyalukkas_rate:,}"
        msg = (
            f"🪙 *Gold Price Update*\n\n"
            f"🏪 *Joyalukkas (24KT Online Rate)*\n"
            f"*Price:* ₹{formatted_rate}\n"
            f"🔗 [View Rates]({joyalukkas_url})"
        )
    else:
        msg = (
            f"🪙 *Gold Price Update*\n\n"
            f"🏪 *Joyalukkas (24KT Online Rate)*\n*Price:* Not found"
        )

    send_telegram_message(msg)

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
    url = "https://www.tanishq.co.in/product/1-gram-24-karat-gold-coin-with-lakshmi-motif-600105zgbraw00.html?lang=en_IN"
    print(f"Checking Tanishq gold coin price at: {url}")
    
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
            viewport={"width": 1920, "height": 1080},
            locale="en-US,en;q=0.9",
            timezone_id="Asia/Kolkata"
        )
        page = context.new_page()
        
        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)  # Wait for dynamic elements (price updates via API)
            
            # Check for Cloudflare/blocking
            content = page.content()
            if "Attention Required" in content or "cf-challenge" in content or "security service" in content:
                print("DETECTED: Cloudflare Bot Protection blocked the request.")
                page.screenshot(path="gold_debug_screenshot.png")
                send_telegram_message("⚠️ GOLD SCRAPER BLOCKED: Cloudflare hit a challenge on Tanishq.")
                return

            title = page.title().replace(" | Tanishq", "").strip()
            if not title:
                title = "1 gram 24 Karat Gold Coin with Lakshmi Motif"
                
            price = None
            
            # Strategy 1: Look for pdp-product-main-sale-price
            sale_el = page.locator(".pdp-product-main-sale-price").first
            if sale_el.count() > 0:
                text = sale_el.inner_text().strip()
                digits = re.sub(r'[^\d]', '', text)
                if digits:
                    price = int(digits)
                    print(f"Strategy 1 (pdp-product-main-sale-price) succeeded: ₹{price}")

            # Strategy 2: Look for evgProductPrice content attribute
            if not price:
                evg_el = page.locator(".evgProductPrice").first
                if evg_el.count() > 0:
                    content_attr = evg_el.get_attribute("content")
                    if content_attr:
                        digits = re.sub(r'[^\d]', '', content_attr)
                        if digits:
                            price = int(digits)
                            print(f"Strategy 2 (evgProductPrice) succeeded: ₹{price}")

            # Strategy 3: Regex match on general page text
            if not price:
                # Find occurrences of ₹ or Rs. followed by digits and select the one that matches our expected range (e.g. 10000-25000)
                matches = re.findall(r'(?:₹|Rs\.?)\s*([\d,]+)', content)
                for match in matches:
                    clean_val = match.replace(',', '')
                    try:
                        val = int(clean_val)
                        # A 1-gram gold coin should typically be between ₹5,000 and ₹25,000
                        if 5000 <= val <= 25000:
                            price = val
                            print(f"Strategy 3 (Regex search) succeeded: ₹{price}")
                            break
                    except ValueError:
                        continue
            
            if price:
                formatted_price = f"{price:,}"
                msg = (
                    f"🪙 *Gold Coin Price Update* 🪙\n\n"
                    f"*Product:* {title}\n"
                    f"*Current Price:* ₹{formatted_price}\n\n"
                    f"🔗 [View Product]({url})"
                )
                send_telegram_message(msg)
            else:
                print("Could not detect the price info.")
                page.screenshot(path="gold_debug_screenshot.png")
                send_telegram_message("⚠️ GOLD SCRAPER ERROR: Could not find price data. The page layout might have changed.")
                
        except Exception as e:
            error_msg = f"❌ GOLD SCRAPER CRASHED: {str(e)}"
            print(error_msg)
            try:
                page.screenshot(path="gold_debug_screenshot.png")
            except:
                pass
            send_telegram_message(error_msg)
        finally:
            browser.close()

if __name__ == "__main__":
    check_gold_price()

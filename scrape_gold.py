import re
import os
import sys
import urllib.request
import urllib.parse
from playwright.sync_api import sync_playwright

def send_telegram_message(message):
    primary_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not primary_token:
        print("Telegram notification skipped: TELEGRAM_BOT_TOKEN not set.")
        return

    # Each entry: (bot_token, chat_id)
    recipients = [
        (primary_token, os.getenv("TELEGRAM_CHAT_ID")),
        (os.getenv("TELEGRAM_BOT_TOKEN_2") or primary_token, os.getenv("TELEGRAM_CHAT_ID_2")),
    ]
    # Filter out entries with no chat_id
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
                page.screenshot(path="joy_debug_screenshot.png")
                return None

            page.wait_for_timeout(3000)
            online_btn = page.locator("span:has-text(\"Online Store Rate\")").first
            if online_btn.count() == 0:
                page.wait_for_timeout(5000)
                online_btn = page.locator("span:has-text(\"Online Store Rate\")").first
                if online_btn.count() == 0:
                    page.screenshot(path="joy_debug_screenshot.png")
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
                return rate

            print("Could not find 24KT rate text on Joyalukkas")
            return None

        except Exception as e:
            print(f"Error scraping Joyalukkas: {e}")
            return None
        finally:
            if browser:
                browser.close()


def check_gold_price():
    tanishq_url = "https://www.tanishq.co.in/product/1-gram-24-karat-gold-coin-with-lakshmi-motif-600105zgbraw00.html?lang=en_IN"
    joyalukkas_url = "https://www.joyalukkas.in/goldrate"
    print(f"Checking Tanishq gold coin price at: {tanishq_url}")

    tanishq_price = None
    tanishq_title = "1 gram 24 Karat Gold Coin with Lakshmi Motif"

    with sync_playwright() as p:
        page, browser = None, None
        try:
            page, browser = scrape_with_playwright(p, tanishq_url, 5000)

            content = page.content()
            if "Attention Required" in content or "cf-challenge" in content or "security service" in content:
                print("DETECTED: Cloudflare Bot Protection blocked the request.")
                page.screenshot(path="gold_debug_screenshot.png")
                send_telegram_message("⚠️ GOLD SCRAPER BLOCKED: Cloudflare hit a challenge on Tanishq.")
                return

            title = page.title().replace(" | Tanishq", "").strip()
            if title:
                tanishq_title = title

            price = None

            sale_el = page.locator(".pdp-product-main-sale-price").first
            if sale_el.count() > 0:
                text = sale_el.inner_text().strip()
                digits = re.sub(r'[^\d]', '', text)
                if digits:
                    price = int(digits)
                    print(f"Strategy 1 (pdp-product-main-sale-price) succeeded: ₹{price}")

            if not price:
                evg_el = page.locator(".evgProductPrice").first
                if evg_el.count() > 0:
                    content_attr = evg_el.get_attribute("content")
                    if content_attr:
                        digits = re.sub(r'[^\d]', '', content_attr)
                        if digits:
                            price = int(digits)
                            print(f"Strategy 2 (evgProductPrice) succeeded: ₹{price}")

            if not price:
                matches = re.findall(r'(?:₹|Rs\.?)\s*([\d,]+)', content)
                for match in matches:
                    clean_val = match.replace(',', '')
                    try:
                        val = int(clean_val)
                        if 5000 <= val <= 25000:
                            price = val
                            print(f"Strategy 3 (Regex search) succeeded: ₹{price}")
                            break
                    except ValueError:
                        continue

            tanishq_price = price

        except Exception as e:
            error_msg = f"❌ TANISHQ SCRAPER CRASHED: {str(e)}"
            print(error_msg)
            try:
                page.screenshot(path="gold_debug_screenshot.png")
            except:
                pass
            send_telegram_message(error_msg)
            return
        finally:
            if browser:
                browser.close()

    joyalukkas_rate = check_joyalukkas_gold_rate()

    msg_parts = []
    if tanishq_price:
        formatted_price = f"{tanishq_price:,}"
        msg_parts.append(
            f"🏪 *Tanishq (1g Coin)*\n"
            f"*Price:* ₹{formatted_price}\n"
            f"🔗 [View Product]({tanishq_url})"
        )
    else:
        msg_parts.append("🏪 *Tanishq (1g Coin)*\n*Price:* Not found")

    if joyalukkas_rate:
        formatted_rate = f"{joyalukkas_rate:,}"
        msg_parts.append(
            f"🏪 *Joyalukkas (24KT Online Rate)*\n"
            f"*Price:* ₹{formatted_rate}\n"
            f"🔗 [View Rates]({joyalukkas_url})"
        )
    else:
        msg_parts.append("🏪 *Joyalukkas (24KT Online Rate)*\n*Price:* Not found")

    msg = f"🪙 *Gold Price Update* 🪙\n\n" + "\n\n".join(msg_parts)
    send_telegram_message(msg)

if __name__ == "__main__":
    check_gold_price()

#!/usr/bin/env python3
"""Entra al mundo y captura la vista en primera persona."""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8899/index.html?v=3&lowfx=1"

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"])
    page = browser.new_page(viewport={"width": 960, "height": 540})
    page.set_default_timeout(150000)
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[PAGEERROR] {e}"))
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector("#loading-screen.hidden", state="attached")
    time.sleep(1)
    # clic vía JS (robusto aunque el frame loop esté ocupado)
    page.evaluate("document.getElementById('btn-start').click()")
    time.sleep(8)
    page.screenshot(path="dev/shot_game.png")
    # mirar al horizonte / mover un poco la cámara
    page.evaluate("""() => {
      // simular que el jugador mira al frente
      window.dispatchEvent(new Event('resize'));
    }""")
    time.sleep(4)
    page.screenshot(path="dev/shot_game2.png")
    browser.close()

print("==== LOGS ====")
for l in logs:
    if "GroupMarker" in l or "GL Driver" in l: continue
    print(l)
print("==== DONE ====")

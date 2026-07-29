#!/usr/bin/env python3
"""Captura pantalla del juego y recolecta los logs de diagnóstico."""
import sys, time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8899/index.html?v=3"

with sync_playwright() as p:
    browser = p.chromium.launch(args=[
        "--enable-unsafe-swiftshader",
        "--use-gl=angle", "--use-angle=swiftshader",
    ])
    page = browser.new_page(viewport={"width": 960, "height": 540})
    page.set_default_timeout(120000)
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[PAGEERROR] {e}"))
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    # esperar a que la pantalla de carga termine (máx 150 s)
    try:
        page.wait_for_selector("#loading-screen.hidden", state="attached", timeout=150000)
    except Exception:
        logs.append("[WARN] loading screen no desapareció a tiempo")
    time.sleep(2)
    page.screenshot(path="dev/shot_title.png", timeout=120000)
    # pulsar comenzar para entrar al mundo en primera persona
    try:
        page.click("#btn-start", timeout=8000)
        time.sleep(6)
        page.screenshot(path="dev/shot_game.png", timeout=120000)
        time.sleep(2)
        page.screenshot(path="dev/shot_game2.png", timeout=120000)
    except Exception as e:
        logs.append(f"[WARN] no se pudo pulsar start: {e}")
    browser.close()

print("==== LOGS ====")
for l in logs:
    if "GroupMarkerNotSet" in l or "GL Driver" in l:
        continue
    print(l)
print("==== DONE ====")

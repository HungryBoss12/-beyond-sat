import json, time

REPORT = []
BASE = "http://localhost:8081"

def log(section, data):
    entry = {"section": section, **data}
    REPORT.append(entry)
    print(json.dumps(entry))

def wait(sec=2):
    time.sleep(sec)

def body_text():
    return js("document.body.innerText || ''") or ""

def rgb_is_dark(rgb):
    if not rgb or not rgb.startswith("rgb"):
        return False
    try:
        nums = [int(x) for x in rgb.replace("rgba(", "rgb(").replace("rgb(", "").replace(")", "").split(",")[:3]]
        lum = 0.2126 * nums[0] + 0.7152 * nums[1] + 0.0722 * nums[2]
        return lum < 128
    except Exception:
        return False

def rgb_is_light(rgb):
    if not rgb or not rgb.startswith("rgb"):
        return False
    try:
        nums = [int(x) for x in rgb.replace("rgba(", "rgb(").replace("rgb(", "").replace(")", "").split(",")[:3]]
        lum = 0.2126 * nums[0] + 0.7152 * nums[1] + 0.0722 * nums[2]
        return lum > 180
    except Exception:
        return False

def nav(path):
    js(f"window.location.assign('{BASE}{path}')")
    wait_for_load()
    wait(2.5)

# 0) ensure real tab
ensure_real_tab()
info = page_info()
log("start", {"url": info.get("url"), "title": info.get("title")})

# 1) Vocab hub
nav("/vocab")
hub = js("""
(() => {
  const srs = document.querySelector('a[href="/vocab/decks"]');
  const dueBanner = /\\d+ cards? due/i.test(document.body.innerText);
  const studyNow = /Study now/i.test(document.body.innerText);
  const dueBadges = document.body.innerText.match(/\\d+ due/g) || [];
  const h1 = document.querySelector('h1');
  return {
    path: location.pathname,
    dueBanner,
    studyNow,
    dueBadges,
    srsHref: srs?.getAttribute('href') ?? null,
    h1: h1?.innerText ?? null,
    h1Color: h1 ? getComputedStyle(h1).color : null,
  };
})()
""")
log("hub", hub)

# 2) Deck picker
nav("/vocab/decks")
decks = js("""
(() => {
  const cards = [...document.querySelectorAll('a[href*="/vocab/deck/"]')];
  const h1 = document.querySelector('h1');
  return {
    path: location.pathname,
    deckCount: cards.length,
    decks: cards.map(a => ({
      href: a.getAttribute('href'),
      text: a.innerText.trim().slice(0, 120),
    })),
    h1Color: h1 ? getComputedStyle(h1).color : null,
    hasAppShell: /Dashboard/.test(document.body.innerText),
  };
})()
""")
log("decks", decks)

deck_href = None
if isinstance(decks, dict) and decks.get("decks"):
    deck_href = decks["decks"][0].get("href")

# 3) Redirect /vocab/deck
nav("/vocab/deck")
redirect = {"path": js("location.pathname"), "title": page_info().get("title")}
log("redirect", {"ok": redirect["path"] in ("/vocab/decks", "/vocab/deck/"), **redirect})

# 4) Deck player
if deck_href:
    nav(deck_href)
else:
    nav("/vocab/deck/00000000-0000-4000-8000-000000000001")

# wait for player content
loaded = False
for i in range(10):
    wait(1)
    t = body_text()
    if len(t) > 80 and ("Tap or press Space" in t or "No cards due" in t or "Loading" not in t[:40]):
        loaded = True
        break

player = js("""
(() => {
  const h1 = document.querySelector('main h1');
  const back = document.querySelector('header a');
  const pos = document.querySelector('main .uppercase, .uppercase');
  const counter = document.querySelector('header .tabular-nums');
  const c = el => el ? getComputedStyle(el).color : null;
  return {
    path: location.pathname,
    loadedText: document.body.innerText.slice(0, 500),
    word: h1?.innerText ?? null,
    h1Color: c(h1),
    backText: back?.innerText ?? null,
    backColor: c(back),
    posColor: c(pos),
    counter: counter?.innerText ?? null,
    hasVocabSurface: !!document.querySelector('.vocab-surface'),
    bgNavy: !!document.querySelector('.bg-\\[\\#0b0761\\]'),
  };
})()
""")
log("player_front", player)

issues = []
if player.get("path", "").count("/vocab/deck/") == 0:
    issues.append("deck player route did not load")
if player.get("word") and rgb_is_dark(player.get("h1Color")):
    issues.append("word h1 is dark on navy background")
if player.get("backColor") and rgb_is_dark(player.get("backColor")):
    issues.append("back link is dark on navy background")

# flip + rating colors + optimistic
if player.get("word") and "No cards due" not in (player.get("loadedText") or ""):
    js("document.querySelector('[role=button]')?.click()")
    wait(1)
    rating = js("""
    (() => [...document.querySelectorAll('footer button')].map(b => ({
      label: b.innerText.split('\\n')[0],
      color: getComputedStyle(b).color,
      intervalColor: b.querySelector('span:last-child') ? getComputedStyle(b.querySelector('span:last-child')).color : null,
    })))()
    """)
    log("player_rating", {"buttons": rating})
    for b in (rating or []):
        if rgb_is_dark(b.get("color")):
            issues.append(f"rating button '{b.get('label')}' label is dark")

    w0 = player.get("word")
    c0 = player.get("counter")
    t0 = time.time()
    js("(() => { const b=[...document.querySelectorAll('footer button')].find(x=>x.innerText.includes('Good')); b?.click(); })()")
    wait(0.35)
    w1 = js("document.querySelector('main h1')?.innerText")
    c1 = js("document.querySelector('header .tabular-nums')?.innerText")
    elapsed_ms = int((time.time() - t0) * 1000)
    log("optimistic", {"before_word": w0, "after_word": w1, "before_counter": c0, "after_counter": c1, "elapsed_ms": elapsed_ms, "advanced": w0 != w1 or c0 != c1})
    if elapsed_ms > 800 and not (w0 != w1 or c0 != c1):
        issues.append("rating did not advance quickly (optimistic UI may be broken)")

    # try to reach session results
    for _ in range(8):
        if "Session complete" in body_text():
            break
        js("document.querySelector('[role=button]')?.click()")
        wait(0.35)
        js("(() => { const b=[...document.querySelectorAll('footer button')].find(x=>x.innerText.includes('Good')); b?.click(); })()")
        wait(0.45)

    results = js("""
    (() => {
      const done = document.body.innerText.includes('Session complete');
      const h1 = document.querySelector('h1');
      const links = [...document.querySelectorAll('a')].filter(a => /Back to decks|Study more|practice test/i.test(a.innerText)).map(a => ({
        text: a.innerText.trim(),
        color: getComputedStyle(a).color,
        href: a.getAttribute('href'),
      }));
      return {done, h1: h1?.innerText, h1Color: h1 ? getComputedStyle(h1).color : null, links};
    })()
    """)
    log("session_results", results)
    if not results.get("done"):
        issues.append("session results screen not reached after reviews")
    else:
        for l in (results.get("links") or []):
            if rgb_is_dark(l.get("color")):
                issues.append(f"results link '{l.get('text')}' is dark on navy")

# 5) Dashboard banner
nav("/dashboard")
wait(1)
js("window.scrollTo(0, 700)")
wait(1)
dash = js("""
(() => ({
  dueBanner: /\\d+ cards? due/i.test(document.body.innerText),
  studyNow: /Study now/i.test(document.body.innerText),
  vocabPanel: /Anki-style SRS/i.test(document.body.innerText),
  dueLine: (document.body.innerText.match(/\\d+ cards due now/i) || []),
}))()
""")
log("dashboard", dash)

# 6) Quiz results footer (if quiz exists)
nav("/vocab/tests")
wait(1)
quiz_href = js("(() => { const a = document.querySelector('a[href*=\"/vocab/tests/\"]'); return a ? a.getAttribute('href') : null; })()")
log("quiz_list", {"quiz_href": quiz_href})

# 7) console/network errors on vocab session API (fetch from page context if possible)
nav("/vocab/decks")
api_probe = js("""
(async () => {
  try {
    const r = await fetch('/api/vocab/session?deckId=00000000-0000-4000-8000-000000000001');
    const j = await r.json();
    return {status: r.status, cards: (j.cards||[]).length, error: j.error || null};
  } catch (e) {
    return {error: String(e)};
  }
})()
""")
wait(2)
log("api_session", api_probe if isinstance(api_probe, dict) else {"raw": str(api_probe)})

log("issues", {"count": len(issues), "items": issues})
print("QA_REPORT_END")

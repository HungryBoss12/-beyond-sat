import json, time
new_tab("http://localhost:8080/vocab")
wait_for_load(); time.sleep(3)
print("INFO", json.dumps(page_info()))
print("HUB", json.dumps(js("(()=>({path:location.pathname,text:document.body.innerText.slice(0,1000),dueBanner:/\\d+ cards? due/i.test(document.body.innerText),badges:(document.body.innerText.match(/\\d+ due/g)||[])}))()")))

js("window.location.assign('http://localhost:8080/vocab/decks')"); wait_for_load(); time.sleep(2)
print("DECKS", json.dumps(js("(()=>({path:location.pathname,decks:[...document.querySelectorAll('a[href*=\\\"/vocab/deck/\\\"]')].map(a=>({h:a.getAttribute('href'),t:a.innerText.slice(0,80)}))}))()")))

js("window.location.assign('http://localhost:8080/vocab/deck/00000000-0000-4000-8000-000000000001')"); wait_for_load()
for i in range(8):
    time.sleep(1)
    t = js("document.body.innerText") or ""
    if "Tap or press Space" in t or "No cards due" in t: break
print("PLAYER", json.dumps(js("(()=>{const h1=document.querySelector('main h1');const back=document.querySelector('header a');const c=e=>e?getComputedStyle(e).color:null;return{path:location.pathname,word:h1?.innerText,h1c:c(h1),backc:c(back),text:(document.body.innerText||'').slice(0,300)};})()")))

if js("document.querySelector('main h1')?.innerText"):
    js("document.querySelector('[role=button]')?.click()"); time.sleep(0.8)
    print("RATING", json.dumps(js("(()=>[...document.querySelectorAll('footer button')].map(b=>({l:b.innerText.split('\\n')[0],c:getComputedStyle(b).color})) )()")))
    w0 = js("document.querySelector('main h1')?.innerText")
    js("(()=>{const b=[...document.querySelectorAll('footer button')].find(x=>x.innerText.includes('Good'));b?.click()})()")
    time.sleep(0.35)
    w1 = js("document.querySelector('main h1')?.innerText")
    print("OPT", json.dumps({"w0":w0,"w1":w1,"fast":w0!=w1}))

js("window.location.assign('http://localhost:8080/vocab/deck')"); wait_for_load(); time.sleep(1.5)
print("REDIR", js("location.pathname"))

print("DONE")

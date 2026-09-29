#!/usr/bin/env python3
"""Builds docs/submit-1.1-runbook.html from the store copy and IAP docs.

usage: python3 docs/tools/build_runbook_page.py BUILD_NUMBER EAS_ID COMMIT
Every paste value comes from docs/store-listing.md and docs/m5-asc-iap-setup.md,
so the page never drifts from the docs.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
build, eas_id, commit = (sys.argv[1:4] + ["?", "?", "?"])[:3]
listing = (ROOT / "docs/store-listing.md").read_text(encoding="utf-8")
iapdoc = (ROOT / "docs/m5-asc-iap-setup.md").read_text(encoding="utf-8")


def block(after: str, text: str) -> str:
    i = text.index(after)
    m = re.search(r"```\n(.*?)```", text[i:], re.S)
    return m.group(1).rstrip("\n")


def cell(label: str) -> str:
    m = re.search(r"\| \*\*" + re.escape(label) + r"\*\* \| `(.*?)` \|", listing)
    return m.group(1)


whats_new = listing[listing.index('## Version 1.1 "What'):]
values = {
    "wn_en": block("**English:**", whats_new),
    "wn_es": block("**Español:**", whats_new),
    "desc_en": block("**Description (EN):**", listing),
    "desc_es": block("**Descripción (ES):**", listing),
    "promo_en": cell("Promotional text"),
    "promo_es": cell("Texto promocional"),
    "note": re.search(r"## Apple Guideline 4\.2[^\n]*\n> (.*?)\n", listing, re.S).group(1),
    "privacy_url": "https://playcapi.com/privacy",
    "support_url": "https://playcapi.com/support",
    "marketing_url": "https://playcapi.com",
}

refs = {}
for m in re.finditer(r"^\| \d \| (.*?) \| `(capi\.[a-z_.]+)` \| ([\d.]+) \|$", iapdoc, re.M):
    refs[m.group(2)] = (m.group(1), m.group(3))
iaps = []
for m in re.finditer(r"^\| `(capi\.[a-z_.]+)` \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", iapdoc, re.M):
    pid = m.group(1)
    ref, usd = refs[pid]
    iaps.append({"id": pid, "ref": ref, "usd": usd, "en_name": m.group(2), "en_desc": m.group(3),
                 "es_name": m.group(4), "es_desc": m.group(5), "shot": f"store-assets/iap/{pid}.png"})
assert len(iaps) == 8, len(iaps)
for k, v in values.items():
    assert v and chr(0x2014) not in v, k

E = html.escape


def copy(label: str, value: str, big: bool = False) -> str:
    cls = "val big" if big else "val"
    return (f'<div class="copyrow"><span class="clabel">{E(label)}</span>'
            f'<div class="{cls}"><pre>{E(value)}</pre>'
            f'<button type="button" class="cbtn" data-copy="{E(value)}">Copy</button></div></div>')


def path(p: str) -> str:
    return f'<p class="where">{E(p)}</p>'


iap_rows = "".join(
    f"<tr><td><code>{E(i['id'])}</code> <button type='button' class='mini' data-copy='{E(i['id'])}'>Copy</button></td>"
    f"<td>{E(i['ref'])} <button type='button' class='mini' data-copy='{E(i['ref'])}'>Copy</button></td>"
    f"<td class='num'>{E(i['usd'])}</td>"
    f"<td>{E(i['en_name'])} <button type='button' class='mini' data-copy='{E(i['en_name'])}'>Copy</button><br><span class='sub'>{E(i['en_desc'])}</span> <button type='button' class='mini' data-copy='{E(i['en_desc'])}'>Copy</button></td>"
    f"<td>{E(i['es_name'])} <button type='button' class='mini' data-copy='{E(i['es_name'])}'>Copy</button><br><span class='sub'>{E(i['es_desc'])}</span> <button type='button' class='mini' data-copy='{E(i['es_desc'])}'>Copy</button></td>"
    f"<td><code>{E(i['shot'])}</code></td></tr>"
    for i in iaps)

privacy = [
    ("Identifiers > Device ID", "Ads & analytics", "Yes", "Yes"),
    ("Usage Data > Product Interaction", "Ads & analytics, App Functionality", "Yes", "No"),
    ("Usage Data > Advertising Data", "Ads & analytics", "Yes", "No"),
    ("Location > Coarse Location", "Ads & analytics, App Functionality", "Yes", "No"),
    ("Diagnostics > Crash Data", "Analytics, App Functionality", "No", "No"),
    ("Diagnostics > Performance Data", "Ads & analytics, App Functionality", "No", "No"),
    ("Diagnostics > Other Diagnostic Data", "Ads & analytics, App Functionality", "No", "No"),
]
privacy_rows = "".join(f"<tr><td>{E(a)}</td><td>{E(b)}</td><td>{E(c)}</td><td>{E(d)}</td></tr>" for a, b, c, d in privacy)

# (part, id, title, body html, done-when)
steps = [
    ("before", "build", "Check the build", path("App Store Connect > Apps > Capi > TestFlight > iOS Builds > 1.1.0")
     + f"<p>Build <strong>{E(build)}</strong> shows as processed: not Processing, not Invalid Binary. Search your developer email for <q>ITMS</q> and <q>Missing API declaration</q> about build {E(build)}. Any hit: stop and send it to Claude.</p>",
     "Build processed, no ITMS email."),
    ("before", "admob", "Set the ad rating in AdMob", path("AdMob > Apps > Capi (iOS) > Blocking controls > Ad content rating")
     + "<p>Turn off <q>Match account-level setting</q>, choose <strong>G</strong>, Save. Then Privacy &amp; messaging: a published GDPR message must exist for Capi, or players in the EU and UK get no ads.</p>",
     "Rating G saved; a GDPR message is published."),
    ("before", "version", "Check the 1.1.0 version record", path("App Store Connect > Apps > Capi, sidebar under iOS App")
     + "<p>1.1.0 is listed. If not: (+) next to iOS App, type 1.1.0, Create.</p>", "1.1.0 appears in the sidebar."),
    ("before", "iaps", "Create the 8 purchases", path("Monetization > In-App Purchases > (+) > Non-Consumable")
     + "<p>Enter the Reference Name and Product ID, Create. On each product page: Availability &gt; all countries &gt; Save. Price Schedule &gt; Add Pricing &gt; USD price &gt; Next &gt; Confirm. App Store Localization &gt; English (U.S.) and Spanish (Mexico) &gt; Save. Review Information &gt; Screenshot &gt; the file in the last column &gt; Save.</p>"
     + f'<div class="tablewrap"><table><thead><tr><th>Product ID</th><th>Reference name</th><th class="num">USD</th><th>English (U.S.)</th><th>Spanish (Mexico)</th><th>Screenshot</th></tr></thead><tbody>{iap_rows}</tbody></table></div>',
     "All 8 say Ready to Submit; none says Missing Metadata."),
    ("before", "buy", "Buy and restore on your iPhone", path("TestFlight > Capi > install 1.1.0 (" + build + ")")
     + "<p>Open the store: all 8 rows show a real price, not <q>Ver precio</q>. Buy Mesa Quisqueya (TestFlight does not charge): it unlocks and can be selected. Delete the app, reinstall it from TestFlight, tap Restore Purchases: Quisqueya comes back. Any failure: stop and send Claude a screenshot.</p>",
     "Purchase unlocks; restore brings it back."),
    ("before", "reviewer", "Walk the reviewer's path", path("Messages > a conversation with yourself > (+) > Capi")
     + "<p>Tap the name field, type a name, Start a game, Send, then tap the bubble. In Safari open playcapi.com, tap <strong>Unirse</strong>, enter the code and a name. Back in Messages play a tile: the drawer gets small and a <q>Your turn, &lt;name&gt;</q> bubble waits to be sent. <q>Back to the table</q> brings the table back.</p>",
     "The table starts, and the turn bubble appears."),
    ("before", "attach", "Attach the purchases to 1.1.0", path("Version page > In-App Purchases and Subscriptions > Select")
     + "<p>Check all 8, Done, then Save at the top right.</p>", "The 8 purchases are listed on the version page."),
    ("before", "privacy", "Fill in App Privacy, then Publish", path("App Privacy > Edit")
     + "<p>Keep Name, Gameplay Content and Customer Support. Add the types below. <em>Ads &amp; analytics</em> means Third-Party Advertising, Developer's Advertising or Marketing, and Analytics.</p>"
     + f'<div class="tablewrap"><table><thead><tr><th>Data type</th><th>Purposes</th><th>Linked</th><th>Tracking</th></tr></thead><tbody>{privacy_rows}</tbody></table></div>'
     + copy("Privacy Policy URL", values["privacy_url"])
     + "<p class='warn'>Press <strong>Publish</strong> at the top of the App Privacy page. Without it the store keeps the 1.0 label.</p>",
     "The App Privacy page shows the new label as published."),
    ("before", "age", "Update the age rating", path("App Information > Age Ratings > Edit")
     + "<p>Advertising: Yes. Messaging and Chat: Yes. Everything else unchanged. Save.</p>", "The rating stays 4+."),
    ("before", "text", "Paste the version text, English and Spanish", path("Version page > locale menu at the top: English (U.S.), then Spanish (Mexico)")
     + copy("What's New, English", values["wn_en"], True) + copy("What's New, Spanish", values["wn_es"], True)
     + copy("Description, English", values["desc_en"], True) + copy("Description, Spanish", values["desc_es"], True)
     + copy("Promotional Text, English (optional)", values["promo_en"]) + copy("Promotional Text, Spanish (optional)", values["promo_es"])
     + copy("Support URL", values["support_url"]) + copy("Marketing URL", values["marketing_url"])
     + "<p>Keywords stay as they are. Save.</p>", "Both locales saved."),
    ("before", "review", "Fill in App Review Information", path("Version page > App Review Information")
     + "<p>Sign-in required: off. Contact: your name, phone and email.</p>" + copy("Notes", values["note"], True) + "<p>Save.</p>",
     "Notes saved (3969 of 4000 bytes)."),
    ("before", "select", f"Select build {build}", path("Version page > Build > (+)")
     + f"<p>Choose 1.1.0 ({E(build)}), Done, Save. No export compliance question should appear.</p>", f"Build {build} is attached."),
    ("before", "shots", "Upload the iMessage screenshots", path("Version page > iMessage App (appears after the build is attached) > 6.5-inch display")
     + "<p>From <code>apps/mobile/store-assets/screenshots/imessage</code>, in this order: <code>03-table.png</code>, <code>04-your-turn-bubble.png</code>, <code>02-invite-bubble.png</code>, <code>01-create-card.png</code>. Save. Screenshots lock when you submit.</p>",
     "Four screenshots in the iMessage App section."),
    ("before", "release", "Choose manual release", path("Version page > Version Release")
     + "<p>Manually release this version. Save.</p>", "Manual release selected."),
    ("before", "submit", "Submit for review", path("Version page > Add for Review (top right)")
     + "<p>Open the draft (App Review &gt; Submissions): it lists iOS App 1.1.0 and the 8 in-app purchases. Press <strong>Submit for Review</strong>.</p>",
     "Status: Waiting for Review."),
    ("during", "freeze", "Keep the web steady", "<p>Deploy to playcapi.com only changes Claude has checked inside the Messages drawer, and no API contract changes. Do not run migration 005 during review.</p>", ""),
    ("during", "reject", "If Apple rejects", "<p>Paste Apple's message to Claude. Fixes usually turn around the same day.</p>", ""),
    ("any", "vercel", "Move Vercel to Pro", path("Vercel > the capi project > Settings > Billing")
     + "<p>Hobby is for non-commercial use, and 1.1 has ads and purchases. In Supabase, check the plan, database size and Realtime usage.</p>", ""),
    ("any", "sentry", "Fix web error reporting", path("sentry.io > Settings > Projects > (Next.js project) > Client Keys (DSN)")
     + "<p>Error reports from playcapi.com are rejected today. Check that the project and its key are active, copy the DSN, set <code>NEXT_PUBLIC_SENTRY_DSN</code> and <code>SENTRY_DSN</code> in Vercel (Production), redeploy, and tell Claude.</p>", ""),
    ("any", "m004", "Run migration 004", "<p>Supabase SQL Editor: run <code>supabase/migrations/004_realtime_publication.sql</code>. It is safe to run twice.</p>", ""),
    ("after", "go", "Release 1.1", "<p>After approval, press Release on the version page.</p>", ""),
    ("after", "admoblink", "Link AdMob to the store listing", path("AdMob > Apps > Capi > App settings") + "<p>Link the app to its App Store listing.</p>", ""),
    ("after", "m005", "Lock direct database writes", "<p>In this order: Vercel &gt; Settings &gt; Environment Variables &gt; <code>SUPABASE_SERVICE_ROLE_KEY</code> (Production, the secret key from Supabase &gt; Project Settings &gt; API Keys), Save, Redeploy. Then run <code>supabase/migrations/005_lock_direct_writes.sql</code>. Then create a game in one browser, join from another, play a move and reload: the move stays. If not, follow checklist step B5.3.</p>", ""),
    ("after", "next", "Plan 1.1.1", "<p>Tell Claude. The next build takes the roadmap in <code>docs/polish-pass-1.1-2026-09-26.md</code>.</p>", ""),
]
parts = [("before", "Before you submit", "In this order. Each step ends with how you know it worked."),
         ("during", "While Apple reviews", "One to three days."),
         ("any", "Any time", "Not a gate for the submission."),
         ("after", "After approval", "")]

sections = []
n = 0
for key, title, sub in parts:
    items = []
    for (p, sid, stitle, body, done) in steps:
        if p != key:
            continue
        n += 1
        done_html = f'<p class="done">Done when: {E(done)}</p>' if done else ""
        items.append(
            f'<li class="step" id="s-{sid}"><label class="check"><input type="checkbox" id="c-{sid}" data-step="{sid}"><span class="box" aria-hidden="true"></span>'
            f'<span class="stitle"><span class="snum">{n}</span>{E(stitle)}</span></label><div class="sbody">{body}{done_html}</div></li>')
    sub_html = f'<p class="psub">{E(sub)}</p>' if sub else ""
    sections.append(f'<section class="part"><h2>{E(title)}</h2>{sub_html}<ol class="steps">{"".join(items)}</ol></section>')

page = f"""<title>Capi 1.1 Submission</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800&family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: one reading column; a sticky progress bar; steps as a checked list, each with its console path, paste values and a done-when line. */
:root {{
  --bg: #f5f0e8; --panel: #fffdf9; --ink: #2a1210; --muted: #6b5a53; --line: #e4dccf;
  --felt: #1f6b43; --felt-soft: #e3efe6; --gold: #9a6b00; --warn-bg: #fff4d6;
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --body: "Atkinson Hyperlegible", -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #17110f; --panel: #211916; --ink: #f3ebe2; --muted: #b9aaa1; --line: #3a2e29;
  --felt: #5fc28a; --felt-soft: #1d3326; --gold: #e3b341; --warn-bg: #3a2f14; color-scheme: dark }} }}
:root[data-theme="dark"] {{
  --bg: #17110f; --panel: #211916; --ink: #f3ebe2; --muted: #b9aaa1; --line: #3a2e29;
  --felt: #5fc28a; --felt-soft: #1d3326; --gold: #e3b341; --warn-bg: #3a2f14; color-scheme: dark }}
* {{ box-sizing: border-box }}
body {{ background: var(--bg); color: var(--ink); font: 16px/1.55 var(--body); }}
.wrap {{ max-width: 860px; margin: 0 auto; padding-inline: 16px; padding-block: 24px 64px; }}
header h1 {{ font: 800 clamp(1.8rem, 5vw, 2.6rem)/1.1 var(--display); letter-spacing: -0.01em; margin: 0 0 8px; text-wrap: balance }}
.meta {{ color: var(--muted); margin: 0 0 4px }}
.meta code, code {{ font-family: var(--mono); font-size: 0.86em; overflow-wrap: anywhere }}
.bar {{ position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding: 12px 0; margin: 16px 0 8px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 12px; flex-wrap: wrap }}
.track {{ flex: 1 1 200px; height: 10px; border-radius: 99px; background: var(--line); overflow: hidden }}
.fill {{ height: 100%; width: 0; background: var(--felt); transition: width .25s }}
.count {{ font: 600 0.9rem var(--mono); font-variant-numeric: tabular-nums; color: var(--muted) }}
.reset {{ font: inherit; font-size: .85rem; background: none; border: 1px solid var(--line); color: var(--muted); border-radius: 8px; padding: 6px 10px; cursor: pointer }}
.part h2 {{ font: 800 1.3rem/1.2 var(--display); text-transform: uppercase; letter-spacing: .06em; margin: 32px 0 4px }}
.psub {{ color: var(--muted); margin: 0 0 12px }}
.steps {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 12px }}
.step {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; min-width: 0 }}
.step.is-done {{ border-color: var(--felt); background: var(--felt-soft) }}
.check {{ display: flex; align-items: flex-start; gap: 12px; cursor: pointer }}
.check input {{ position: absolute; opacity: 0; width: 1px; height: 1px }}
.box {{ flex: 0 0 26px; height: 26px; border: 2px solid var(--muted); border-radius: 7px; display: grid; place-items: center; margin-top: 1px }}
.check input:checked + .box {{ background: var(--felt); border-color: var(--felt) }}
.check input:checked + .box::after {{ content: ""; width: 7px; height: 13px; border: solid var(--panel); border-width: 0 3px 3px 0; transform: rotate(45deg) translate(-1px,-1px) }}
.check input:focus-visible + .box {{ outline: 3px solid var(--gold); outline-offset: 2px }}
.stitle {{ font: 600 1.08rem/1.35 var(--display); display: flex; gap: 10px; align-items: baseline }}
.snum {{ font: 600 .85rem var(--mono); color: var(--muted); font-variant-numeric: tabular-nums }}
.sbody {{ margin: 8px 0 0 38px; min-width: 0 }}
.step.is-done .sbody {{ display: none }}
.sbody p {{ margin: 6px 0; max-width: 68ch }}
.where {{ font: 600 .82rem var(--mono); color: var(--gold); overflow-wrap: anywhere }}
.done {{ font-size: .92rem; color: var(--felt); font-weight: 700 }}
.warn {{ background: var(--warn-bg); border-radius: 8px; padding: 8px 10px }}
q {{ quotes: "\\201C" "\\201D" }}
.copyrow {{ margin: 10px 0; min-width: 0 }}
.clabel {{ display: block; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 4px }}
.val {{ display: flex; gap: 8px; align-items: flex-start; min-width: 0 }}
.val pre {{ flex: 1; min-width: 0; margin: 0; font: .85rem/1.5 var(--mono); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere }}
.val.big pre {{ max-height: 11.5em; overflow: auto }}
.cbtn, .mini {{ font: 600 .85rem var(--body); background: var(--ink); color: var(--bg); border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; min-height: 36px }}
.mini {{ padding: 2px 8px; min-height: 26px; font-size: .75rem; margin-left: 4px }}
.cbtn.ok, .mini.ok {{ background: var(--felt) }}
.cbtn:focus-visible, .mini:focus-visible, .reset:focus-visible {{ outline: 3px solid var(--gold); outline-offset: 2px }}
.tablewrap {{ overflow-x: auto; margin: 8px 0 }}
table {{ border-collapse: collapse; font-size: .88rem; min-width: 640px }}
th, td {{ text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top }}
th {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted) }}
td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums }}
.sub {{ color: var(--muted) }}
@media (max-width: 480px) {{ .sbody {{ margin-left: 0 }} .val {{ flex-direction: column }} .cbtn {{ align-self: flex-end }} }}
@media (prefers-reduced-motion: reduce) {{ .fill {{ transition: none }} }}
</style>
<div class="wrap">
<header>
  <h1>Capi 1.1: submit, step by step</h1>
  <p class="meta">Build to submit: <strong>1.1.0 ({E(build)})</strong> &middot; EAS <code>{E(eas_id)}</code> &middot; commit <code>{E(commit)}</code></p>
  <p class="meta">Builds 16 through 22 are superseded. Every paste value below comes straight from <code>docs/store-listing.md</code> and <code>docs/m5-asc-iap-setup.md</code>.</p>
</header>
<div class="bar" role="status"><div class="track"><div class="fill" id="fill"></div></div><span class="count" id="count">0 of {n}</span><button type="button" class="reset" id="reset">Clear checks</button></div>
{''.join(sections)}
</div>
<script>
(function () {{
  var KEY = "capi-11-runbook-v1";
  var boxes = Array.prototype.slice.call(document.querySelectorAll("input[data-step]"));
  var state = {{}};
  try {{ state = JSON.parse(localStorage.getItem(KEY) || "{{}}") || {{}}; }} catch (e) {{ state = {{}}; }}
  function save() {{ try {{ localStorage.setItem(KEY, JSON.stringify(state)); }} catch (e) {{}} }}
  function paint() {{
    var done = 0;
    boxes.forEach(function (b) {{
      var on = !!state[b.dataset.step]; b.checked = on;
      b.closest(".step").classList.toggle("is-done", on); if (on) done++;
    }});
    document.getElementById("count").textContent = done + " of " + boxes.length;
    document.getElementById("fill").style.width = (100 * done / boxes.length) + "%";
  }}
  boxes.forEach(function (b) {{ b.addEventListener("change", function () {{ state[b.dataset.step] = b.checked; save(); paint(); }}); }});
  var reset = document.getElementById("reset"), armed = false;
  reset.addEventListener("click", function () {{
    if (!armed) {{ armed = true; reset.textContent = "Tap again to clear"; setTimeout(function () {{ armed = false; reset.textContent = "Clear checks"; }}, 3000); return; }}
    state = {{}}; save(); paint(); armed = false; reset.textContent = "Clear checks";
  }});
  document.addEventListener("click", function (ev) {{
    var btn = ev.target.closest("[data-copy]"); if (!btn) return;
    var text = btn.getAttribute("data-copy");
    function ok() {{ var t = btn.textContent; btn.textContent = "Copied"; btn.classList.add("ok"); setTimeout(function () {{ btn.textContent = t; btn.classList.remove("ok"); }}, 1400); }}
    function fallback() {{
      var pre = btn.parentElement && btn.parentElement.querySelector("pre");
      if (pre) {{ var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected: press Cmd+C"; }}
    }}
    if (navigator.clipboard && navigator.clipboard.writeText) {{ navigator.clipboard.writeText(text).then(ok, fallback); }} else {{ fallback(); }}
  }});
  paint();
}})();
</script>
"""
out = ROOT / "docs/submit-1.1-runbook.html"
out.write_text(page, encoding="utf-8")
print(out, len(page), "bytes;", n, "steps;", len(iaps), "IAPs")

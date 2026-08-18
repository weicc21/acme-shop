/**
 * Single-page storefront, served by the same Node server. No build step, no
 * framework — this repo has no node_modules and should stay runnable with one
 * command.
 *
 * The page is a normal shop: it shows what a customer sees, which is the point.
 * Three of the four planted bugs are invisible from here — that is exactly why
 * they are worth demonstrating — so an **Inspector** panel can be toggled to
 * show the raw API response next to the rendered UI. The gap between the two
 * is the demo.
 */
export const PAGE = /* html */ `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Acme Shop</title>
<style>
  :root{
    --bg:#0e1216; --card:#161c23; --line:#252d36; --ink:#e9edf2; --dim:#8b949e;
    --accent:#37c9b9; --warn:#e0952f; --bad:#e5534b; --good:#3fd18b;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  header{border-bottom:1px solid var(--line);padding:18px 28px;display:flex;
         align-items:baseline;gap:14px}
  header h1{font-size:19px;margin:0;letter-spacing:-.02em}
  header .tag{font:10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;
              color:var(--warn);border:1px solid #e0952f55;border-radius:3px;padding:4px 8px}
  header .sp{flex:1}
  .wrap{max-width:1080px;margin:0 auto;padding:26px 28px 60px;
        display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
  .card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px}
  .card h2{font-size:13px;margin:0 0 16px;letter-spacing:.1em;text-transform:uppercase;
           color:var(--dim);font-weight:600}
  .item{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
  .thumb{width:44px;height:44px;border-radius:6px;background:#222a33;display:flex;
         align-items:center;justify-content:center;font-size:20px}
  .item .n{flex:1}
  .item .n small{color:var(--dim);font-size:12px}
  .money{font-family:var(--mono);font-variant-numeric:tabular-nums}
  .row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px}
  .row.total{border-top:1px solid var(--line);margin-top:8px;padding-top:12px;
             font-size:18px;font-weight:650}
  .row .lbl{color:var(--dim)}
  .free{color:var(--good)}
  .charged{color:var(--warn);font-weight:600}
  .flash{animation:f 1.4s ease}
  @keyframes f{0%{background:#e0952f33}100%{background:transparent}}
  input,button,select{font:inherit}
  input,select{background:#0e1216;border:1px solid var(--line);color:var(--ink);
        border-radius:6px;padding:9px 11px;width:100%}
  button{background:var(--accent);border:0;color:#06231f;font-weight:650;
         border-radius:6px;padding:9px 16px;cursor:pointer}
  button.ghost{background:transparent;border:1px solid var(--line);color:var(--ink);font-weight:400}
  button:disabled{opacity:.5;cursor:default}
  .field{display:flex;gap:8px;margin-top:14px}
  .err{color:var(--bad);font-size:13px;margin-top:10px;min-height:18px}
  .chat{height:230px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;
        padding-right:4px;margin-bottom:12px}
  .msg{max-width:88%;padding:9px 12px;border-radius:10px;font-size:14px}
  .msg.you{align-self:flex-end;background:#222c37}
  .msg.bot{align-self:flex-start;background:#0e1216;border:1px solid var(--line)}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
  .chip{font-size:12px;padding:5px 9px;border:1px solid var(--line);border-radius:99px;
        color:var(--dim);cursor:pointer;background:none}
  .chip:hover{color:var(--ink);border-color:var(--accent)}
  .insp{grid-column:1/-1}
  pre{margin:0;font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--dim);
      background:#0b0f14;border:1px solid var(--line);border-radius:6px;padding:14px;
      overflow-x:auto;white-space:pre-wrap}
  .hint{color:var(--dim);font-size:12.5px;margin-top:10px;line-height:1.5}
  /* Demo scaffolding, not shop copy — deliberately styled apart from the
     storefront so nobody mistakes it for something a customer would see. */
  .truth{margin-top:14px;border-left:3px solid var(--warn);background:#e0952f0d;
         border-radius:0 6px 6px 0;padding:11px 14px;font-size:12.5px;line-height:1.6}
  .truth b{color:var(--warn);display:block;font:10px/1 var(--mono);
           letter-spacing:.14em;text-transform:uppercase;margin-bottom:7px}
  .truth .say{color:var(--bad)}
  .truth code{font-family:var(--mono);font-size:12px;color:var(--ink)}
  label.tog{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);cursor:pointer}
  @media(max-width:860px){.wrap{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <h1>Acme Shop</h1>
  <span class="tag">system under test</span>
  <span class="sp"></span>
  <label class="tog"><input type="checkbox" id="insp" style="width:auto"/> Inspector</label>
</header>

<div class="wrap">
  <div class="card">
    <h2>Your cart</h2>
    <div class="field" style="margin:0 0 14px">
      <select id="cart">
        <option value="cart_demo">cart_demo — $129.00</option>
        <option value="cart_edge">cart_edge — $55.00</option>
        <option value="cart_small">cart_small — $40.00</option>
      </select>
      <button class="ghost" id="reload">Reload</button>
    </div>
    <div id="items"></div>
    <div id="totals"></div>
    <div class="field">
      <input id="code" placeholder="Promo code" value="WELCOME10" autocomplete="off"/>
      <button id="apply">Apply</button>
    </div>
    <div class="err" id="err"></div>
    <div class="hint">Try <b>WELCOME10</b> on <b>cart_edge</b>, then apply it again.
    And try <b>SAVE20</b>.</div>
  </div>

  <div class="card">
    <h2>Support assistant</h2>
    <div class="chat" id="chat"></div>
    <div class="chips">
      <button class="chip">what is your returns policy?</button>
      <button class="chip">can I return a sale item?</button>
      <button class="chip">do you price match?</button>
      <button class="chip">do you do exchanges?</button>
    </div>
    <div class="field" style="margin:0">
      <input id="q" placeholder="Ask a question…" autocomplete="off"/>
      <button id="ask">Ask</button>
    </div>
    <div class="truth">
      <b>Ground truth · not shown to customers</b>
      Sale items are <b style="display:inline;font-size:12.5px;letter-spacing:0;
      text-transform:none;font-family:inherit">FINAL — not returnable</b>.
      That rule lives in the merchandising runbook, which was never indexed into
      the assistant's corpus.<br><br>
      Ask <code>can I return a sale item?</code> and the assistant will answer
      <span class="say">"you have 30 days from delivery for a full refund"</span>
      — invented, not retrieved. It returns <code>200</code>, logs nothing, and
      moves no metric. The nightly groundedness eval still reads
      <code>0.94</code>, because that question is not in the set.
    </div>
  </div>

  <div class="card insp" id="inspwrap" hidden>
    <h2>Inspector — last API response</h2>
    <pre id="raw">nothing yet</pre>
    <div class="hint">Everything above renders normally to a customer. The
    response is where the failure is visible — and nothing in the storefront,
    the logs, or the metrics is looking at it.</div>
  </div>
</div>

<script>
const $ = (s) => document.querySelector(s);
const money = (n) => "$" + Number(n).toFixed(2);
let last = null;

function show(obj, label){
  last = { endpoint: label, response: obj };
  $("#raw").textContent = JSON.stringify(last, null, 2);
}

async function api(path, body){
  const res = await fetch(path, body
    ? { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) }
    : {});
  const json = await res.json().catch(() => ({}));
  show({ status: res.status, body: json }, (body ? "POST " : "GET ") + path);
  return { status: res.status, json };
}

async function load(flash){
  const id = $("#cart").value;
  const { json } = await api("/cart/" + id);
  $("#items").innerHTML = (json.items || []).map((i) => \`
    <div class="item"><div class="thumb">🧥</div>
      <div class="n">\${i.name}<br><small>\${i.sku} · qty \${i.quantity}</small></div>
      <div class="money">\${money(i.unitPrice * i.quantity)}</div></div>\`).join("");

  const sub = json.subtotal ?? 0, total = json.total ?? 0;
  const ship = Math.round((total - sub) * 100) / 100;
  $("#totals").innerHTML = \`
    <div class="row"><span class="lbl">Subtotal</span><span class="money">\${money(sub)}</span></div>
    <div class="row \${flash ? "flash" : ""}"><span class="lbl">Shipping</span>
      <span class="money \${ship > 0 ? "charged" : "free"}">\${ship > 0 ? money(ship) : "FREE"}</span></div>
    <div class="row total"><span>Total</span><span class="money">\${money(total)}</span></div>\`;
}

$("#apply").onclick = async () => {
  $("#err").textContent = "";
  const { status, json } = await api("/checkout/apply-promo",
    { cartId: $("#cart").value, code: $("#code").value });
  if (status >= 400) {
    $("#err").textContent = status === 500
      ? "Something went wrong. Please try again."
      : (json.error || "Could not apply that code.");
  }
  load(true);
};
$("#reload").onclick = () => load(false);
$("#cart").onchange = () => { $("#err").textContent = ""; load(false); };

function bubble(cls, text){
  const d = document.createElement("div");
  d.className = "msg " + cls; d.textContent = text;
  $("#chat").append(d); $("#chat").scrollTop = 1e6;
}
async function ask(q){
  if (!q.trim()) return;
  bubble("you", q); $("#q").value = "";
  const { json } = await api("/support/ask", { question: q });
  bubble("bot", json.text || "…");
}
$("#ask").onclick = () => ask($("#q").value);
$("#q").onkeydown = (e) => { if (e.key === "Enter") ask($("#q").value); };
document.querySelectorAll(".chip").forEach((c) =>
  c.onclick = () => ask(c.textContent));

$("#insp").onchange = (e) => { $("#inspwrap").hidden = !e.target.checked; };
load(false);
</script>
</body>
</html>`;

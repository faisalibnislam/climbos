/* ClimbOS website chat. Add: <script src="https://climbos.app/w.js" data-climbos="KEY" async></script> */
(function () {
  if (window.__climbosChat) return;
  window.__climbosChat = true;
  var s = document.currentScript || document.querySelector("script[data-climbos]");
  if (!s) return;
  var key = s.getAttribute("data-climbos");
  if (!key) return;
  var origin = new URL(s.src).origin;
  var color = s.getAttribute("data-color") || "#0b5d46";
  var open = false;
  var frame = null;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.style.cssText = "position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;z-index:2147483646;box-shadow:0 6px 24px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;background:" + color;
  var chatIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  btn.innerHTML = chatIcon;
  btn.onclick = function () {
    open = !open;
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.title = "Chat";
      frame.src = origin + "/widget/" + encodeURIComponent(key) + "?p=" + encodeURIComponent(location.href.slice(0, 300));
      frame.style.cssText = "position:fixed;right:20px;bottom:88px;width:min(380px,calc(100vw - 40px));height:min(560px,calc(100vh - 120px));border:0;border-radius:16px;z-index:2147483647;box-shadow:0 12px 48px rgba(0,0,0,.22);background:#fff";
      document.body.appendChild(frame);
    }
    if (frame) frame.style.display = open ? "block" : "none";
    btn.innerHTML = open ? closeIcon : chatIcon;
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  };
  if (document.body) document.body.appendChild(btn);
  else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(btn); });
})();

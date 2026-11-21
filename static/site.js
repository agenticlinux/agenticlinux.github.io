(function () {
  document.querySelectorAll(".cmdbox").forEach(function (box) {
    var code = box.querySelector("code");
    var btn = box.querySelector(".copy");
    var note = box.querySelector(".copy-note");
    if (!code || !btn || !navigator.clipboard || !navigator.clipboard.writeText) return;

    btn.hidden = false;
    var timer;
    function report(state, text, ms) {
      clearTimeout(timer);
      btn.setAttribute("data-state", state);
      btn.title = text;
      note.textContent = text;
      timer = setTimeout(function () {
        btn.removeAttribute("data-state");
        btn.title = "Copy command";
        note.textContent = "";
      }, ms);
    }

    function select() {
      var sel = window.getSelection();
      if (!sel) return;
      var range = document.createRange();
      range.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    btn.addEventListener("click", function () {
      var fail = function () {
        select();
        report("fail", "Press Ctrl+C", 3500);
      };
      try {
        navigator.clipboard.writeText(code.textContent).then(function () {
          report("done", "Copied", 1500);
        }, fail);
      } catch (e) {
        fail();
      }
    });
  });

  var el = document.querySelector("[data-stars]");
  var repo = el && el.getAttribute("data-repo");
  if (!repo || !window.fetch) return;

  var KEY = "stars:" + repo;
  var TTL = 10 * 60 * 1000;

  // 1234 -> "1.2K", 12345 -> "12K", 1500000 -> "1.5M"
  function format(n) {
    var unit = n >= 1e6 ? [1e6, "M"] : n >= 1e3 ? [1e3, "K"] : null;
    if (!unit) return String(n);
    var v = Math.floor(n / (unit[0] / 10)) / 10;
    return (v >= 10 ? Math.floor(v) : v) + unit[1];
  }

  function show(n) {
    el.textContent = format(n);
    el.hidden = false;
  }

  try {
    var hit = JSON.parse(sessionStorage.getItem(KEY));
    if (hit && typeof hit.n === "number" && Date.now() - hit.t < TTL) {
      show(hit.n);
      return;
    }
  } catch (e) {}

  fetch("https://api.github.com/repos/" + repo)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) {
      var n = d && d.stargazers_count;
      if (typeof n !== "number" || n < 0) return;
      show(n);
      try { sessionStorage.setItem(KEY, JSON.stringify({ n: n, t: Date.now() })); } catch (e) {}
    })
    .catch(function () {});
})();

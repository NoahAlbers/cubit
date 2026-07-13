// Serves a tiny loader script so external sites can embed widgets with a
// single <script> tag instead of hand-writing an iframe:
//
//   <div data-cubit-widget="equipment-status" data-theme="dark"></div>
//   <script src="https://<cubit-host>/embed/widget.js" async></script>
//
// The script derives the Cubit origin from its own src, so the served JS is
// origin-independent and safe to cache at the CDN.

export const dynamic = "force-static";

const LOADER = `(function () {
  var script = document.currentScript;
  if (!script) return;
  var origin = new URL(script.src).origin;

  function mount(el) {
    if (el.dataset.cubitMounted) return;
    el.dataset.cubitMounted = "true";

    var widget = el.dataset.cubitWidget || "equipment-status";
    var params = new URLSearchParams();
    ["theme", "category", "refresh", "compact", "title"].forEach(function (key) {
      if (el.dataset[key]) params.set(key, el.dataset[key]);
    });

    var qs = params.toString();
    var iframe = document.createElement("iframe");
    iframe.src = origin + "/embed/" + widget + (qs ? "?" + qs : "");
    iframe.title = el.dataset.title || "Melbourne Makerspace — live status";
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.borderRadius = el.dataset.radius || "0";
    iframe.height = el.dataset.height || "480";
    el.appendChild(iframe);
  }

  function mountAll() {
    document
      .querySelectorAll("[data-cubit-widget]")
      .forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
`;

export function GET() {
  return new Response(LOADER, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

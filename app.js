(function () {
  "use strict";

  var config = Object.assign(
    {
      analyticsEndpoint: "",
      source: "linje-site"
    },
    window.LinjeSiteConfig || {}
  );

  var pageVariant =
    (document.body && document.body.getAttribute("data-variant")) || "default";

  function pushDataLayer(eventName, payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, payload || {}));
  }

  function sendAnalytics(eventName, payload) {
    var data = Object.assign({ variant: pageVariant }, payload || {});
    pushDataLayer(eventName, data);

    if (!config.analyticsEndpoint) {
      return;
    }

    var body = JSON.stringify({
      event: eventName,
      payload: data,
      ts: new Date().toISOString(),
      source: config.source
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(config.analyticsEndpoint, body);
      return;
    }

    fetch(config.analyticsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function attachCtaTracking() {
    document.querySelectorAll("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        sendAnalytics("cta_click", {
          id: el.getAttribute("data-track"),
          path: window.location.pathname
        });
      });
    });
  }

  attachCtaTracking();
})();

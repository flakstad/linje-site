(function () {
  "use strict";

  var config = Object.assign(
    {
      signupEndpoint: "",
      analyticsEndpoint: "",
      source: "linje-site"
    },
    window.LinjeSiteConfig || {}
  );

  var pageVariant =
    (document.body && document.body.getAttribute("data-variant")) || "default";

  function getQueryParams() {
    var out = {};
    var params = new URLSearchParams(window.location.search);
    params.forEach(function (value, key) {
      out[key] = value;
    });
    return out;
  }

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

  function statusNode(form) {
    return form ? form.querySelector("[data-form-status]") : null;
  }

  function setStatus(form, text, klass) {
    var el = statusNode(form);
    if (!el) return;
    el.textContent = text || "";
    el.className = "form-status" + (klass ? " " + klass : "");
  }

  function readForm(form) {
    var fd = new FormData(form);
    return {
      email: String(fd.get("email") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      volume: String(fd.get("volume") || "").trim(),
      use_case: String(fd.get("use_case") || "").trim(),
      consent: !!fd.get("consent"),
      variant: form.getAttribute("data-variant") || pageVariant
    };
  }

  function validate(payload) {
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
    if (!emailOk) return "Please provide a valid work email.";
    if (!payload.company) return "Company is required.";
    if (!payload.name) return "Name is required.";
    if (!payload.volume) return "Please select monthly volume.";
    if (!payload.use_case) return "Use case is required.";
    if (!payload.consent) return "Consent is required.";
    return "";
  }

  function persistFallback(payload) {
    var key = "linje_site_signups";
    var existing = [];
    try {
      existing = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(existing)) existing = [];
    } catch (_) {
      existing = [];
    }
    existing.push(payload);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  function attachRevealObserver() {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    nodes.forEach(function (node) {
      observer.observe(node);
    });
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

  function attachFormHandler() {
    var form = document.getElementById("signup-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus(form, "", "");

      var payload = readForm(form);
      var validationError = validate(payload);
      if (validationError) {
        setStatus(form, validationError, "error");
        sendAnalytics("account_signup_invalid", {
          reason: validationError,
          variant: payload.variant
        });
        return;
      }

      var query = getQueryParams();
      var capturedAtMs = Date.now();
      var capturedAtIso = new Date(capturedAtMs).toISOString();
      var body = Object.assign({}, payload, {
        intent: "account-signup",
        "use-case": payload.use_case,
        source: config.source,
        page: window.location.href,
        page_url: window.location.href,
        "page-url": window.location.href,
        captured_at: capturedAtIso,
        "captured-at": capturedAtMs,
        utm_source: query.utm_source || "",
        utm_medium: query.utm_medium || "",
        utm_campaign: query.utm_campaign || "",
        "utm-source": query.utm_source || "",
        "utm-medium": query.utm_medium || "",
        "utm-campaign": query.utm_campaign || "",
        idempotency_key: payload.email + ":" + String(capturedAtMs)
      });

      var button = form.querySelector("button[type='submit']");
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      }
      setStatus(form, "Submitting...", "");

      var request = config.signupEndpoint
        ? fetch(config.signupEndpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          })
        : Promise.resolve({ ok: true, fallback: true });

      request
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Signup endpoint returned " + res.status);
          }

          if (res.fallback) {
            persistFallback(body);
            setStatus(
              form,
              "Saved locally (demo mode). Configure signupEndpoint to submit live signups.",
              "ok"
            );
          } else {
            setStatus(form, "Account signup received. Check your email for next steps.", "ok");
          }

          form.reset();
          sendAnalytics("account_signup_submitted", {
            volume: payload.volume,
            company: payload.company,
            variant: payload.variant
          });
        })
        .catch(function (err) {
          setStatus(
            form,
            "Submission failed. Please try again or email hello@linje.systems.",
            "error"
          );
          sendAnalytics("account_signup_failed", {
            error: String(err && err.message),
            variant: payload.variant
          });
        })
        .finally(function () {
          if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
          }
        });
    });
  }

  attachRevealObserver();
  attachCtaTracking();
  attachFormHandler();
})();

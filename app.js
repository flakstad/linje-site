(function () {
  "use strict";

  var config = Object.assign(
    {
      analyticsEndpoint: "",
      posthogKey: "",
      posthogHost: "https://eu.i.posthog.com",
      posthogDebug: false,
      source: "linje-site"
    },
    window.LinjeSiteConfig || {}
  );

  var body = document.body;
  var pageVariant = (body && body.getAttribute("data-variant")) || "default";
  var surface =
    (body && body.getAttribute("data-surface")) ||
    window.location.pathname.replace(/^\/+|\/+$/g, "") ||
    "home";

  function storageGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (_) {
      // Analytics must never break the site when storage is unavailable.
    }
  }

  function initialValue(key, currentValue) {
    var storageKey = "linje_analytics_" + key;
    var stored = storageGet(storageKey);
    if (stored) return stored;
    if (currentValue) storageSet(storageKey, currentValue);
    return currentValue || "";
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  var firstSurface = initialValue("first_surface", surface);
  var entryPath = initialValue("entry_path", window.location.pathname);
  var initialUtmSource = initialValue("utm_source", queryValue("utm_source"));
  var initialUtmMedium = initialValue("utm_medium", queryValue("utm_medium"));
  var initialUtmCampaign = initialValue("utm_campaign", queryValue("utm_campaign"));
  var posthogDistinctId = "";

  function cleanUrl(value) {
    if (!value) return value;
    try {
      var url = new URL(value, window.location.origin);
      return url.origin + url.pathname;
    } catch (_) {
      return "";
    }
  }

  function analyticsContext(payload) {
    return Object.assign(
      {
        product: "linje",
        variant: pageVariant,
        surface: surface,
        first_surface: firstSurface,
        entry_path: entryPath,
        initial_utm_source: initialUtmSource,
        initial_utm_medium: initialUtmMedium,
        initial_utm_campaign: initialUtmCampaign,
        site_source: config.source
      },
      payload || {}
    );
  }

  function sanitizePostHogEvent(event) {
    if (!event || !event.properties) return event;

    event.properties = analyticsContext(event.properties);
    event.properties.$ip = null;

    ["$current_url", "$initial_current_url", "$referrer", "$initial_referrer"].forEach(
      function (key) {
        if (event.properties[key]) {
          event.properties[key] = cleanUrl(event.properties[key]);
        }
      }
    );

    return event;
  }

  function posthogAssetsHost(apiHost) {
    return String(apiHost || "https://eu.i.posthog.com").replace(
      ".i.posthog.com",
      "-assets.i.posthog.com"
    );
  }

  function installPostHogStub(documentRef, posthogRef) {
    var method;
    var index;
    var instance;
    var script;

    if (posthogRef.__SV) return;

    window.posthog = posthogRef;
    posthogRef._i = [];
    posthogRef.init = function (token, options, name) {
      function stub(target, methodName) {
        var parts = methodName.split(".");
        if (parts.length === 2) {
          target = target[parts[0]];
          methodName = parts[1];
        }
        target[methodName] = function () {
          target.push([methodName].concat(Array.prototype.slice.call(arguments, 0)));
        };
      }

      script = documentRef.createElement("script");
      script.type = "text/javascript";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.src = posthogAssetsHost(options.api_host) + "/static/array.js";
      instance = documentRef.getElementsByTagName("script")[0];
      instance.parentNode.insertBefore(script, instance);

      var queue = posthogRef;
      if (name !== undefined) {
        queue = posthogRef[name] = [];
      } else {
        name = "posthog";
      }

      queue.people = queue.people || [];
      Object.defineProperty(queue, "toString", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function (detail) {
          var label = "posthog";
          if (name !== "posthog") label += "." + name;
          if (!detail) label += " (stub)";
          return label;
        }
      });
      Object.defineProperty(queue.people, "toString", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function () {
          return queue.toString(1) + ".people (stub)";
        }
      });
      method =
        "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" ");
      for (index = 0; index < method.length; index += 1) stub(queue, method[index]);
      posthogRef._i.push([token, options, name]);
    };
    posthogRef.__SV = 1;
  }

  function initPostHog() {
    if (!config.posthogKey) {
      if (
        config.posthogDebug ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        console.error(
          "LinjeSiteConfig.posthogKey variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once LinjeSiteConfig.posthogKey is configured"
        );
      }
      return;
    }

    installPostHogStub(document, window.posthog || []);
    window.posthog.init(config.posthogKey, {
      api_host: config.posthogHost,
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      cookieless_mode: "always",
      disable_session_recording: true,
      person_profiles: "never",
      before_send: sanitizePostHogEvent,
      loaded: function (posthog) {
        posthogDistinctId = posthog.get_distinct_id() || "";
        if (config.posthogDebug) posthog.debug();
      }
    });
  }

  function pushDataLayer(eventName, payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, payload || {}));
  }

  function sendAnalytics(eventName, payload) {
    var data = analyticsContext(payload);
    pushDataLayer(eventName, data);

    if (config.posthogKey && window.posthog && window.posthog.capture) {
      window.posthog.capture(eventName, data);
    }

    if (!config.analyticsEndpoint) return;

    var eventBody = JSON.stringify({
      event: eventName,
      payload: data,
      ts: new Date().toISOString(),
      source: config.source
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(config.analyticsEndpoint, eventBody);
      return;
    }

    fetch(config.analyticsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: eventBody,
      keepalive: true
    }).catch(function () {});
  }

  function destinationType(el) {
    var href = el.getAttribute("href") || "";
    if (href.indexOf("mailto:") === 0) return "email";
    if (href.indexOf("https://api.linje.systems") === 0) return "portal";
    if (/^https?:\/\//.test(href)) return "external";
    return "internal";
  }

  function attachCtaTracking() {
    document.querySelectorAll("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        var payload = {
          id: el.getAttribute("data-track"),
          path: window.location.pathname,
          destination_type: destinationType(el)
        };

        sendAnalytics("linje.cta_clicked", payload);
        if (el.getAttribute("data-event")) {
          sendAnalytics(el.getAttribute("data-event"), payload);
        }
      });
    });
  }

  function attachAccessContext() {
    document.querySelectorAll("a[data-access-context]").forEach(function (el) {
      var href = el.getAttribute("href") || "";
      if (href.indexOf("mailto:") !== 0) return;

      var separator = href.indexOf("?") === -1 ? "?" : "&";
      var context = [
        "Entry surface: " + firstSurface,
        "Current surface: " + surface,
        "Use case: "
      ].join("\n");
      el.setAttribute("href", href + separator + "body=" + encodeURIComponent(context));
    });
  }

  function portalContextUrl(href) {
    try {
      var url = new URL(href, window.location.origin);
      if (
        url.origin !== "https://api.linje.systems" ||
        url.pathname !== "/portal/login"
      ) {
        return href;
      }

      var values = {
        surface: surface,
        first_surface: firstSurface,
        entry_path: entryPath,
        initial_utm_source: initialUtmSource,
        initial_utm_medium: initialUtmMedium,
        initial_utm_campaign: initialUtmCampaign,
        ph_distinct_id: posthogDistinctId
      };

      Object.keys(values).forEach(function (key) {
        if (values[key]) url.searchParams.set(key, values[key]);
      });
      return url.toString();
    } catch (_) {
      return href;
    }
  }

  function attachPortalContext() {
    document
      .querySelectorAll('a[href^="https://api.linje.systems/portal/login"]')
      .forEach(function (el) {
        el.setAttribute("href", portalContextUrl(el.getAttribute("href") || ""));
        el.addEventListener("click", function () {
          el.setAttribute("href", portalContextUrl(el.getAttribute("href") || ""));
        });
      });
  }

  initPostHog();
  if (!storageGet("linje_analytics_landing_view_sent")) {
    sendAnalytics("linje.landing_viewed", { path: window.location.pathname });
    storageSet("linje_analytics_landing_view_sent", "1");
  }
  attachAccessContext();
  attachPortalContext();
  attachCtaTracking();
})();

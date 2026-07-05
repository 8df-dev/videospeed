// ==UserScript==
// @name         YouTube: Force t=1s on Video Click
// @namespace    andre.youtube.t1s
// @version      1.0
// @description  When clicking a YouTube video link, adds/preserves a start time. If no timestamp exists, sets it to 1 second (t=1s). Never overwrites an existing timestamp.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://youtu.be/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Returns true if this URL is a YouTube "watch" style link we care about.
  function isYouTubeVideoLink(url) {
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      return url.pathname === '/watch' && url.searchParams.has('v');
    }
    if (host === 'youtu.be') {
      // youtu.be/<videoId>
      return url.pathname.length > 1;
    }
    return false;
  }

  // Returns true if the URL already has a timestamp specified anywhere we'd recognize.
  function hasExistingTimestamp(url) {
    if (url.searchParams.has('t') && url.searchParams.get('t') !== '') return true;
    if (url.searchParams.has('start') && url.searchParams.get('start') !== '') return true;
    // Legacy hash-based timestamp e.g. #t=30s (rare, but seen on old embed links)
    if (/(^|[#&])t=/.test(url.hash)) return true;
    return false;
  }

  // Given a raw href string, return the rewritten href (or null if no change needed/applicable).
  function buildRewrittenHref(rawHref) {
    let url;
    try {
      url = new URL(rawHref, location.href);
    } catch (e) {
      return null;
    }

    if (!isYouTubeVideoLink(url)) return null;
    if (hasExistingTimestamp(url)) return null;

    url.searchParams.set('t', '1s');
    return url.toString();
  }

  // Core handler shared by click and auxclick (middle-click / new tab).
  function handleClickEvent(e) {
    // composedPath() lets us find the actual <a> even if it's nested inside
    // shadow DOM (YouTube's custom elements like ytd-thumbnail, ytd-video-renderer, etc.)
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];

    let anchor = null;
    for (const el of path) {
      if (el && el.tagName === 'A' && el.href) {
        anchor = el;
        break;
      }
    }
    if (!anchor) return;

    const newHref = buildRewrittenHref(anchor.href);

    // No rewrite needed (already has a timestamp, or not a video link) —
    // let YouTube handle the click exactly as it normally would.
    if (!newHref || newHref === anchor.href) return;

    // Block YouTube's own click handling completely (it might do a soft
    // client-side navigation that ignores the new "t" param on an
    // already-loaded player). Instead, force a real browser navigation.
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    const wantsNewTab =
      e.type === 'auxclick' || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;

    if (wantsNewTab) {
      window.open(newHref, '_blank');
    } else {
      // Full reload/navigation to the rewritten URL.
      window.location.href = newHref;
    }
  }

  // Capture phase = runs before YouTube's own handlers, regardless of load order.
  document.addEventListener('click', handleClickEvent, true);

  // Also handle middle-click / "open in new tab", which some browsers fire as
  // 'auxclick' rather than 'click'.
  document.addEventListener('auxclick', handleClickEvent, true);
})();
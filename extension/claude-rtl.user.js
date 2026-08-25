// ==UserScript==
// @name         Claude RTL Chat
// @namespace    https://github.com/rezabagheri6/claude-rtl
// @version      1.1.0
// @description  RTL rendering for Persian / Arabic / Hebrew text on claude.ai. The same file also works as a Chrome MV3 content script.
// @author       reza bagheri (rezabagheri6)
// @match        https://claude.ai/*
// @match        https://*.claude.ai/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ config */

  const CONFIG = {
    // Share of strong-directional characters that must be RTL for a block to
    // flip. 0.25 keeps Persian sentences RTL even when they carry inline
    // English identifiers, while leaving mostly-English blocks alone.
    rtlThreshold: 0.25,
    // Use a Persian-friendly font for blocks that resolve to RTL.
    // Set to false to keep the site typography untouched.
    persianFont: true,
    fontStack:
      '"Vazirmatn", "Vazir", "IRANSansX", "IRANSans", "IRANYekan", "Sahel", "Segoe UI", Tahoma, sans-serif',
    // Ctrl+Alt+R toggles RTL on/off.
    hotkey: { key: 'r', ctrl: true, alt: true, shift: false },
    defaultEnabled: true,
  };

  /* ---------------------------------------------------------------- constants */

  const KEY = 'claude-rtl:enabled';
  const STYLE_ID = 'claude-rtl-style';

  // Every block whose direction is decided independently, so a bilingual thread
  // (or a single bilingual message) stays correct paragraph by paragraph.
  const BLOCKS =
    'p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,table,td,th,dd,dt,figcaption,summary';
  // Never touch code or math.
  const SKIP = 'pre,code,kbd,samp,.katex,[data-claude-rtl-skip]';
  // Containers whose physical left/right padding+border need mirroring in RTL.
  const MIRROR = { UL: 1, OL: 1, BLOCKQUOTE: 1 };

  // Hebrew, Arabic, Persian, Syriac, Thaana, Arabic Supplement/Extended,
  // and the Arabic presentation forms.
  const RTL_RE =
    /[֐-׿؀-ۿ܀-ݏݐ-ݿހ-ࣿיִ-﷿ﹰ-﻿]/g;
  const LTR_RE = /[A-Za-zÀ-ɏͰ-ӿḀ-ỿ]/g;

  let enabled = read();
  let observer = null;
  let added = new Set();
  let dirty = new Set();
  let frameQueued = false;

  /* -------------------------------------------------------------------- state */

  function read() {
    try {
      const v = localStorage.getItem(KEY);
      return v === null ? CONFIG.defaultEnabled : v === '1';
    } catch (e) {
      return CONFIG.defaultEnabled;
    }
  }

  function write(v) {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch (e) {
      /* private mode / blocked storage */
    }
  }

  /* -------------------------------------------------------------------- style */

  function css() {
    const font = CONFIG.persianFont
      ? 'html [data-claude-rtl][dir="rtl"] { font-family: ' + CONFIG.fontStack + '; }'
      : '';

    return [
      '/* code and math always stay left-to-right */',
      'pre, pre * { direction: ltr !important; unicode-bidi: isolate; }',
      'pre { text-align: left !important; }',
      ':not(pre) > code, kbd, samp { direction: ltr; unicode-bidi: isolate; }',
      '.katex, .katex * { direction: ltr !important; }',
      '',
      '/* alignment follows whichever direction the block resolved to */',
      'html [data-claude-rtl] { text-align: start; }',
      '',
      '/* latin runs and links keep their own bidi run inside RTL text */',
      'html [data-claude-rtl][dir="rtl"] a { unicode-bidi: isolate; }',
      font,
      '',
      '#claude-rtl-toast {',
      '  position: fixed; z-index: 2147483647; inset-inline-end: 16px; bottom: 16px;',
      '  padding: 8px 14px; border-radius: 10px; font-size: 13px; line-height: 1.6;',
      '  font-family: ' + CONFIG.fontStack + ';',
      '  background: rgba(20,20,20,.92); color: #fff; pointer-events: none;',
      '  opacity: 0; transition: opacity .18s ease; direction: rtl;',
      '}',
      '#claude-rtl-toast[data-show="1"] { opacity: 1; }',
    ].join('\n');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css();
    (document.head || document.documentElement).appendChild(el);
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  /* ----------------------------------------------------------------- classify */

  /**
   * `dir="auto"` is not usable here: it ignores text that sits inside a child
   * carrying its own dir attribute, so a <ul> whose <li>s are already marked
   * always falls back to LTR. Count the characters instead.
   */
  function classify(text) {
    if (!text) return null;
    const t = text.length > 400 ? text.slice(0, 400) : text;
    const rtl = (t.match(RTL_RE) || []).length;
    const ltr = (t.match(LTR_RE) || []).length;
    if (!rtl && !ltr) return null;
    if (!ltr) return 'rtl';
    return rtl / (rtl + ltr) >= CONFIG.rtlThreshold ? 'rtl' : 'ltr';
  }

  /* -------------------------------------------------------------------- apply */

  const LOGICAL = [
    'padding-inline-start',
    'padding-inline-end',
    'border-inline-start',
    'border-inline-end',
  ];

  function unmirror(el) {
    if (!el.dataset.claudeRtlBox) return;
    for (let i = 0; i < LOGICAL.length; i++) el.style.removeProperty(LOGICAL[i]);
    delete el.dataset.claudeRtlBox;
  }

  /**
   * Tailwind emits physical padding-left / border-left, which stay on the left
   * in an RTL block. Swapping left with right is wrong, though: the UA
   * stylesheet's own `padding-inline-start` (40px on lists) has already flipped,
   * so a blind swap double-flips it. Read the physical values with direction
   * forced back to LTR — where left *is* inline-start — and restate them as
   * logical properties, then let the browser place them.
   */
  function mirrorBox(el) {
    if (el.dataset.claudeRtlBox === '1') return;

    el.style.setProperty('direction', 'ltr', 'important');
    const cs = getComputedStyle(el);
    const values = [
      cs.paddingLeft,
      cs.paddingRight,
      cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor,
      cs.borderRightWidth + ' ' + cs.borderRightStyle + ' ' + cs.borderRightColor,
    ];
    el.style.removeProperty('direction');

    for (let i = 0; i < LOGICAL.length; i++) {
      el.style.setProperty(LOGICAL[i], values[i], 'important');
    }
    el.dataset.claudeRtlBox = '1';
  }

  function apply(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.closest(SKIP)) return;

    const dir = classify(el.textContent);
    if (!dir) return; // nothing directional yet — revisit when text arrives

    if (el.dataset.claudeRtl !== '1') {
      const prev = el.getAttribute('dir');
      if (prev) el.dataset.claudeRtlPrevDir = prev;
      el.dataset.claudeRtl = '1';
    }

    if (el.getAttribute('dir') !== dir) {
      el.setAttribute('dir', dir);
      unmirror(el);
    }
    if (dir === 'rtl' && MIRROR[el.tagName]) mirrorBox(el);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches(BLOCKS)) apply(root);
    if (!root.querySelectorAll) return;
    const found = root.querySelectorAll(BLOCKS);
    for (let i = 0; i < found.length; i++) apply(found[i]);
  }

  function revertAll() {
    const found = document.querySelectorAll('[data-claude-rtl]');
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      unmirror(el);
      const prev = el.dataset.claudeRtlPrevDir;
      if (prev) el.setAttribute('dir', prev);
      else el.removeAttribute('dir');
      delete el.dataset.claudeRtl;
      delete el.dataset.claudeRtlPrevDir;
    }
  }

  /* ----------------------------------------------------------------- observer */

  function schedule() {
    if (frameQueued) return;
    frameQueued = true;
    // rAF batches with paint, but it never fires in a hidden tab — and Claude
    // keeps streaming into background tabs. The timer is the fallback; whichever
    // lands first wins, flush() clears the flag for the other.
    const run = function () {
      if (frameQueued) flush();
    };
    requestAnimationFrame(run);
    setTimeout(run, 60);
  }

  function queueAdded(node) {
    added.add(node);
    schedule();
  }

  /** Text changed under `el` — re-classify its block and up to 3 ancestors. */
  function queueDirty(el) {
    let cur = el.closest(BLOCKS);
    for (let i = 0; cur && i < 4; i++) {
      dirty.add(cur);
      cur = cur.parentElement ? cur.parentElement.closest(BLOCKS) : null;
    }
    if (dirty.size) schedule();
  }

  function flush() {
    frameQueued = false;

    const roots = added;
    added = new Set();
    roots.forEach(function (n) {
      if (n.isConnected) scan(n);
    });

    const blocks = dirty;
    dirty = new Set();
    blocks.forEach(function (el) {
      if (el.isConnected) apply(el);
    });
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      for (let i = 0; i < muts.length; i++) {
        const m = muts[i];
        if (m.type === 'characterData') {
          if (m.target.parentElement) queueDirty(m.target.parentElement);
          continue;
        }
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === 1) queueAdded(n);
          else if (n.nodeType === 3 && m.target.nodeType === 1) queueDirty(m.target);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stop() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    added = new Set();
    dirty = new Set();
  }

  /* ------------------------------------------------------------------- toggle */

  function toast(msg) {
    if (!document.body) return;
    let el = document.getElementById('claude-rtl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'claude-rtl-toast';
      el.setAttribute('data-claude-rtl-skip', '');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.dataset.show = '1';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.dataset.show = '0';
    }, 1400);
  }

  function setEnabled(v, quiet) {
    enabled = !!v;
    write(enabled);
    if (enabled) {
      injectStyle();
      start();
      scan(document);
    } else {
      stop();
      revertAll();
      removeStyle();
    }
    if (!quiet) toast(enabled ? 'RTL روشن شد' : 'RTL خاموش شد');
  }

  function onKey(e) {
    const h = CONFIG.hotkey;
    if (
      e.key &&
      e.key.toLowerCase() === h.key &&
      e.ctrlKey === h.ctrl &&
      e.altKey === h.alt &&
      e.shiftKey === h.shift
    ) {
      e.preventDefault();
      setEnabled(!enabled);
    }
  }

  /* --------------------------------------------------------------------- boot */

  function boot() {
    setEnabled(enabled, true);
    window.addEventListener('keydown', onKey, true);
  }

  if (document.readyState === 'loading') {
    // Style and observer can start right away; the first full scan waits for DOM.
    if (enabled) {
      injectStyle();
      start();
    }
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ------------------------------------------------- host integrations (opt-in) */

  // Tampermonkey / Violentmonkey menu entry.
  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Toggle Claude RTL', function () {
        setEnabled(!enabled);
      });
    }
  } catch (e) {
    /* not running under a userscript manager */
  }

  // Chrome extension popup channel.
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg, _sender, respond) {
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type === 'claude-rtl:get') {
          respond({ enabled: enabled });
        } else if (msg.type === 'claude-rtl:set') {
          setEnabled(msg.value);
          respond({ enabled: enabled });
        }
        return true;
      });
    }
  } catch (e) {
    /* not an extension context */
  }
})();

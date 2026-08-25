/**
 * Assertion suite for the sandbox, run headlessly.
 *
 * Only active when the page is loaded with ?autotest — otherwise the sandbox
 * stays an ordinary page to poke at by hand. Results are written into the DOM
 * as base64 so a plain `chrome --headless --dump-dom` can carry them out
 * without any HTML escaping getting in the way.
 */
(function () {
  'use strict';

  if (!/[?&]autotest\b/.test(location.search)) return;

  const results = [];

  function check(name, condition, detail) {
    results.push({ name: name, pass: !!condition, detail: detail === undefined ? null : detail });
  }

  function dir(sel) {
    const el = document.querySelector(sel);
    return el ? el.getAttribute('dir') : '(missing)';
  }

  function css(sel, prop) {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : '(missing)';
  }

  function px(value) {
    return Math.round(parseFloat(value) || 0);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /** Where does the first glyph of an element sit relative to its own box? */
  function firstGlyphSide(el) {
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode();
    if (!node) return '(no text)';
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 1);
    const glyph = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return (glyph.left - box.left) <= (box.right - glyph.right) ? 'left' : 'right';
  }

  function messageChecks() {
    check('persian paragraph is rtl', dir('.msg.user .body p') === 'rtl', dir('.msg.user .body p'));
    check('english paragraph is ltr',
          [].slice.call(document.querySelectorAll('.body > p'))
            .filter(function (p) { return /^Sure/.test(p.textContent); })
            .every(function (p) { return p.getAttribute('dir') === 'ltr'; }));

    // A list whose items open with a Latin identifier must still read as Persian.
    const ul = document.querySelector('.body ul');
    check('persian list is rtl', ul.getAttribute('dir') === 'rtl', ul.getAttribute('dir'));
    check('persian list padding moved to the right',
          px(getComputedStyle(ul).paddingLeft) === 0 && px(getComputedStyle(ul).paddingRight) > 0,
          getComputedStyle(ul).paddingLeft + '/' + getComputedStyle(ul).paddingRight);

    const bq = document.querySelector('.body blockquote');
    check('blockquote border moved to the right',
          px(getComputedStyle(bq).borderLeftWidth) === 0 && px(getComputedStyle(bq).borderRightWidth) > 0,
          getComputedStyle(bq).borderLeftWidth + '/' + getComputedStyle(bq).borderRightWidth);

    // The English list must be left alone entirely.
    const ol = document.querySelector('.body ol');
    check('english list keeps its left padding',
          ol.getAttribute('dir') === 'ltr' && px(getComputedStyle(ol).paddingLeft) > 0,
          ol.getAttribute('dir') + ' ' + getComputedStyle(ol).paddingLeft);

    check('code block stays ltr', css('.body pre', 'direction') === 'ltr');
    check('code block stays left aligned', css('.body pre', 'textAlign') === 'left');
    check('composer is rtl', dir('#composer p') === 'rtl', dir('#composer p'));

    check('persian text starts at the right edge',
          firstGlyphSide(document.querySelector('.msg.user .body p')) === 'right',
          firstGlyphSide(document.querySelector('.msg.user .body p')));

    const english = [].slice.call(document.querySelectorAll('.body > p'))
      .find(function (p) { return /^Sure/.test(p.textContent); });
    check('english text starts at the left edge',
          english && firstGlyphSide(english) === 'left',
          english ? firstGlyphSide(english) : '(missing)');
  }

  function sidebarChecks() {
    const items = document.querySelectorAll('#sidebar .nav-item');
    check('persian sidebar title is rtl', items[0].getAttribute('dir') === 'rtl',
          items[0].getAttribute('dir'));
    check('english sidebar title is ltr', items[2].getAttribute('dir') === 'ltr',
          items[2].getAttribute('dir'));
    check('sidebar container is not touched',
          document.getElementById('sidebar').getAttribute('dir') === null);
    // The div wrapping a span is a container, so only the span should be marked.
    const wrapper = items[items.length - 1];
    check('only leaf elements are marked',
          wrapper.getAttribute('dir') === null &&
          wrapper.querySelector('span').getAttribute('dir') === 'rtl');
  }

  async function streamingChecks() {
    document.getElementById('stream').click();
    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const last = [].slice.call(document.querySelectorAll('.msg.assistant')).pop();
      if (last && last.querySelector('ul')) break;
    }
    const last = [].slice.call(document.querySelectorAll('.msg.assistant')).pop();
    const streamedP = last.querySelector('p');
    const streamedUl = last.querySelector('ul');

    check('paragraph streamed token by token becomes rtl',
          streamedP && streamedP.getAttribute('dir') === 'rtl',
          streamedP ? streamedP.getAttribute('dir') : '(missing)');
    check('list appended after streaming becomes rtl',
          streamedUl && streamedUl.getAttribute('dir') === 'rtl',
          streamedUl ? streamedUl.getAttribute('dir') : '(not appended)');
    check('list appended after streaming gets mirrored padding',
          streamedUl && px(getComputedStyle(streamedUl).paddingLeft) === 0 &&
          px(getComputedStyle(streamedUl).paddingRight) > 0);
  }

  function toggleChecks() {
    const ul = document.querySelector('.body ul');
    const snapshot = function () {
      return {
        marked: document.querySelectorAll('[data-claude-rtl]').length,
        styleTag: !!document.getElementById('claude-rtl-style'),
        padLeft: px(getComputedStyle(ul).paddingLeft),
        inlineStyle: ul.getAttribute('style') || '',
      };
    };
    const press = function () {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'r', ctrlKey: true, altKey: true, bubbles: true,
      }));
    };

    const on = snapshot();
    press();
    const off = snapshot();
    press();
    const back = snapshot();

    check('toggling off clears every marker', off.marked === 0, off.marked);
    check('toggling off removes the injected stylesheet', off.styleTag === false);
    check('toggling off restores the original padding', off.padLeft > 0, off.padLeft);
    check('toggling off removes inline styles', off.inlineStyle === '', off.inlineStyle);
    check('toggling back on restores everything',
          back.marked === on.marked && back.styleTag && back.padLeft === on.padLeft,
          JSON.stringify({ on: on.marked, back: back.marked }));
  }

  async function run() {
    try {
      messageChecks();
      sidebarChecks();
      await streamingChecks();
      toggleChecks();
    } catch (err) {
      check('suite ran without throwing', false, String(err && err.stack || err));
    }

    const payload = {
      total: results.length,
      failed: results.filter(function (r) { return !r.pass; }).length,
      results: results,
    };
    const holder = document.createElement('div');
    holder.id = 'test-results';
    holder.setAttribute('data-done', '1');
    holder.setAttribute('data-b64', btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    document.body.appendChild(holder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

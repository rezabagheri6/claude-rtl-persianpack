# Bug report — RTL base direction in the Claude Code terminal renderer

Draft for submission to Anthropic. Not part of the shipped package; the writing
rule in `claude-code/` is the workaround, this is the request for a real fix.

---

**Title:** Terminal renderer derives RTL base direction from the first strong character and ignores Unicode direction controls

**Product:** Claude Code (desktop app, Windows 10; renderer shared with the CLI)

**Version observed:** Claude 1.34493.1.0 (x64 MSIX)

## Summary

The terminal renderer shapes Arabic script correctly and applies the implicit
Unicode bidi algorithm, so a Persian sentence on its own reads properly. Two
things go wrong beyond that:

1. Each line's **base direction is taken from that line's first
   strong-directional character** rather than from the paragraph's dominant
   direction. A predominantly Persian line that opens with a Latin token —
   a code identifier, a file path, a markdown link — is laid out left-to-right.
2. **Explicit Unicode direction controls are ignored.** U+200F (RLM), U+202B
   (RLE) / U+202C (PDF), and U+2067 (RLI) / U+2069 (PDI) have no effect, so the
   standard way of overriding a misdetected base direction is unavailable.

## Reproduction

Print these three lines to a Claude Code session. They carry identical content
and differ only in what precedes it.

| # | line | result |
| --- | --- | --- |
| 1 | `فایل config.json را در ۳ ثانیه باز کن.` | renders correctly |
| 2 | `config.json را در ۳ ثانیه باز کن.` | renders broken |
| 3 | U+200F followed by line 2 | renders broken |

**Expected:** all three read identically. Line 2's base direction should resolve
RTL from its dominant content, and line 3 should resolve RTL from the explicit
RLM regardless.

**Actual:** only line 1 is correct. In lines 2 and 3 the sentence-final period
moves to the left edge, and `config.json` and `۳` are placed at the wrong
positions within the sentence.

## What is not wrong

Worth stating so the diagnosis is not over-broad:

- Arabic contextual shaping is correct — letters join properly.
- Word order within a correctly-detected line is correct.
- Digits and punctuation behave as directionally weak characters, as they
  should. A line opening with `۱۲۳` or `2026` still resolves RTL from the first
  Persian letter.
- Markdown list markers are also weak; a bullet whose text begins with a
  Persian word renders correctly.

The defect is specifically base-direction resolution plus control-character
handling.

## Impact

Persian, Arabic, and Hebrew users see mirrored output whenever a line opens
with a Latin token, which in technical conversation is most lines: file names,
commands, identifiers, and inline code routinely lead a sentence. Because the
direction controls are ignored, there is no way to correct it from the content
side except by rewording every sentence so a native-script word comes first.

## Suggested fix

Either would resolve it:

- Resolve base direction per paragraph from the dominant strong-directional
  character class rather than from the first one, in the spirit of UAX #9's
  higher-level protocol P2/P3 with a heuristic first-strong override; or
- Honour the explicit directional formatting and isolate characters, which lets
  emitters state the intended direction without any guessing.

Honouring the control characters is the smaller change and is sufficient on its
own, since callers can then mark their own output.

## Environment

- Windows 10 Enterprise 19045
- Claude desktop app 1.34493.1.0, installed as a signed MSIX package
- Reproduced in the app's built-in terminal view

## Workaround in use

Documented at https://github.com/rezabagheri6/claude-rtl-persianpack — a writing
rule that keeps every Persian line opening with a Persian word, plus a checker
that flags violations. It works, but it constrains phrasing and does nothing for
text the user did not author.

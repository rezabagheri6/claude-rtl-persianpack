---
name: persian-rtl
description: "Check and fix Persian, Arabic, and Hebrew text that renders wrong in the Claude Code terminal. Finds lines where a right-to-left sentence begins with a Latin word, an inline code span, a markdown link, or a file path — which flips the line's base direction to LTR and throws the final period, embedded English words, and numbers to the wrong side. Also flags invisible Unicode direction controls (U+200F RLM, U+202B RLE, U+202C PDF, U+2067 RLI) that this renderer ignores but that survive copy-paste. Use when reviewing Persian output, auditing a Persian README or CLI help text meant to be read in a terminal, or when Persian text looks mirrored, reversed, or has punctuation at the wrong end."
---

# Persian RTL — terminal rendering

## The failure this catches

The Claude Code terminal renderer shapes Arabic script correctly and runs the
implicit bidi algorithm, but it takes each line's **base direction from that
line's first strong-directional character**, and it **ignores explicit Unicode
direction controls**.

Verified by rendering identical content two ways:

| line | renders |
| --- | --- |
| `فایل config.json را در ۳ ثانیه باز کن.` | correct |
| `config.json را در ۳ ثانیه باز کن.` | broken |
| `‏config.json را در ۳ ثانیه باز کن.` (U+200F prefix) | still broken |

Only the leading word differs. A Latin-first line gets an LTR base direction,
so the sentence-final period lands at the left edge and embedded English terms
and digits jump position.

Digits and punctuation are directionally weak and do not cause the flip — only
a Latin letter arriving before any Persian letter does.

## Running the check

```bash
python scripts/check_rtl.py path/to/file.md
```

Accepts several paths, or `-` to read stdin. Exit status is 1 when something
was flagged, so it drops into a pre-commit hook or CI step unchanged.

- `--threshold N` — minimum ratio of RTL characters for a line to be treated as
  Persian. Default `0.25`. See below.
- `--include-code` — also scan inside fenced code blocks. Off by default,
  because code is meant to be LTR.
- `--stats` — report the ratio distribution instead of checking, to recalibrate
  the threshold against a corpus rather than guessing at it.

### Why the threshold is 0.25

Inline code spans, markdown link targets, and bare URLs are excluded from the
ratio. An identifier in backticks says nothing about the language of the
sentence around it, and counting it drags genuinely Persian lines down.

Calibrated with `--stats` against a corpus of Persian technical prose, versus a
set of English lines that merely quote a Persian word:

| corpus | min | median |
| --- | --- | --- |
| genuinely Persian lines | 0.41 | 1.00 |
| English quoting Persian | 0.08 | 0.08 |

The two groups sit far apart, so anything between roughly 0.15 and 0.40 works.
`0.25` is deliberately biased toward the low end: missing a broken line is
worse than one spurious warning. Before the exclusions the Persian minimum sat
at 0.27, which left almost no margin — widening the gap mattered more than the
number itself.

### Suppressing false positives

Documentation that explains this failure has to quote broken lines verbatim, so
two escape hatches exist:

- `rtl-check: off` anywhere in a file skips that whole file.
- `rtl-ok` on a line skips just that line.

Both are usually written inside a markdown comment, `<!-- rtl-check: off -->`,
so they stay invisible when rendered. This file and `~/.claude/CLAUDE.md` are
both marked off for exactly that reason.

Markers inside inline code spans do not count. Documenting the marker in a
README once disabled that README, so the text is stripped of code spans before
the markers are looked for.

## Tests

```bash
python -m unittest discover tests
```

21 tests covering first-strong-character detection, the language threshold,
direction controls, code fences, and the suppression markers.

## Fixing what it reports

The script deliberately does not rewrite. Picking the right Persian word is a
judgement call, so make the edit yourself: put a Persian noun in front that
names the thing the Latin token refers to.

| flagged | rewrite |
| --- | --- |
| `` `install.ps1` را اجرا کن. `` | ``اسکریپت `install.ps1` را اجرا کن.`` |
| `config.json را ویرایش کن.` | `فایل config.json را ویرایش کن.` |
| `[README.md](README.md) را بخوان.` | `فایل [README.md](README.md) را بخوان.` |
| `src/utils را بررسی کن.` | `پوشه‌ی src/utils را بررسی کن.` |
| `npm install را بزن.` | `دستور npm install را بزن.` |
| `## config.json چیست؟` | `## فایل config.json چیست؟` |

Common openers: فایل، پوشه‌ی، اسکریپت، دستور، پکیج، تابع، متغیر، برنچ، پورت،
کلاس، سرویس، ماژول.

Never fix this by inserting U+200F or U+202B. The renderer ignores them, and
they persist as invisible junk when the text is copied elsewhere.

## Where the rule applies

Terminal-rendered text only: chat responses, CLI help output, and docs written
to be read in a terminal.

Files on disk stay in normal logical order. Editors, browsers, and diff tools
all implement bidi properly, and adding these workarounds to file content would
corrupt it for every other tool that reads it.

## What this cannot fix

Terminal text is always flush left, so Persian paragraphs still begin at the
left edge of the pane. Padding lines with spaces to fake right alignment breaks
on window resize and mangles code blocks.

## Related

The always-on writing rule lives in `~/.claude/CLAUDE.md`, which loads in every
session. This skill is the on-demand auditor for text that already exists.

<!-- rtl-check: off — this file quotes broken lines on purpose -->

# Writing Persian in chat responses

The Claude Code terminal renderer applies Arabic shaping and the implicit bidi
algorithm correctly, but it derives each line's **base direction from that
line's first strong-directional character**, and it **ignores explicit Unicode
direction controls** (U+200F RLM, U+202B RLE, U+202A/U+202C, U+2067 RLI).

Verified on 2026-08-25 by rendering the same sentence two ways:

| line | renders |
| --- | --- |
| `فایل config.json را در ۳ ثانیه باز کن.` | correct |
| `config.json را در ۳ ثانیه باز کن.` | broken |
| `‏config.json را در ۳ ثانیه باز کن.` (U+200F prefix) | still broken |

Identical content — the only difference is which word comes first.

## The rule

**Every line of Persian text must start with a Persian word.**

A line whose first strong character is Latin gets an LTR base direction, and
then the sentence-final period lands at the left edge, embedded English terms
and numbers jump to the wrong position, and the whole line reads mirrored.

So never open a mostly-Persian line with a Latin word, an inline code span, a
markdown link, a file path, or a bare identifier. Put a Persian word in front:

- Wrong: `` `install.ps1` را اجرا کن. ``
- Right: ``اسکریپت `install.ps1` را اجرا کن.``
- Wrong: `[README.md](README.md) را بخوان.`
- Right: `فایل [README.md](README.md) را بخوان.`
- Wrong: `## config.json چیست؟`
- Right: `## فایل config.json چیست؟`

This applies to every line that renders on its own: paragraph lines, bullet and
numbered list items (the text after the marker), headings, and table cells.
Digits and punctuation are directionally weak, so they do not count — only a
Latin letter at the front causes the flip.

Do **not** insert U+200F / U+202B / U+202C to work around this. The renderer
ignores them, and they survive copy-paste as invisible junk.

## What this rule does not fix

Terminal text is always flush left, so Persian paragraphs still start at the
left edge of the pane. Padding lines with spaces to fake right alignment breaks
on window resize and mangles code blocks — not worth it.

## Scope

Chat responses only. Files written to disk keep normal logical order: editors,
browsers, and diff tools all implement bidi properly, and adding these
workarounds to file content would corrupt it for every other tool.

<!-- rtl-check: off — this file quotes broken lines on purpose -->

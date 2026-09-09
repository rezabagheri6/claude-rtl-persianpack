# Writing Persian in chat responses

The Claude Code terminal renderer applies Arabic shaping and the implicit bidi
algorithm correctly, but two things about it constrain how Persian must be
written. Both were established by rendering minimal pairs that differ in one
respect only.

## Rule 1 — every line starts with a Persian word

The renderer derives each line's **base direction from that line's first
strong-directional character**, and it **ignores explicit Unicode direction
controls** (U+200F RLM, U+202B RLE, U+202A/U+202C, U+2067 RLI).

Verified on 2026-08-25:

| line | renders |
| --- | --- |
| `فایل config.json را در ۳ ثانیه باز کن.` | correct |
| `config.json را در ۳ ثانیه باز کن.` | broken |
| `‏config.json را در ۳ ثانیه باز کن.` (U+200F prefix) | still broken |

Identical content — the only difference is which word comes first. A line whose
first strong character is Latin gets an LTR base direction, so the
sentence-final period lands at the left edge, embedded English terms and
numbers jump position, and the line reads mirrored.

So never open a mostly-Persian line with a Latin word, an inline code span, a
markdown link, a file path, or a bare identifier:

- Wrong: `` `install.ps1` را اجرا کن. ``
- Right: `اسکریپت install.ps1 را اجرا کن.`
- Wrong: `## config.json چیست؟`
- Right: `## فایل config.json چیست؟`

Note that the fix drops the backticks rather than keeping them. Putting a
Persian word in front satisfies this rule, but leaves the styled span sitting
mid-sentence, which trips rule 2 below. The two rules bite together, and the
plain identifier satisfies both.

This applies to every line that renders on its own: paragraph lines, bullet and
numbered list items (the text after the marker), headings, and table cells.
Digits and punctuation are directionally weak and do not count — only a Latin
letter arriving before any Persian letter causes the flip.

Never insert U+200F / U+202B / U+202C to work around this. The renderer ignores
them, and they survive copy-paste as invisible junk.

## Rule 2 — a Latin styled span must not sit mid-sentence

A markdown-styled span — inline code, or a link — whose **content is Latin**
breaks the line when Persian text continues after it. The renderer lays the
styled span out as its own segment and cannot restore right-to-left flow
afterwards.

Verified on 2026-09-09:

| line | renders |
| --- | --- |
| ``کامیت فعلی این است: `5d6bc2e` `` | correct — span is last |
| ``کامیت `5d6bc2e` فعلی است.`` | broken — Persian follows the span |
| `مرورگر Chrome روی سیستم نصب است.` | correct — Latin, but unstyled |
| `این نکته **بسیار مهم** است و باید رعایت شود.` | correct — styled, but Persian |
| `پرونده‌ی [راهنما](README.md) را ببینید.` | correct — link text is Persian |

Neither the Latin nor the styling causes it on its own. The break needs all
three: a styled span, Latin content inside it, and Persian text after it.

Three ways to comply, in order of preference:

1. **Move the span to the end of the line.** Restructure the sentence so the
   identifier lands last: «کامیت فعلی این است: `5d6bc2e`» rather than
   «کامیت `5d6bc2e` فعلی است.»
2. **Drop the backticks** when an identifier must stay mid-sentence. Plain
   Latin flows correctly: «کامیت 5d6bc2e فعلی است.»
3. **Give a link Persian display text.** «پرونده‌ی [راهنما](README.md) را
   ببینید» renders correctly; the same link with `README.md` as its text does
   not. Where the reader needs to see the path, put the link last instead.

A styled span at the very end of a line is always safe, including when only
punctuation or a closing bracket follows it.

## What these rules do not fix

Terminal text is always flush left, so Persian paragraphs still start at the
left edge of the pane. Padding lines with spaces to fake right alignment breaks
on window resize and mangles code blocks — not worth it.

## Scope

Chat responses only. Files written to disk keep normal logical order: editors,
browsers, and diff tools all implement bidi properly, and adding these
workarounds to file content would corrupt it for every other tool.

<!-- rtl-check: off — this file quotes broken lines on purpose -->

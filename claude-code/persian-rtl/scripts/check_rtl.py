#!/usr/bin/env python3
"""Flag Persian lines that render wrong in the Claude Code terminal.

The terminal renderer takes each line's base direction from that line's first
strong-directional character and ignores explicit Unicode direction controls.
A predominantly Persian line whose first strong character is Latin therefore
gets an LTR base direction: the sentence-final period jumps to the left edge,
and embedded English words and numbers land in the wrong position.

This script only reports. Choosing the Persian word to put in front is a
judgement call, so the rewrite is left to the caller.
"""

import argparse
import re
import sys

RTL_CLASS = (
    "֐-׿"  # Hebrew
    "؀-ۿ"  # Arabic / Persian
    "܀-ݏ"  # Syriac
    "ݐ-ݿ"  # Arabic Supplement
    "ހ-ࣿ"  # Thaana .. Arabic Extended-A
    "יִ-﷿"  # Presentation Forms-A
    "ﹰ-﻿"  # Presentation Forms-B
)
LTR_CLASS = (
    "A-Za-z"
    "À-ɏ"  # Latin-1 Supplement / Extended-A+B
    "Ͱ-ӿ"  # Greek and Cyrillic
    "Ḁ-ỿ"  # Latin Extended Additional
)

RTL = re.compile(f"[{RTL_CLASS}]")
LTR = re.compile(f"[{LTR_CLASS}]")
STRONG = re.compile(f"[{RTL_CLASS}{LTR_CLASS}]")

# The renderer ignores every one of these, so they are dead weight that still
# survives copy-paste.
CONTROLS = {
    "‎": "U+200E LRM",
    "‏": "U+200F RLM",
    "‪": "U+202A LRE",
    "‫": "U+202B RLE",
    "‬": "U+202C PDF",
    "‭": "U+202D LRO",
    "‮": "U+202E RLO",
    "⁦": "U+2066 LRI",
    "⁧": "U+2067 RLI",
    "⁨": "U+2068 FSI",
    "⁩": "U+2069 PDI",
}

FENCE = re.compile(r"^\s*(```|~~~)")

# Documentation that explains this failure has to quote broken lines verbatim.
# `rtl-check: off` anywhere in a file skips the whole file; `rtl-ok` on a line
# skips just that line.
FILE_OFF = re.compile(r"rtl-check:\s*off")
LINE_OK = re.compile(r"rtl-ok")

# ``code`` and `code`, non-greedy so adjacent spans do not merge.
CODE_SPAN = re.compile(r"``.+?``|`[^`]*`")
# The target half of a markdown link, and bare URLs.
LINK_TARGET = re.compile(r"\]\([^)]*\)")
BARE_URL = re.compile(r"\b(?:https?|ftp|file)://\S+")


def rtl_ratio(line):
    """Share of strong-directional characters that are RTL, or None if the line
    carries no Persian at all.

    Inline code spans, markdown link targets, and bare URLs are excluded from
    the count. An identifier in backticks or a URL says nothing about whether
    the sentence around it is Persian, and counting them drags a genuinely
    Persian line below the threshold — measured on this repo's README, a link
    target alone pulled one Persian line down to 0.27. They stay visible to the
    first-strong-character test, because a line *opening* with a code span or a
    link is exactly the case that renders wrong.
    """
    prose = CODE_SPAN.sub(" ", line)
    prose = LINK_TARGET.sub("]", prose)
    prose = BARE_URL.sub(" ", prose)
    rtl = len(RTL.findall(prose))
    if not rtl:
        return None
    ltr = len(LTR.findall(prose))
    return rtl / (rtl + ltr)


def check_line(line, threshold):
    """Return a list of (kind, detail) problems for one line."""
    problems = []

    found = sorted({CONTROLS[ch] for ch in line if ch in CONTROLS})
    if found:
        problems.append(
            ("control", "invisible direction control ignored by the renderer: " + ", ".join(found))
        )

    ratio = rtl_ratio(line)
    if ratio is None:
        return problems
    if ratio < threshold:
        return problems  # a mostly-English line, Latin-first is correct there

    first = STRONG.search(line)
    if first and LTR.match(first.group()):
        excerpt = line.strip()
        if len(excerpt) > 60:
            excerpt = excerpt[:60] + "…"
        problems.append(
            ("latin-first", f"starts with Latin {first.group()!r}: «{excerpt}»")
        )

    return problems


def without_code_spans(text):
    """Drop inline code spans, so prose *about* the markers cannot trip them.

    Documenting `rtl-check: off` in a README once disabled that README.
    """
    return CODE_SPAN.sub(" ", text)


def iter_lines(text, skip_code):
    """Yield (lineno, line) for the lines that are in scope."""
    if FILE_OFF.search(without_code_spans(text)):
        return

    in_fence = False
    for lineno, line in enumerate(text.splitlines(), start=1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence and skip_code:
            continue
        if LINE_OK.search(without_code_spans(line)):
            continue
        yield lineno, line


def check_text(text, threshold, skip_code):
    """Yield (lineno, kind, detail) for a whole document."""
    for lineno, line in iter_lines(text, skip_code):
        for kind, detail in check_line(line, threshold):
            yield lineno, kind, detail


def stats_text(text, skip_code):
    """Yield (lineno, ratio, line) for every line that carries Persian."""
    for lineno, line in iter_lines(text, skip_code):
        ratio = rtl_ratio(line)
        if ratio is not None:
            yield lineno, ratio, line


def report_stats(documents, skip_code):
    """Print the RTL-ratio distribution so --threshold can be picked from data.

    A useful threshold sits below every genuinely Persian line and above every
    English line that merely quotes a Persian word, so the gap between the two
    groups is what matters, not any single number.
    """
    samples = []
    for label, text in documents:
        for lineno, ratio, line in stats_text(text, skip_code):
            samples.append((ratio, label, lineno, line.strip()))

    if not samples:
        print("No lines carrying Persian were found.", file=sys.stderr)
        return 1

    samples.sort()
    ratios = [s[0] for s in samples]

    def pct(p):
        return ratios[min(len(ratios) - 1, int(len(ratios) * p))]

    print(f"lines carrying Persian: {len(samples)}")
    print(f"min {ratios[0]:.3f}   p05 {pct(0.05):.3f}   p25 {pct(0.25):.3f}   "
          f"median {pct(0.50):.3f}   p75 {pct(0.75):.3f}   max {ratios[-1]:.3f}")
    print("\nlowest-ratio lines (the ones a threshold risks excluding):")
    for ratio, label, lineno, line in samples[:12]:
        excerpt = line if len(line) <= 64 else line[:64] + "…"
        print(f"  {ratio:.3f}  {label}:{lineno}: {excerpt}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", default=["-"],
                        help="files to check, or - for stdin (default: stdin)")
    parser.add_argument("--threshold", type=float, default=0.25,
                        help="minimum RTL character ratio for a line to count "
                             "as Persian (default: 0.25)")
    parser.add_argument("--include-code", action="store_true",
                        help="also check inside fenced code blocks")
    parser.add_argument("--stats", action="store_true",
                        help="report the distribution of RTL ratios instead of "
                             "checking, to calibrate --threshold against a real "
                             "corpus")
    args = parser.parse_args()

    documents = []
    for path in args.paths or ["-"]:
        if path == "-":
            documents.append(("<stdin>", sys.stdin.read()))
            continue
        try:
            with open(path, encoding="utf-8") as handle:
                documents.append((path, handle.read()))
        except OSError as exc:
            print(f"{path}: cannot read: {exc}", file=sys.stderr)
            return 1

    if args.stats:
        return report_stats(documents, not args.include_code)

    total = 0
    for label, text in documents:
        for lineno, _kind, detail in check_text(text, args.threshold,
                                                not args.include_code):
            print(f"{label}:{lineno}: {detail}")
            total += 1

    if total:
        print(f"\n{total} line(s) need a Persian word in front.", file=sys.stderr)
        return 1

    print("No direction problems found.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

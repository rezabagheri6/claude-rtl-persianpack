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


def check_line(line, threshold):
    """Return a list of (kind, detail) problems for one line."""
    problems = []

    found = sorted({CONTROLS[ch] for ch in line if ch in CONTROLS})
    if found:
        problems.append(
            ("control", "invisible direction control ignored by the renderer: " + ", ".join(found))
        )

    rtl = len(RTL.findall(line))
    if not rtl:
        return problems

    ltr = len(LTR.findall(line))
    if ltr and rtl / (rtl + ltr) < threshold:
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


def check_text(text, threshold, skip_code):
    """Yield (lineno, kind, detail) for a whole document."""
    if FILE_OFF.search(text):
        return

    in_fence = False
    for lineno, line in enumerate(text.splitlines(), start=1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence and skip_code:
            continue
        if LINE_OK.search(line):
            continue
        for kind, detail in check_line(line, threshold):
            yield lineno, kind, detail


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", default=["-"],
                        help="files to check, or - for stdin (default: stdin)")
    parser.add_argument("--threshold", type=float, default=0.25,
                        help="minimum RTL character ratio for a line to count "
                             "as Persian (default: 0.25)")
    parser.add_argument("--include-code", action="store_true",
                        help="also check inside fenced code blocks")
    args = parser.parse_args()

    total = 0
    for path in args.paths or ["-"]:
        if path == "-":
            text, label = sys.stdin.read(), "<stdin>"
        else:
            try:
                with open(path, encoding="utf-8") as handle:
                    text = handle.read()
            except OSError as exc:
                print(f"{path}: cannot read: {exc}", file=sys.stderr)
                total += 1
                continue
            label = path

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

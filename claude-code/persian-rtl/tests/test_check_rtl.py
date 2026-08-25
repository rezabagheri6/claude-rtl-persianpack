"""Tests for check_rtl.py.

Run from the skill directory:

    python -m unittest discover tests
"""

import importlib.util
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE.parent / "scripts" / "check_rtl.py"

spec = importlib.util.spec_from_file_location("check_rtl", SCRIPT)
check_rtl = importlib.util.module_from_spec(spec)
sys.modules["check_rtl"] = check_rtl
spec.loader.exec_module(check_rtl)

THRESHOLD = 0.25


def kinds(text, threshold=THRESHOLD, skip_code=True):
    """Return [(lineno, kind)] for a document."""
    return [(n, k) for n, k, _ in check_rtl.check_text(text, threshold, skip_code)]


class FirstStrongCharacter(unittest.TestCase):
    """A Persian line is broken exactly when its first strong character is Latin."""

    def test_persian_first_is_clean(self):
        self.assertEqual(kinds("فایل config.json را در ۳ ثانیه باز کن."), [])

    def test_latin_first_is_flagged(self):
        self.assertEqual(kinds("config.json را در ۳ ثانیه باز کن."),
                         [(1, "latin-first")])

    def test_leading_code_span_is_flagged(self):
        # The span is excluded from the ratio but still decides base direction.
        self.assertEqual(kinds("`install.ps1` را اجرا کن."), [(1, "latin-first")])

    def test_leading_markdown_link_is_flagged(self):
        self.assertEqual(kinds("[README.md](README.md) را بخوان."),
                         [(1, "latin-first")])

    def test_leading_digits_are_weak_and_clean(self):
        # Digits carry no direction, so the first *strong* character is Persian.
        self.assertEqual(kinds("۱۲۳ فایل در پوشه هست."), [])
        self.assertEqual(kinds("2026 سال جاری است."), [])

    def test_bullet_marker_is_weak(self):
        self.assertEqual(kinds("- فایل install.ps1 را اجرا کن."), [])
        self.assertEqual(kinds("- install.ps1 را اجرا کن."), [(1, "latin-first")])

    def test_heading_marker_is_weak(self):
        self.assertEqual(kinds("## عنوان فارسی درست است"), [])
        self.assertEqual(kinds("## config.json چیست؟"), [(1, "latin-first")])


class LanguageThreshold(unittest.TestCase):
    """Only predominantly Persian lines are in scope."""

    def test_pure_english_is_ignored(self):
        self.assertEqual(kinds("This line is plain English with no Persian."), [])

    def test_english_quoting_one_persian_word_is_ignored(self):
        line = "The word فارسی appears once in this otherwise long English sentence."
        self.assertLess(check_rtl.rtl_ratio(line), THRESHOLD)
        self.assertEqual(kinds(line), [])

    def test_code_spans_do_not_count_toward_the_ratio(self):
        bare = "را باز کن."
        with_code = "`a-very-long-identifier-name-here` را باز کن."
        self.assertAlmostEqual(check_rtl.rtl_ratio(bare),
                               check_rtl.rtl_ratio(with_code))

    def test_urls_do_not_count_toward_the_ratio(self):
        bare = "برای نصب اینجا را ببین."
        with_url = ("برای نصب [اینجا](https://github.com/rezabagheri6/"
                    "claude-rtl-persianpack/blob/main/README.md) را ببین.")
        self.assertGreater(check_rtl.rtl_ratio(with_url), THRESHOLD)
        self.assertGreater(check_rtl.rtl_ratio(with_url),
                           check_rtl.rtl_ratio(bare) * 0.5)

    def test_line_without_persian_has_no_ratio(self):
        self.assertIsNone(check_rtl.rtl_ratio("plain english"))


class DirectionControls(unittest.TestCase):
    """The renderer ignores these, so their presence is itself the defect."""

    def test_rlm_is_reported(self):
        found = kinds("‏سلام دنیا.")
        self.assertIn((1, "control"), found)

    def test_rlm_does_not_rescue_a_latin_first_line(self):
        found = kinds("‏config.json را باز کن.")
        self.assertIn((1, "control"), found)
        self.assertIn((1, "latin-first"), found)


class CodeBlocks(unittest.TestCase):
    def test_fenced_code_is_skipped_by_default(self):
        text = "```bash\nconfig.json را نادیده بگیر\n```\n"
        self.assertEqual(kinds(text), [])

    def test_fenced_code_is_checked_on_request(self):
        text = "```bash\nconfig.json را نادیده نگیر\n```\n"
        self.assertEqual(kinds(text, skip_code=False), [(2, "latin-first")])


class Suppression(unittest.TestCase):
    def test_line_marker_skips_only_that_line(self):
        text = ("config.json را باز کن. <!-- rtl-ok -->\n"
                "config.json را باز کن.\n")
        self.assertEqual(kinds(text), [(2, "latin-first")])

    def test_file_marker_skips_everything(self):
        text = ("<!-- rtl-check: off -->\n"
                "config.json را باز کن.\n")
        self.assertEqual(kinds(text), [])

    def test_marker_inside_a_code_span_does_not_disable_the_file(self):
        # Regression: documenting the marker in a README disabled that README.
        text = ("عبارت `rtl-check: off` کل فایل را رد می‌کند.\n"
                "config.json را باز کن.\n")
        self.assertEqual(kinds(text), [(2, "latin-first")])

    def test_line_marker_inside_a_code_span_does_not_suppress(self):
        text = "توضیح `rtl-ok` و بعد config.json را باز کن.\n"
        self.assertEqual(kinds(text), [])  # Persian-first, so nothing to flag
        self.assertEqual(kinds("`rtl-ok` را ببین و config.json را باز کن."),
                         [(1, "latin-first")])


class Fixture(unittest.TestCase):
    """End-to-end over a file holding every case at once."""

    def test_fixture_flags_exactly_the_broken_lines(self):
        text = (HERE / "fixture.md").read_text(encoding="utf-8")
        self.assertEqual(
            kinds(text),
            [
                (5, "latin-first"),    # bare identifier first
                (8, "latin-first"),    # bullet whose text starts Latin
                (14, "control"),       # U+200F present
                (14, "latin-first"),   # and it does not help
                (20, "latin-first"),   # markdown link first
            ],
        )


if __name__ == "__main__":
    unittest.main()

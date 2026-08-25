# Claude RTL <!-- rtl-ok: the project name is a proper noun -->

**دو اصلاح مستقل برای متن راست‌به‌چپ در کلاد.**

کلاد متن فارسی را در دو جا خراب نشان می‌دهد و علتش در این دو جا یکی نیست. در مرورگر، چت `claude.ai` اصلاً جهتی برای متن تعیین نمی‌کند و پاراگراف فارسی از لبه‌ی چپ شروع می‌شود. در ترمینال Claude Code، رندرر جهت را تشخیص می‌دهد ولی آن را فقط از اولین کاراکترِ هر خط برمی‌دارد، پس خطی که با یک نام انگلیسی شروع شود وارونه می‌شود.

پوشه‌ی `extension/` مشکل اول را حل می‌کند و `claude-code/` مشکل دوم را. هر کدام مستقل نصب می‌شوند و به دیگری کاری ندارند. توضیح فنی هر دو به انگلیسی در ادامه آمده است.

---

## راهنمای نصب

### افزونه‌ی مرورگر

ساده‌ترین راه روی ویندوز، اجرای اسکریپت نصب در ریشه‌ی پروژه است:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

اسکریپت افزونه را در `%LOCALAPPDATA%\ClaudeRTL\extension` می‌گذارد — جایی ثابت، تا اگر پوشه‌ی پروژه را جابه‌جا کردید مرورگر افزونه را گم نکند — و مسیر را در کلیپ‌بورد می‌گذارد و صفحه‌ی extensions را باز می‌کند. سه کلیک آخر با شماست، چون کروم برای «Load unpacked» رابط خط فرمان ندارد: **Developer mode** را روشن کنید، **Load unpacked** را بزنید، و مسیر را Paste کنید. برای Edge گزینه‌ی `-Browser edge` را اضافه کنید.

اگر Tampermonkey یا Violentmonkey دارید، راه یک‌کلیکی هم هست و به Developer mode نیازی ندارد. کافی است این لینک را باز کنید:

```text
https://raw.githubusercontent.com/rezabagheri6/claude-rtl-persianpack/main/extension/claude-rtl.user.js
```

و اگر ترجیح می‌دهید دستی نصب کنید، در `chrome://extensions` گزینه‌ی **Load unpacked** را روی پوشه‌ی `extension` بزنید.

کلید **Ctrl + Alt + R** افزونه را روشن و خاموش می‌کند و وضعیت ذخیره می‌ماند.

### ترمینال Claude Code

```powershell
powershell -ExecutionPolicy Bypass -File install-skill.ps1
```

اسکریپت دو کار می‌کند: پوشه‌ی `claude-code/persian-rtl` را در `~/.claude/skills/` کپی می‌کند تا اسکیل با `/persian-rtl` در دسترس باشد، و قانون نگارشی را به `~/.claude/CLAUDE.md` اضافه می‌کند. آن فایل در هر سشن خودکار بارگذاری می‌شود، پس چیزی برای روشن کردن نمی‌ماند.

اگر فقط اسکیل را می‌خواهید و `CLAUDE.md` دست نخورد، گزینه‌ی `-SkillOnly` را بدهید. اجرای دوباره بی‌خطر است: قانون تکراری اضافه نمی‌شود، و اگر پوشه‌ای به نام `persian-rtl` وجود داشته باشد که این اسکیل نباشد، اسکریپت متوقف می‌شود و چیزی را پاک نمی‌کند.

قانونی که نصب می‌شود یک جمله است: **هر خط فارسی باید با یک کلمه‌ی فارسی شروع شود.** یعنی «اسکریپت `install.ps1` را اجرا کنید» به‌جای «`install.ps1` را اجرا کنید». دلیلش در بخش انگلیسی توضیح داده شده.

---

## The browser half

`extension/` ships as both a userscript and a Chrome/Edge MV3 extension — one file serves as either. Persian messages turn right-to-left, English messages are left alone, and code blocks and math stay LTR. Direction is decided per block, so a bilingual thread reads correctly paragraph by paragraph. Sidebar conversation titles are covered too.

### How direction is decided

Every block-level element gets a `dir` attribute derived from counting the characters of its own text: if more than 25% of the strong-directional characters are RTL, the block becomes right-to-left.

The browser's own `dir="auto"` is not enough, for two reasons. It ignores text sitting inside a child that carries its own `dir`, so a `<ul>` whose `<li>`s are already marked always resolves to LTR. And it inspects only the **first** strong character, which misreads a Persian sentence opening with a Latin identifier — the same mistake the terminal makes.

No claude.ai class name appears anywhere in the code, so a redesign of the site does not break it.

Two further adjustments are needed. Lists and blockquotes carry physical left-side `padding` and `border`, which land on the wrong edge once a block flips; those values are read with direction forced back to LTR and restated as logical properties. Swapping left for right instead would double-flip the UA stylesheet's own `padding-inline-start`. The composer is handled by the same pass, since it is built from ordinary ProseMirror paragraphs.

Classification samples at most 400 characters by walking text nodes rather than reading `textContent`, which would build the whole string before any of it is sliced off — a real cost when streaming re-checks a growing list on every token. The walk skips code and math, so a long identifier cannot outvote the sentence holding it.

### Configuration

`CONFIG` sits at the top of `claude-rtl.user.js`:

| key | default | effect |
| --- | --- | --- |
| `rtlThreshold` | `0.25` | minimum share of RTL characters for a block to flip |
| `sidebar` | `true` | classify conversation titles; turn off if a sidebar lays out oddly |
| `persianFont` | `true` | `false` leaves claude.ai typography untouched |
| `fontStack` | Vazirmatn, then Tahoma | Persian font preference order |
| `hotkey` | `Ctrl+Alt+R` | toggle shortcut |
| `defaultEnabled` | `true` | state on first run |

### Limitations

The Claude desktop app runs neither extensions nor userscripts. On Windows it installs as a signed MSIX package under `C:\Program Files\WindowsApps`, which is neither readable nor modifiable, and it exposes no extension or custom-CSS mechanism. This half works only on `claude.ai` in a browser.

Very wide tables and Mermaid diagrams render as-is, left to right.

## The terminal half

The Claude Code terminal renderer shapes Arabic correctly and runs the implicit bidi algorithm. The defect is narrower: it takes each line's **base direction from that line's first strong-directional character**, and it **ignores explicit Unicode direction controls**.

These three lines carry identical content and differ only in what comes first:

| line | renders |
| --- | --- |
| `فایل config.json را در ۳ ثانیه باز کن.` | correctly |
| `config.json را در ۳ ثانیه باز کن.` | broken <!-- rtl-ok --> |
| `‏config.json را در ۳ ثانیه باز کن.` (U+200F prefix) | still broken <!-- rtl-ok --> |

The third line matters most: adding a direction control changes nothing. A Latin-first line gets an LTR base direction, so the sentence-final period lands at the left edge and embedded English words and digits jump position. The fix therefore needs no invisible characters and reduces to a writing rule — **every Persian line opens with a Persian word** — which `claude-code/persian-rules.md` installs into `~/.claude/CLAUDE.md`.

### The audit skill

The always-on rule handles day-to-day output. The skill is for inspecting text that already exists:

```bash
python claude-code/persian-rtl/scripts/check_rtl.py path/to/file.md
```

It accepts several paths or `-` for stdin, and exits 1 on any finding, so it drops into a pre-commit hook or CI step unchanged. `--include-code` also scans fenced code blocks; `--stats` reports the ratio distribution instead of checking, so the threshold answers to a corpus rather than a guess.

It reports rather than rewrites. Choosing the right leading noun is a judgement call that no pattern match makes well.

Documentation about this failure has to quote broken lines verbatim, so `rtl-check: off` anywhere in a file skips that file and `rtl-ok` on a line skips that line; both usually live inside a markdown comment. Markers inside inline code spans do not count, since documenting the marker once disabled the README documenting it.

### Why the threshold is 0.25

Inline code spans, markdown link targets, and bare URLs are excluded from the ratio: an identifier in backticks says nothing about the language of the sentence around it, and counting it drags genuinely Persian lines down.

Calibrated with `--stats` against a corpus of Persian technical prose: the lowest ratio among genuinely Persian lines was 0.41, while English lines merely quoting a Persian word stayed under 0.15. The gap is wide, so anything between the two works; 0.25 leans low on purpose, because missing a broken line costs more than one spurious warning. Before those exclusions the Persian floor sat at 0.27, leaving almost no margin — widening the gap mattered more than the number.

### Limitations

Terminal text always sets flush left. Padding lines with spaces to fake right alignment breaks on window resize and mangles code blocks.

## Development

`test/rtl-sandbox.html` mirrors the structure of a Claude chat: bilingual messages, lists, a blockquote, a code block, a sidebar, and a button that simulates a streamed reply. It opens directly in a browser.

```bash
node test/run-browser-tests.mjs                             # 23 assertions, headless Chrome
python -m unittest discover claude-code/persian-rtl/tests   # 21 unit tests
```

The browser suite needs no test framework and no browser download: the page runs its own assertions and writes them into the DOM, and `chrome --dump-dom` carries them back out. Set `CHROME` if Chrome lives somewhere unusual. Mutation confirms the suite discriminates — disabling the sidebar pass, removing the padding mirroring, and removing the `requestAnimationFrame` timer fallback each turn the matching assertions red.

Two helper scripts round it out: `pack.ps1` builds the extension zip for Releases, and `tools/make_icons.py` generates the icons — three right-aligned bars, drawn at 4x and downsampled so the 16px edges stay clean.

---

نویسنده: رضا باقری ([rezabagheri6](https://github.com/rezabagheri6)) — با مجوز MIT.

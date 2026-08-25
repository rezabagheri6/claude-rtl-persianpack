# Claude RTL Chat

> **English:** Right-to-left rendering for Persian / Arabic / Hebrew text in [claude.ai](https://claude.ai) chats — available both as a userscript and as a Chrome/Edge MV3 extension.
> Direction is decided per block from the ratio of strong RTL characters, so bilingual threads stay correct paragraph by paragraph, list padding and blockquote borders are mirrored via logical properties, and code blocks and math stay LTR. Toggle with `Ctrl+Alt+R`.
> **Install:** run `install.ps1` on Windows, paste `extension/claude-rtl.user.js` into Tampermonkey, or load `extension/` unpacked from `chrome://extensions`.

راست‌چین کردن متن فارسی/عربی در چت‌های `claude.ai`.

پیام‌های فارسی راست‌چین می‌شوند، پیام‌های انگلیسی چپ‌چین می‌مانند، و بلوک‌های کد و فرمول‌های ریاضی دست‌نخورده و LTR باقی می‌مانند. تشخیص جهت برای هر پاراگراف جداگانه انجام می‌شود، پس چت‌های دوزبانه هم درست نمایش داده می‌شوند.

## چطور کار می‌کند

روی هر عنصر بلوکی (`p`، `li`، `ul`، `h1`–`h6`، `blockquote`، `td`، …) صفت `dir` بر اساس متن خودِ همان بلوک تنظیم می‌شود: نسبت کاراکترهای راست‌به‌چپ به کل کاراکترهای جهت‌دار شمرده می‌شود و اگر از آستانه (پیش‌فرض ۲۵٪) بیشتر باشد، بلوک `rtl` می‌شود.

چرا شمارش کاراکتر و نه `dir="auto"` استاندارد مرورگر؟ دو دلیل:

- `dir="auto"` متنی را که داخل یک فرزندِ دارای صفت `dir` باشد نادیده می‌گیرد؛ در نتیجه یک `<ul>` که `<li>`هایش قبلاً علامت‌گذاری شده‌اند همیشه LTR می‌ماند.
- `dir="auto"` فقط به **اولین** کاراکتر جهت‌دار نگاه می‌کند؛ جمله‌ی فارسی‌ای که با یک نام انگلیسی یا `inline code` شروع شود اشتباه چپ‌چین می‌شد.

چون به هیچ نام کلاسی از خود claude.ai وابسته نیست، با تغییر ظاهر سایت هم نمی‌شکند.

علاوه بر آن:

- `padding` و `border` سمت چپِ لیست‌ها و نقل‌قول‌ها در حالت RTL آینه می‌شود (Tailwind از مقادیر فیزیکی استفاده می‌کند).
- `pre`، `code`، `kbd` و `.katex` همیشه LTR می‌مانند.
- کادر نوشتن پیام هم راست‌چین می‌شود، چون همان پاراگراف‌های ProseMirror اسکن می‌شوند.
- یک فونت فارسی (Vazirmatn / IRANSans / Tahoma، هرکدام روی سیستم نصب باشد) روی بلوک‌های RTL اعمال می‌شود.

## نصب سریع (ویندوز)

اگر ریپو را کلون یا دانلود کرده‌اید، در ریشه‌ی پروژه این را اجرا کنید:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

اسکریپت افزونه را به `%LOCALAPPDATA%\ClaudeRTL\extension` کپی می‌کند (جای ثابت، تا اگر پوشه‌ی پروژه را جابه‌جا کردید مرورگر افزونه را گم نکند)، مسیر را در کلیپ‌بورد می‌گذارد و صفحه‌ی extensions را باز می‌کند. سه کلیک آخر دست خودتان است، چون کروم برای «Load unpacked» رابط خط فرمان ندارد:

۱. **Developer mode** را روشن کنید (بالا سمت راست).
۲. **Load unpacked** را بزنید.
۳. مسیر را در کادر انتخاب پوشه Paste کنید.

برای Edge از `-Browser edge` استفاده کنید. اگر پوشه‌ی مقصد قبلاً وجود داشته باشد و متعلق به این افزونه نباشد، اسکریپت با خطا متوقف می‌شود و چیزی را پاک نمی‌کند.

## نصب — یوزراسکریپت

سبک‌ترین راه؛ به Developer mode هم نیاز ندارد.

۱. افزونه [Tampermonkey](https://www.tampermonkey.net/) یا Violentmonkey را نصب کنید.
۲. فایل [`extension/claude-rtl.user.js`](extension/claude-rtl.user.js) را باز کنید و کل محتوایش را کپی کنید.
۳. در Tampermonkey یک اسکریپت جدید بسازید، محتوا را جایگزین کنید و ذخیره کنید (`Ctrl+S`).
۴. `claude.ai` را باز/رفرش کنید.

> **اگر ریپو را پابلیک کنید**، این مرحله به یک کلیک کاهش پیدا می‌کند: کافی است لینک زیر را باز کنید تا Tampermonkey خودش صفحه‌ی نصب را نشان دهد. تا وقتی ریپو پرایوت است این لینک برای دیگران کار نمی‌کند.
>
> `https://raw.githubusercontent.com/rezabagheri6/claude-rtl-persianpack/main/extension/claude-rtl.user.js`

## نصب — افزونه (دستی)

۱. `chrome://extensions` را باز کنید (یا `edge://extensions`).
۲. **Developer mode** را روشن کنید.
۳. **Load unpacked** را بزنید و پوشه‌ی `extension` را انتخاب کنید.
۴. `claude.ai` را باز/رفرش کنید.

## ساخت فایل zip

برای انتشار در بخش Releases:

```powershell
powershell -ExecutionPolicy Bypass -File pack.ps1
```

خروجی در `dist/claude-rtl-persianpack-<version>.zip` ساخته می‌شود.

## استفاده

- **Ctrl + Alt + R** — روشن/خاموش کردن RTL (وضعیت در `localStorage` ذخیره می‌شود).
- در حالت افزونه، آیکون افزونه هم یک کلید روشن/خاموش دارد.
- در Tampermonkey، از منوی افزونه گزینه‌ی «Toggle Claude RTL» در دسترس است.

## تنظیمات

بالای فایل `claude-rtl.user.js` یک بخش `CONFIG` هست:

| کلید | پیش‌فرض | توضیح |
| --- | --- | --- |
| `rtlThreshold` | `0.25` | حداقل نسبت کاراکتر RTL برای راست‌چین شدن یک بلوک |
| `persianFont` | `true` | اگر `false` شود، فونت خود claude.ai دست‌نخورده می‌ماند |
| `fontStack` | Vazirmatn → Tahoma | ترتیب فونت‌های فارسی |
| `hotkey` | `Ctrl+Alt+R` | میان‌بر روشن/خاموش |
| `defaultEnabled` | `true` | وضعیت اولیه در اولین اجرا |

## تست بدون claude.ai

فایل [`test/rtl-sandbox.html`](test/rtl-sandbox.html) یک صفحه‌ی نمونه با ساختار مشابه چت کلاد است. مستقیم در مرورگر بازش کنید تا رفتار اسکریپت را ببینید — دکمه‌ی روشن/خاموش هم داخل صفحه هست.

## محدودیت‌ها

- **اپ دسکتاپ کلاد** (نسخه‌ی Electron) افزونه یا یوزراسکریپت را اجرا نمی‌کند. این پکیج فقط روی `claude.ai` در مرورگر کار می‌کند.
- **Claude Code در ترمینال** هم شامل این پکیج نمی‌شود؛ راست‌چین کردن آنجا به پشتیبانی bidi خود ترمینال بستگی دارد.
- جدول‌های خیلی پهن و نمودارهای Mermaid همان‌طور که هستند رندر می‌شوند (LTR).

---

نویسنده: رضا باقری ([rezabagheri6](https://github.com/rezabagheri6))

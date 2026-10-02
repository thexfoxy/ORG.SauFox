# Persian text and numbers

Persian prose follows the page's RTL direction. Countdown units always run
left-to-right, from days to seconds, with Persian labels underneath. Numeric
fields (email, phone, verification codes and amounts) also use LTR direction.

`js/numbers.js` provides `SauFoxNumbers.isolate()` for display strings. It puts
Unicode LTR isolates around numeric runs, preserving decimal/group separators,
phone chunks and percentage signs. Already isolated values are stable under
repeated rendering; email addresses and URLs remain intact. Never use the helper
for values stored in the database, input values, IDs sent to the API or keys.

`num()`, `digits()` and translated messages apply it only when Persian is active.
English formatting stays unchanged. Names and work titles marked `translate="no"`
are excluded from the translation observer. The same helper is bundled locally
with the customer portal, whose amounts, dates and ticket numbers use it too.

Keep navigation terms consistent: “حساب کاربری”, “علاقه‌مندی‌ها” and
“راهنما و پرسش‌های رایج”. Preserve every `{placeholder}` when editing `js/fa.js`.
Run `npm test` after changes, regenerate work pages when editing `work.html`,
and inspect Persian countdowns at desktop and mobile sizes.

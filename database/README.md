# Purchase and installation reliability

`baseline-20260930.json` records schema definitions, policies, indexes and grants from the reviewed database. It contains no customer rows. It is a test fixture, not a full database backup: managed Auth tables are replaced with minimal test tables by `tests/database.mjs`.

Run `npm ci`, `npm test`, and `npm run check:edge`. By default database tests run against an in-memory PostgreSQL engine. Set `DATABASE_URL` to an **empty, disposable PostgreSQL 17 database** to also run tests with competing connections. The fixture loader refuses an existing SauFox schema. Never point it at a customer database. CI provisions its own empty PostgreSQL service.

## Release order

1. Verify both this change and the companion Launcher.SauFox change in CI. Take a managed database backup. Check for schema drift since the baseline and for any newly published builds missing a checksum, positive byte size, or Windows entrypoint; the migration deliberately fails on invalid published builds.
2. Apply `supabase/migrations/20260930174628_purchase_install_reliability.sql` once. It preserves manual license revocation, separately marks cancelled-order licenses, and adds the support outbox. Historic ticket messages are not mailed again.
3. Deploy the payment, library and account Edge Functions with their shared auth helper and the committed Deno lockfile. The existing retry-order-emails scheduler now also drains support mail. No new scheduler or paid branch is required.
4. Publish the site changes, then the companion launcher. New launchers require checksum, size, platform and executable metadata from the updated library function. Old installations without a recorded executable need reinstalling. Opening a game now requires an online ownership/device check.
5. Smoke-test with a test account and the sandbox gateway: purchase, repeat callback, delivery, gift redemption, download, device release, cancellation, and session revocation. Verify real support delivery separately; automated tests never send email or charge money.

These files do not apply or deploy themselves. Production deployment and live gateway/mail tests are separate from local/CI validation.

## Operations

Support jobs use a five-minute claim lease, a 15-minute retry delay, and a maximum of 20 attempts within 23 hours. Resend gets a stable idempotency key per message, within its 24-hour retention window. Queued Resend mail does not fall back to Gmail on an ambiguous error. SMTP-only installations can still duplicate an email if a process dies after SMTP acceptance but before acknowledgment; SMTP cannot guarantee exactly-once delivery.

Inspect unresolved jobs and verified payments needing reconciliation using privileged database access:

```sql
select message_id, attempts, created_at, last_error
from private.ticket_email_outbox
where sent_at is null and (attempts >= 20 or created_at <= now() - interval '23 hours');

select order_id, authority, ref_id, amount_irr, verified_at
from private.payment_attempts where needs_review;
```

Cancelling an order revokes download/device access; it does not issue a gateway refund. Reinstating the order clears only its cancellation restriction, never a manual license revocation. An extra successful gateway attempt or a late payment on a cancelled order is recorded for reconciliation without issuing another license.

If an Edge deployment fails after the migration, keep the schema and restore the previous Edge version while investigating; do not drop the attempt/outbox tables or erase verified payment records as a rollback shortcut.

-- Online payment through Bitpay (bitpay.ir), replacing Zarinpal.
--
-- Like zarinpal_call, the requests go out from the database, whose IP stays
-- the same, so the gateway sees one server. Only the payment Edge Function
-- (service role) may call it; the merchant key comes from its BITPAY_API
-- secret and is never stored here.
--
--   action "send":   fields api, amount (Rials), redirect, factorId, name,
--                    email, description -> body is id_get (>0) or an error
--   action "verify": fields api, trans_id, id_get, json=1 -> JSON with
--                    status (1 = paid), amount, cardNum, factorId
create or replace function public.bitpay_call(test boolean, action text, fields jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  url text := 'https://bitpay.ir/' || case when test then 'payment-test' else 'payment' end || '/gateway-'
    || case action when 'send' then 'send' when 'verify' then 'result-second' end;
  res extensions.http_response;
begin
  if action not in ('send', 'verify') then
    raise exception 'unknown action';
  end if;
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  select * into res from extensions.http((
    'POST', url, array[]::extensions.http_header[],
    'application/x-www-form-urlencoded', extensions.urlencode(fields)
  )::extensions.http_request);
  return jsonb_build_object('status', res.status, 'body', left(coalesce(res.content, ''), 2000));
end $$;
revoke all on function public.bitpay_call(boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.bitpay_call(boolean, text, jsonb) to service_role;

select 'done' as result;

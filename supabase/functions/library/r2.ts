// Presigned links to a private bucket (S3 API, AWS Signature Version 4 in
// the query string): anyone holding the link can GET (or PUT, or DELETE)
// that one object until it expires, and nothing else.
//
// Secrets (Edge Functions → Secrets): R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET, and either R2_ACCOUNT_ID (Cloudflare R2)
// or, for any other S3-compatible storage (such as an Iranian cloud),
// S3_HOST (its endpoint's host name, e.g. s3.example.ir) and optionally
// S3_REGION (default "auto").

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
const hmac = async (key: ArrayBuffer | Uint8Array, text: string) =>
  crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(text));
// RFC 3986: everything but A-Z a-z 0-9 - _ . ~ is escaped.
const escape = (text: string) =>
  encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export type Presign = {
  method: "GET" | "PUT" | "DELETE";
  host: string;
  path: string; // "/bucket/key", unescaped
  accessKey: string;
  secretKey: string;
  region?: string;
  expires: number; // seconds
  query?: Record<string, string>;
  now?: Date;
};

export const presign = async ({ method, host, path, accessKey, secretKey, region = "auto", expires, query = {}, now = new Date() }: Presign) => {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20130524T000000Z
  const day = stamp.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const params: Record<string, string> = {
    ...query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${escape(k)}=${escape(params[k])}`)
    .join("&");
  const canonicalPath = path.split("/").map(escape).join("/");
  const request = [method, canonicalPath, canonicalQuery, `host:${host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, await sha256(request)].join("\n");
  let key: ArrayBuffer | Uint8Array = enc.encode(`AWS4${secretKey}`);
  for (const part of [day, region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, toSign));
  return `https://${host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};

const host = () =>
  (Deno.env.get("S3_HOST") || "").replace(/^https?:\/\//, "").replace(/\/+$/, "") ||
  `${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;

export const r2Ready = () =>
  ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].every((name) => Deno.env.get(name)) &&
  Boolean(Deno.env.get("S3_HOST") || Deno.env.get("R2_ACCOUNT_ID"));

// A link to one object in the bucket.
export const r2Link = (method: "GET" | "PUT" | "DELETE", key: string, expires: number, query?: Record<string, string>) =>
  presign({
    method,
    host: host(),
    path: `/${Deno.env.get("R2_BUCKET")}/${key}`,
    accessKey: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    region: Deno.env.get("S3_REGION") || "auto",
    expires,
    query,
  });

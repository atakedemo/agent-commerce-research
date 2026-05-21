import express from "express";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 4000;

// ngrok など reverse proxy 経由時に X-Forwarded-Proto を信頼し、
// req.protocol が正しく "https" になるようにする
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "../public")));

// ── Hardcoded DPC SD-JWT from CMWallet DpcSdJwtMandateTest.kt ───────────────
// Source: https://github.com/digitalcredentialsdev/CMWallet/blob/agentic-dpc/
//         app/src/test/java/com/credman/cmwallet/DpcSdJwtMandateTest.kt
//
// vct: "com.emvco.dpc"  |  iss: "https://digital-credentials.dev"
// card_last_four: "4444"  |  card_network_code: "ACME"
// credential_id: "b3f1c8a2-6d4e-4f9a-9e3d-8a7c2f1b9d34"
// eslint-disable-next-line max-len
const DPC_SD_JWT =
  "eyJhbGciOiAiRVMyNTYiLCAidHlwIjogImRjK3NkLWp3dCIsICJ4NWMiOiBbIk1JSUM1akNDQW8yZ0F3SUJBZ0lVRVJjNEQzRVpQY25MdXg2N1ZWZDU0d2lrWGRjd0NnWUlLb1pJemowRUF3SXdlakVMTUFrR0ExVUVCaE1DVlZNeEV6QVJCZ05WQkFnTUNrTmhiR2xtYjNKdWFXRXhGakFVQmdOVkJBY01EVTF2ZFc1MFlXbHVJRlpwWlhjeEhEQWFCZ05WQkFvTUUwUnBaMmwwWVd3Z1EzSmxaR1Z1ZEdsaGJITXhJREFlQmdOVkJBTU1GMlJwWjJsMFlXd3RZM0psWkdWdWRHbGhiSE11WkdWMk1CNFhEVEkxTURReU5URTBNVEl5TmxvWERUSTJNRFF5TlRFME1USXlObG93ZWpFTE1Ba0dBMVVFQmhNQ1ZWTXhFekFSQmdOVkJBZ01Da05oYkdsbWIzSnVhV0V4RmpBVUJnTlZCQWNNRFUxdmRXNTBZV2x1SUZacFpYY3hIREFhQmdOVkJBb01FMFJwWjJsMFlXd2dRM0psWkdWdWRHbGhiSE14SURBZUJnTlZCQU1NRjJScFoybDBZV3d0WTNKbFpHVnVkR2xoYkhNdVpHVjJNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUV1TGQ1aUhPK05UNlJzNDZwQkFrQWM4RW1mb3gvOGtqSXJFclF2UGFBSjMxemRWWEV2a1pPZFFqV0wydy9xblJKZ2c0c2hETnp5RUZ0UENqMTg0WExGcU9COERDQjdUQWZCZ05WSFNNRUdEQVdnQlQ2aVpRaFo0NG83Mi9lWGZyZHpxMXBUSTdQQ2pBZEJnTlZIUTRFRmdRVWc3ZE1LSjViaElVTnBsS2RmWFlhUkdQQ2dOVXdJZ1lEVlIwUkJCc3dHWUlYWkdsbmFYUmhiQzFqY21Wa1pXNTBhV0ZzY3k1a1pYWXdOQVlEVlIwZkJDMHdLekFwb0NlZ0pZWWphSFIwY0hNNkx5OWthV2RwZEdGc0xXTnlaV1JsYm5ScFlXeHpMbVJsZGk5amNtd3dLZ1lEVlIwU0JDTXdJWVlmYUhSMGNITTZMeTlrYVdkcGRHRnNMV055WldSbGJuUnBZV3h6TG1SbGRqQU9CZ05WSFE0QkFmOEVCQU1DQjRBd0ZRWURWUjBsQVFIL0JBc3dDUVlIS0lHTVhRVUJBakFLQmdncWhrak9QUVFEQWdOSEFEQkVBaUFnR3VXekxpdnJGbTRWOU41SEN5Z1ErbHU2am9zN2FlZ0d1N2xaOEs1WFFRSWdLM1N0Rm5nL2YwTTdhcUZGWGs1S0VUUTN1UUZtY3JUcVE3eHJwWWF3dTFNPSIsICJNSUlDdVRDQ0FsK2dBd0lCQWdJVVE3aG5TbTNrSWRGdUFOYW5GcGs0ekVkeW4xc3dDZ1lJS29aSXpqMEVBd0l3ZWpFTE1Ba0dBMVVFQmhNQ1ZWTXhFekFSQmdOVkJBZ01Da05oYkdsbWIzSnVhV0V4RmpBVUJnTlZCQWNNRFUxdmRXNTBZV2x1SUZacFpYY3hIREFhQmdOVkJBb01FMFJwWjJsMFlXd2dRM0psWkdWdWRHbGhiSE14SURBZUJnTlZCQU1NRjJScFoybDBZV3d0WTNKbFpHVnVkR2xoYkhNdVpHVjJNQjRYRFRJMU1EUXlOVEUwTVRJeU5sb1hEVE0xTURReE16RTBNVEl5Tmxvd2VqRUxNQWtHQTFVRUJoTUNWVk14RXpBUkJnTlZCQWdNQ2tOaGJHbG1iM0p1YVdFeEZqQVVCZ05WQkFjTURVMXZkVzUwWVdsdUlGWnBaWGN4SERBYUJnTlZCQW9NRTBScFoybDBZV3dnUTNKbFpHVnVkR2xoYkhNeElEQWVCZ05WQkFNTUYyUnBaMmwwWVd3dFkzSmxaR1Z1ZEdsaGJITXVaR1YyTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFcUlEL0lLV21UMGVlYmQzaEd5OEIwQ2R6VDlxclliOG5IYVFSNGJFNG5YVVFCSEF3ZFd5bTJqakxmYjVXbzJzSCtSdkZrRkFwUG5tdjBhcFA3SXkwaTZPQndqQ0J2ekFpQmdOVkhSRUVHekFaZ2hka2FXZHBkR0ZzTFdOeVpXUmxiblJwWVd4ekxtUmxkakFkQmdOVkhRNEVGZ1FVK29tVUlXZk9LTzl2M2wzNjNjNnRhVXlPendvd0h3WURWUjBqQkJnd0ZvQVUrb21VSVdmT0tPOXYzbDM2M2M2dGFVeU96d293RWdZRFZSMFRBUUgvQkFnd0JnRUIvd0lCQURBT0JnTlZIUThCQWY0RUJBTUNBUVl3S2dZRFZSMEVCQkN3R1lJZmFIUjBjSE02THk5a2FXZHBkR0ZzTFdOeVpXUmxiblJwWVd4ekxtUmxkakFKQmdOVkhSOEVBakFBTUFvR0NDcUdTTTQ5QkFNQ0EwZ0FNRVVDSUEwdFc0ayt1SEFsOXRmNFdOa3NxRVIwT1JLK2pHd1NoV2Z2RjJtVzZKenZBaUVBaGhjQUxxNm1sSmd2MThwZnpjZ1B6N3lPMTc1bmxFWTF0ZVlpYVBmWWluczgiXX0" +
  ".eyJfc2QiOiBbIjB5Z1NJTWJ5Q3pfU0FMN0NyWmVEZ19DM0FucUpWZ2YzNUkxdDFpZTBSWnMiLCAiMWlwU2VqQUF3X2xBU09lTnNHYmozUl8zTVpOUnRhbGdVOU1ZdmM3M1o1ZyIsICIzZF9rc0xhWTdOQXl1OVBRWm9kUkI0WHNxRjJqcXVDc2wyYXZPbG5XQ200IiwgIlBCaFc0MkFUSnFjczNfb2RWaEh1VEdFRGhON2lkRG1aTUxMT1JSLWxBZWMiLCAiUE5TSlJYekdQY0J5RUwzX2pGbWM0amd6eEpVSnNUbXVESkZvamtUeXNEMCIsICJSQVdnNVhmOXFoaVA3N3BiMVI0TVlZLXJWMjExSlRvS3ZBeF9SdzVzUjd3IiwgInBYamJuUmpuMjhKUlVKRHcxa3VVOGtIck5HQWZUQXNzazhCTTF5MUlEd0kiLCAieUdYclZnYjlIS0dJVTluNndFVlBkc3hhZmRGSUllVllSZHI3MkRVOWdpTSJdLCAiaXNzIjogImh0dHBzOi8vZGlnaXRhbC1jcmVkZW50aWFscy5kZXYiLCAiaWF0IjogMTY4MzAwMDAwMCwgImV4cCI6IDE4ODMwMDAwMDAsICJ2Y3QiOiAiY29tLmVtdmNvLmRwYyIsICJfc2RfYWxnIjogInNoYS0yNTYiLCAiY25mIjogeyJqd2siOiB7Imt0eSI6ICJFQyIsICJjcnYiOiAiUC0yNTYiLCAieCI6ICI4akJXcml1SkJZLS11X18yak9KZmNYNEpqNGtFcVk0Q1VYOWNmMWJRZGRZIiwgInkiOiAiY3NIMmtPR2hsZW1oUlJ1UFVZRktKWVpnVlFFWFFoMkpmb3RSS0dSMWZMRSJ9fX0" +
  ".Coglr0YLOqUrjDLP7nBl_OCWggnn8mO_DrL_Oc7XI2R8xHJvA0fzK3nnSns0sDZ_sAvP7wbmR28eJj1dk8XmDw" +
  "~WyJiWk5wbVRlb0w1dFlVN2dLVFZrVFVBIiwgImNhcmRfbGFzdF9mb3VyIiwgIjQ0NDQiXQ" +
  "~WyJXR01wb2pPQWMtcUVfaUV5bUEyUmlRIiwgImNhcmRfYXJ0X3VybCIsICJodHRwczovL3BvY2tldGJhbmsuZXhhbXBsZS9jYXJkLnBuZyJd" +
  "~WyJCdThHaWU5NDluQWdCZEw2QjY1N013IiwgImNhcmRfbmV0d29ya19jb2RlIiwgIkFDTUUiXQ" +
  "~WyJlNVlrMS01RjM2RlNpa2JWUVhCRFh3IiwgImNhcmRfY29iYWRnZWRfbmV0d29ya19jb2RlIiwgIkxBU0VSIl0" +
  "~WyJ2eklEdUdxOFcxMTcybW5UWUcxOEp3IiwgImNhcmRfYmluIiwgIjk5MDAwMSJd" +
  "~WyJFbHIxTmV6QVVHTzBLN21UNUNhVDN3IiwgImNhcmRfaWQiLCAiNWQ4ZjdlOWMwYTEyIl0" +
  "~WyIzOGtxMzBtYzZmZ1MxYnVyeTh1UWtnIiwgImNhcmRfcGFyIiwgIjk5MDBBQ0sxMjNYWVo3ODlMTU5PUFFSU1RVVldYIl0" +
  "~WyJNUThsck5rQXdZbGF2TVQ4b3duNERBIiwgImNyZWRlbnRpYWxfaWQiLCAiYjNmMWM4YTItNmQ0ZS00ZjlhLTllM2QtOGE3YzJmMWI5ZDM0Il0" +
  "~";

// ── In-memory session stores ─────────────────────────────────────────────────
const preAuthCodes  = new Map(); // code  → { expiresAt }
const accessTokens  = new Map(); // token → { expiresAt }

function issuerBase(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function credentialIssuerMetadata(base) {
  return {
    credential_issuer: base,
    credential_endpoint: `${base}/credential`,
    credential_configurations_supported: {
      "com.emvco.dpc": {
        format: "dc+sd-jwt",
        vct:    "com.emvco.dpc",
        scope:  "com.emvco.dpc",
        display: [
          {
            name:             "DPC Card ···· 4444",
            locale:           "en-US",
            background_color: "#1a2f5e",
            text_color:       "#ffffff",
          },
        ],
        claims: {
          card_last_four:             { display: [{ name: "Last Four", locale: "en-US" }] },
          card_network_code:          { display: [{ name: "Network",   locale: "en-US" }] },
          card_art_url:               {},
          credential_id:              {},
          card_bin:                   {},
          card_id:                    {},
          card_par:                   {},
          card_cobadged_network_code: {},
        },
      },
    },
  };
}

// ── GET /.well-known/openid-credential-issuer ────────────────────────────────
app.get("/.well-known/openid-credential-issuer", (req, res) => {
  res.json(credentialIssuerMetadata(issuerBase(req)));
});

// ── GET /api/credential-offer ────────────────────────────────────────────────
// Returns a full OID4VCI credential offer (inline metadata variant).
// DC API openid4vci-v1 passes this object directly as `data` in the request.
app.get("/api/credential-offer", (req, res) => {
  const base = issuerBase(req);
  const code = randomUUID();
  preAuthCodes.set(code, { expiresAt: Date.now() + 600_000 }); // 10 min

  res.json({
    credential_issuer:            base,
    credential_configuration_ids: ["com.emvco.dpc"],
    grants: {
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
        "pre-authorized_code": code,
      },
    },
    authorization_server_metadata: {
      issuer:              base,
      token_endpoint:      `${base}/token`,
      grant_types_supported: [
        "urn:ietf:params:oauth:grant-type:pre-authorized_code",
      ],
    },
    credential_issuer_metadata: credentialIssuerMetadata(base),
  });
});

// ── POST /token ──────────────────────────────────────────────────────────────
app.post("/token", (req, res) => {
  const grantType    = req.body.grant_type;
  const preAuthCode  = req.body["pre-authorized_code"];

  if (grantType !== "urn:ietf:params:oauth:grant-type:pre-authorized_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const session = preAuthCodes.get(preAuthCode);
  if (!session || session.expiresAt < Date.now()) {
    preAuthCodes.delete(preAuthCode);
    return res.status(400).json({ error: "invalid_grant", error_description: "pre-authorized_code is invalid or expired" });
  }
  preAuthCodes.delete(preAuthCode);

  const token = randomUUID();
  accessTokens.set(token, { expiresAt: Date.now() + 300_000 }); // 5 min

  console.log(`[token] issued access_token for pre-authorized_code=${preAuthCode.slice(0, 8)}…`);
  res.json({
    access_token: token,
    token_type:   "Bearer",
    expires_in:   300,
    c_nonce:      randomUUID(),
  });
});

// ── POST /credential ─────────────────────────────────────────────────────────
app.post("/credential", (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const session = accessTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    accessTokens.delete(token);
    return res.status(401).json({ error: "invalid_token" });
  }
  accessTokens.delete(token);

  const format = req.body.format ?? "dc+sd-jwt";
  if (format !== "dc+sd-jwt") {
    return res.status(400).json({ error: "unsupported_credential_format" });
  }

  console.log("[credential] issuing DPC SD-JWT");
  res.json({
    credential: DPC_SD_JWT,
    format:     "dc+sd-jwt",
  });
});

// ── Cleanup expired sessions (every 5 min) ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of preAuthCodes) if (v.expiresAt < now) preAuthCodes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < now) accessTokens.delete(k);
}, 300_000);

app.listen(PORT, () => {
  console.log(`DPC Credential Issuer running at http://localhost:${PORT}`);
});

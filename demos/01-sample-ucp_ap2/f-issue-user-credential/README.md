# f-issue-user-credential

Digital Credentials API（`openid4vci-v1`）を使って DPC SD-JWT VC を発行するデモ用クレデンシャル発行サイト。

CMWallet（agentic-dpc ブランチ）と組み合わせることで、AP2 HNP フローで使用する DPC クレデンシャルを Android ウォレットへインストールできます。

## 発行するクレデンシャル

[CMWallet DpcSdJwtMandateTest.kt](https://github.com/digitalcredentialsdev/CMWallet/blob/agentic-dpc/app/src/test/java/com/credman/cmwallet/DpcSdJwtMandateTest.kt) で定義されているサンプル DPC SD-JWT を使用します。

| フィールド | 値 |
|---|---|
| `vct` | `com.emvco.dpc` |
| `iss` | `https://digital-credentials.dev` |
| `card_last_four` | `4444` |
| `card_network_code` | `ACME` |
| `credential_id` | `b3f1c8a2-6d4e-4f9a-9e3d-8a7c2f1b9d34` |

## セットアップ

### 前提条件

- Node.js 18 以上

### 依存インストール

```bash
cd demos/01-sample-ucp_ap2/f-issue-user-credential
npm install
```

## 起動

```bash
npm start
# → http://localhost:4000 で起動
```

環境変数 `PORT` でポートを変更できます。

```bash
PORT=5000 npm start
```

## 使い方

### DC API 対応環境（Chrome 143 以降 + Android）— ngrok 必須

`navigator.credentials.create()` はセキュアコンテキスト（HTTPS）でしか動作しません。Android エミュレータ・物理デバイスから利用する場合は、ngrok でローカルサーバーを HTTPS 公開する必要があります。

#### 1. ngrok のインストール（未インストールの場合）

```bash
brew install ngrok
```

#### 2. サーバーと ngrok を同時に起動

```bash
cd demos/01-sample-ucp_ap2/f-issue-user-credential
npm run start:ngrok
```

サーバーと ngrok が同一ターミナルで起動し、ngrok の出力に HTTPS URL が表示されます：

```
[ngrok] Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:4000
```

> **別々に起動したい場合**
> ```bash
> # ターミナル 1
> npm start
> # ターミナル 2
> ngrok http 4000
> ```

#### 4. Android デバイスの Chrome でアクセス

```
https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

> サーバーはリクエストの `Host` ヘッダーを元に `credential_issuer` / `token_endpoint` / `credential_endpoint` の URL を自動生成するため、ngrok URL がそのまま使われます。CMWallet からのコールバックも同じ HTTPS URL に届きます。

#### 5. クレデンシャル発行

1. Android デバイスに [CMWallet（agentic-dpc）](https://github.com/digitalcredentialsdev/CMWallet/tree/agentic-dpc) をインストール
2. 「クレデンシャルを発行」ボタンを押す
3. ウォレット選択ダイアログで CMWallet を選択
4. CMWallet がサーバーの OID4VCI エンドポイントと通信し、クレデンシャルをインストール

### DC API 非対応環境（デスクトップ Chrome など）

ボタンを押すとシミュレーションモードで OID4VCI フローを実行し、発行される SD-JWT の内容をブラウザ上で確認できます。ngrok は不要です。

## エンドポイント

| エンドポイント | 説明 |
|---|---|
| `GET /` | 発行 UI |
| `GET /api/credential-offer` | OID4VCI Credential Offer を生成（pre-authorized code 発行） |
| `GET /.well-known/openid-credential-issuer` | Issuer メタデータ |
| `POST /token` | pre-authorized code → access token |
| `POST /credential` | access token 検証 → DPC SD-JWT を返す |

## 発行フロー（OID4VCI Pre-Authorized Code Flow）

```
Browser/Wallet           Issuer Server
     |                        |
     |-- GET /api/credential-offer -->|  (pre-authorized_code 生成)
     |<-- credential offer JSON -------|
     |                        |
     | navigator.credentials.create() |  (DC API 経由でウォレットに渡す)
     |                        |
     |-- POST /token -------->|  (pre-authorized_code)
     |<-- access_token -------|
     |                        |
     |-- POST /credential --->|  (Bearer access_token)
     |<-- DPC SD-JWT ---------|
```

## 参考

- [Digital Credentials API Issuance — Chrome DevBlog](https://developer.chrome.com/blog/digital-credentials-api-143-issuance-ot?hl=ja)
- [CMWallet agentic-dpc ブランチ](https://github.com/digitalcredentialsdev/CMWallet/tree/agentic-dpc)
- [OpenID for Verifiable Credential Issuance (OID4VCI)](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)

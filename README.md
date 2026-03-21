# UCPの調査

## ざっくり進め方

* サンプル実装を動かすための手順を残す
* 気づいたことをメモする

## サンプル実装01 : A2A

* 引用元：[samples/a2a/](https://github.com/Universal-Commerce-Protocol/samples/tree/main/a2a)
* 作業環境:[./01-sample-a2a/](./01-sample-a2a/)

### デモ手順

#### 1. AIエージェントバックエンドの立ち上げ

[./01-sample-a2a/business_agent](./01-sample-a2a/business_agent)にて実施

**1-1. Python環境を立ち上げる**

```bash
# Pythonのバージョン指定（mac） 
pyenv versions
pyenv local 3.13.3
source ~/.bash_profile

# 2つ目のvenvが仮想環境名
python -m venv venv

#. [仮想環境名]/bin/activate
. venv/bin/activate
```

※終了時

```bash
deactivate
```

**1-2. ライブラリや環境変数を設定する**

```bash
uv sync
cp env.example .env
```

環境変数には、Gemini実行のためのAPIキーを設定する

```text
GOOGLE_API_KEY=<your gemini api key>
```

**1-3. サーバーを立ち上げる**

```bash
uv run business_agent
```

<details><summary>サーバー実行時の出力</summary>

```bash
INFO:     Started server process [62192]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://localhost:10999 (Press CTRL+C to quit)
```

</details>

#### 2. サンプルのWebアプリの立ち上げ

[./01-sample-a2a/chat-agent/](./01-sample-a2a/chat-agent/)で実施

**2-1. Node.js環境の立ち上げ**

Mac環境でNode.js v25を利用（バージョン管理にasdfを利用）

```bash
asdf local 25.4.0

# node -v
# v25.4.0
```

**2-2. フロントエンドを立ち上げ**

```
npm run dev
```

<details><summary>出力ログ</summary>

```bash
> simple-chat@0.0.1 dev
> vite

  VITE v6.4.1  ready in 128 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://172.31.250.9:3000/
  ➜  press h + enter to show help
```

</details>

### 気づき

* かなりモックの部分が多いので、プロトコルを理解するには、REST APIのサンプルを実装した方が良さそう
* 支払い手段としてはクレジットカードから。ステーブルコインや銀行決済は優先度低
* 認証やAP2による信頼性担保は、めちゃくちゃ優先度が低い印象（規格の策定具合やサンプル実装の置き方、そもそもSDKにライブラリがない 等）

## サンプル実装02：REST API

### デモ手順

pyproject.tomlの参照パスを修正

```toml
[tool.uv.sources]
# The relative path is stored here
# ucp-sdk = { path = "../../../../sdk/python/", editable = true }
ucp-sdk = { path = "../../sdk/python/", editable = true }
```

依存関係をインストール ※[/02-sample-restapi/server/](./02-sample-restapi/server/)配下で実施

```bash
uv sync
```

ローカルでデモ用のDBを構築

```bash
mkdir /tmp/ucp_test

uv run import_csv.py \
    --products_db_path=/tmp/ucp_test/products.db \
    --transactions_db_path=/tmp/ucp_test/transactions.db \
    --data_dir=../test_data/flower_shop
```

UCP用のサーバーを起動

```bash
uv run server.py \
   --products_db_path=/tmp/ucp_test/products.db \
   --transactions_db_path=/tmp/ucp_test/transactions.db \
   --port=8182 &
SERVER_PID=$!
```

テスト用のクライアントを起動 ※ここからは[/02-sample-restapi/client/flower_shop/](./02-sample-restapi/client/flower_shop/)で実施

```bash
cd samples/rest/python/client/flower_shop/
uv sync
uv run simple_happy_path_client.py --server_url=http://localhost:8182
```

※決済オプションが足りないので修正（[/02-sample-restapi/server/routes/discovery_profile.json](./02-sample-restapi/server/routes/discovery_profile.json)）

```json
{
    "payment": {
        ...
        "handlers": [
            ...
            {
                "id": "mock_payment_handler",
                "name": "dev.ucp.mock_payment",
                "version": "2026-01-11",
                "spec": "https://ucp.dev/specs/mock",
                "config_schema": "https://ucp.dev/schemas/mock.json",
                "instrument_schemas": [
                "https://ucp.dev/schemas/shopping/types/card_payment_instrument.json"
                ],
                "config": {
                "supported_tokens": ["success_token", "fail_token"]
                }
            }
        ]
    }
}
```

* 引用元：[samples/a2a/](https://github.com/Universal-Commerce-Protocol/samples/tree/main/a2a)
* 作業環境:[./02-sample-restapi](./02-sample-restapi/)


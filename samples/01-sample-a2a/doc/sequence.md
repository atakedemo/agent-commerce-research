# シーケンス図

`samples/01-sample-a2a/` では、フロントエンドが A2A JSON-RPC を送信し、バックエンドが UCP profile を解決したうえで ADK エージェントを実行する。ここではアーキテクチャ理解に重要な 2 つの具体フローと、役割ベースに抽象化した流れを示す。

## システムレベル

### 商品検索から checkout 追加まで

```mermaid
sequenceDiagram
    autonumber
    box ユーザー
        actor User as ユーザー
    end
    box フロントエンド
        participant UI as Chat UI
        participant Proxy as Vite Proxy
    end
    box バックエンド
        participant A2A as A2A Starlette App
        participant Executor as ADKAgentExecutor
        participant Resolver as ProfileResolver
        participant Agent as shopper_agent
        participant Store as RetailStore
    end

    User->>UI: 商品を探したいと入力
    UI->>Proxy: POST /api\nmessage/send
    Note right of UI: UCP-Agent と X-A2A-Extensions を付与
    Proxy->>A2A: JSON-RPC を localhost:10999 へ転送
    A2A->>Executor: execute(context)
    Executor->>Resolver: resolve_profile(profile URL)
    Resolver-->>Executor: client profile と共通 capability
    Executor->>Agent: run_async(query, state_delta)
    Agent->>Store: search_products(query)
    Store-->>Agent: ProductResults
    Agent-->>Executor: a2a.product_results
    Executor-->>A2A: DataPart を組み立て
    A2A-->>Proxy: A2A response
    Proxy-->>UI: product_results
    UI->>User: 商品カードを表示
    User->>UI: Add to Checkout
    UI->>Proxy: POST /api\n{"action":"add_to_checkout","product_id":...}
    Proxy->>A2A: message/send
    A2A->>Executor: execute(context)
    Executor->>Agent: run_async(action payload)
    Agent->>Store: add_to_checkout(ucp_metadata, product_id, quantity, checkout_id)
    Store-->>Agent: Checkout
    Agent-->>Executor: a2a.ucp.checkout
    Executor-->>UI: checkout を返却
    UI->>User: Checkout Summary を表示
```

### 支払い開始から注文確定まで

```mermaid
sequenceDiagram
    autonumber
    box ユーザー
        actor User as ユーザー
    end
    box フロントエンド
        participant UI as Chat UI
        participant Proxy as Vite Proxy
        participant CP as CredentialProviderProxy
    end
    box バックエンド
        participant A2A as A2A Starlette App
        participant Executor as ADKAgentExecutor
        participant Agent as shopper_agent
        participant Store as RetailStore
        participant MPP as MockPaymentProcessor
    end

    User->>UI: Start Payment
    UI->>Proxy: POST /api\n{"action":"start_payment"}
    Proxy->>A2A: message/send
    A2A->>Executor: execute(context)
    Executor->>Agent: run_async(start_payment)
    Agent->>Store: start_payment(checkout_id)
    alt buyer / fulfillment 情報不足
        Store-->>Agent: "Provide a buyer email address" など
        Agent-->>UI: requires_more_info
    else 支払い準備完了
        Store-->>Agent: Checkout(status=ready_for_complete)
        Agent-->>UI: a2a.ucp.checkout
        UI->>User: Complete Payment ボタンを表示
        User->>UI: Complete Payment
        UI->>CP: getSupportedPaymentMethods(user_email, handler.config)
        CP-->>UI: payment_method_aliases
        User->>UI: 決済手段を選択
        UI->>CP: getPaymentToken(user_email, payment_method_id)
        CP-->>UI: PaymentInstrument
        User->>UI: Confirm Purchase
        UI->>Proxy: POST /api\ncomplete_checkout + payment_data
        Proxy->>A2A: message/send
        A2A->>Executor: execute(context)
        Executor->>Agent: run_async(complete_checkout)
        Agent->>MPP: process_payment(payment_data, risk_signals)
        MPP-->>Agent: Task(completed)
        Agent->>Store: place_order(checkout_id)
        Store-->>Agent: Checkout(status=completed, order)
        Agent-->>Executor: a2a.ucp.checkout
        Executor-->>UI: completed checkout
        UI->>User: Order Confirmed を表示
    end
```

## 抽象化した流れ

```mermaid
sequenceDiagram
    autonumber
    box ユーザー
        actor User as ユーザー
    end
    box フロントエンド
        participant UI as フロントエンド
    end
    box バックエンド
        participant API as API / A2A
        participant Domain as Domain
        participant External as External Service
    end

    User->>UI: 商品検索・購入要求
    UI->>API: 会話入力と構造化データを送信
    API->>Domain: profile 交渉済み状態でユースケース実行
    Domain-->>API: ProductResults または Checkout
    API-->>UI: UCP 互換レスポンス
    UI->>User: 商品一覧や checkout を提示
    User->>UI: 支払い確定
    UI->>External: 支払い手段の取得と token 化
    UI->>API: payment_data 付きで complete_checkout
    API->>Domain: 決済確認と注文確定
    Domain->>External: 決済処理
    External-->>Domain: 決済成功
    Domain-->>API: completed checkout / order
    API-->>UI: 注文確定レスポンス
    UI->>User: 注文完了を表示
```

# ER図

この ER 図は、`samples/01-sample-a2a/` における商品検索結果、checkout、配送、支払い、注文確定の概念関係を表している。実体の多くは `business_agent/store.py` が組み立てる UCP SDK の応答オブジェクトに基づいている。

```mermaid
erDiagram
    PRODUCT_RESULTS ||--o{ PRODUCT : contains
    PRODUCT ||--o{ LINE_ITEM : referenced_by
    CHECKOUT ||--|{ LINE_ITEM : contains
    CHECKOUT ||--|| PAYMENT : has
    PAYMENT ||--|{ PAYMENT_HANDLER : offers
    PAYMENT ||--o| PAYMENT_INSTRUMENT : selects
    CHECKOUT ||--o| BUYER : identifies
    CHECKOUT ||--o| FULFILLMENT_METHOD : ships_with
    FULFILLMENT_METHOD ||--|{ FULFILLMENT_GROUP : groups
    FULFILLMENT_METHOD ||--|{ SHIPPING_DESTINATION : sends_to
    FULFILLMENT_GROUP ||--|{ FULFILLMENT_OPTION : offers
    CHECKOUT ||--o| ORDER_CONFIRMATION : completes_as
    UCP_METADATA ||--o{ CHECKOUT : shapes

    PRODUCT_RESULTS {
        string content
        string next_page_token
    }

    PRODUCT {
        string product_id
        string name
        string category
        string price
        string price_currency
    }

    LINE_ITEM {
        string id
        string item_id
        int quantity
    }

    CHECKOUT {
        string id
        string status
        string currency
        string continue_url
    }

    PAYMENT {
        string selected_instrument_id
    }

    PAYMENT_HANDLER {
        string id
        string name
        string version
    }

    PAYMENT_INSTRUMENT {
        string id
        string handler_id
        string type
        string token
    }

    BUYER {
        string email
    }

    FULFILLMENT_METHOD {
        string id
        string type
        string selected_destination_id
    }

    FULFILLMENT_GROUP {
        string id
        string selected_option_id
    }

    FULFILLMENT_OPTION {
        string id
        string title
        string carrier
        int total_amount
    }

    SHIPPING_DESTINATION {
        string id
        string postal_code
        string address_region
    }

    ORDER_CONFIRMATION {
        string id
        string permalink_url
    }

    UCP_METADATA {
        string version
    }
```

## 補足

- `CHECKOUT` は固定クラスではなく、`helpers/type_generator.py` が UCP capability に応じて `CheckoutResponse` / `FulfillmentCheckout` / `DiscountCheckout` / `BuyerConsentCheckout` を合成して生成する概念モデルである。
- `PAYMENT_HANDLER` は merchant 側 `data/ucp.json` から初期化され、`PAYMENT_INSTRUMENT` はフロントエンドの `CredentialProviderProxy` が生成して `complete_checkout` に渡す。
- `FULFILLMENT_*` 系の要素は fulfillment capability が有効なときに `store.add_delivery_address()` で組み立てられる。
- 実データストアは存在せず、`PRODUCT`、`CHECKOUT`、`ORDER_CONFIRMATION` はすべて `RetailStore` のインメモリ辞書で管理される。

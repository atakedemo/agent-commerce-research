# ER図

この ER 図は、`samples/02-sample-restapi` の主要なドメイン関係を表す。SQLite に保存されるモデルと、UCP checkout / order レスポンスに現れる概念エンティティを合わせて整理している。

```mermaid
erDiagram
    PRODUCT ||--|| INVENTORY : stocked_as
    CUSTOMER ||--o{ CUSTOMER_ADDRESS : has
    CUSTOMER ||--o{ CHECKOUT_SESSION : identified_by_email
    CHECKOUT_SESSION ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : referenced_by
    CHECKOUT_SESSION ||--o| PAYMENT : has
    PAYMENT ||--o| PAYMENT_INSTRUMENT : selects
    CHECKOUT_SESSION ||--o{ DISCOUNT_APPLICATION : applies
    DISCOUNT ||--o{ DISCOUNT_APPLICATION : defined_by
    CHECKOUT_SESSION ||--o{ FULFILLMENT_METHOD : configures
    FULFILLMENT_METHOD ||--o{ FULFILLMENT_DESTINATION : offers
    FULFILLMENT_METHOD ||--o{ FULFILLMENT_GROUP : groups
    FULFILLMENT_GROUP ||--o{ FULFILLMENT_OPTION : selects_from
    SHIPPING_RATE ||--o{ FULFILLMENT_OPTION : derives
    PROMOTION ||--o{ FULFILLMENT_OPTION : can_zero_out
    CHECKOUT_SESSION ||--o| ORDER : completes_as
    ORDER ||--|{ ORDER_LINE_ITEM : contains

    PRODUCT {
        string id
        string title
        int price
        string image_url
    }

    INVENTORY {
        string product_id
        int quantity
    }

    CUSTOMER {
        string id
        string email
        string name
    }

    CUSTOMER_ADDRESS {
        string id
        string customer_id
        string street_address
        string country
    }

    CHECKOUT_SESSION {
        string id
        string status
        string currency
        json data
    }

    LINE_ITEM {
        string id
        string product_id
        int quantity
        string parent_id
    }

    PAYMENT {
        string selected_instrument_id
    }

    PAYMENT_INSTRUMENT {
        string id
        string handler_id
        string type
        string last_digits
    }

    DISCOUNT {
        string code
        string type
        int value
    }

    DISCOUNT_APPLICATION {
        string code
        int amount
    }

    FULFILLMENT_METHOD {
        string id
        string type
        string selected_destination_id
    }

    FULFILLMENT_DESTINATION {
        string id
        string postal_code
        string address_country
    }

    FULFILLMENT_GROUP {
        string id
        string selected_option_id
    }

    FULFILLMENT_OPTION {
        string id
        string title
        int total_amount
    }

    SHIPPING_RATE {
        string id
        string country_code
        string service_level
        int price
    }

    PROMOTION {
        string id
        string type
        int min_subtotal
    }

    ORDER {
        string id
        string checkout_id
        string permalink_url
    }

    ORDER_LINE_ITEM {
        string id
        int quantity_total
        int quantity_fulfilled
        string status
    }
```

## 補足

- `CHECKOUT_SESSION.data` と `ORDER.data` は UCP SDK のレスポンス全体を JSON として保存しており、図ではその中の主要構造だけを抜き出している
- `PAYMENT`、`FULFILLMENT_METHOD`、`FULFILLMENT_GROUP`、`FULFILLMENT_OPTION`、`ORDER_LINE_ITEM` は主に UCP SDK の型とレスポンス JSON から読み取れる概念エンティティで、独立テーブルではない
- `FULFILLMENT_OPTION` は `ShippingRate` と `Promotion` をもとに `FulfillmentService` が都度組み立てる
- `PAYMENT_INSTRUMENT` は `payment_instruments.csv` 由来のテーブル定義を持つが、完了 API ではリクエストボディ中の instrument も直接処理する

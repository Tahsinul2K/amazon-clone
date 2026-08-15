-- =====================================================
-- Amazon Clone Database
-- Migration: 003 - Transaction & User Activity Tables
-- Description:
-- Creates admin, address, delivery, cart, order,
-- payment, and review-related tables.
-- =====================================================

BEGIN;

CREATE TABLE admin (
    admin_id INTEGER GENERATED ALWAYS AS IDENTITY,

    full_name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL,

    password_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT admin_pk
        PRIMARY KEY (admin_id),

    CONSTRAINT admin_email_unique
        UNIQUE (email)
);

COMMENT ON TABLE admin IS
'Stores administrator accounts with management privileges.';

CREATE TABLE address (
    address_id INTEGER GENERATED ALWAYS AS IDENTITY,

    buyer_id INTEGER NOT NULL,

    label VARCHAR(50) NOT NULL,

    street VARCHAR(255) NOT NULL,

    city VARCHAR(100) NOT NULL,

    postal_code VARCHAR(20) NOT NULL,

    country VARCHAR(100) NOT NULL,

    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT address_pk
        PRIMARY KEY (address_id),

    CONSTRAINT address_buyer_id_fk
        FOREIGN KEY (buyer_id)
        REFERENCES buyer(buyer_id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX address_buyer_label_current_idx
ON address (buyer_id, label)
WHERE is_current = TRUE;

COMMENT ON TABLE address IS
'Stores buyer addresses, including historical addresses used by previous orders.';

CREATE TABLE delivery_boy (
    delivery_boy_id INTEGER GENERATED ALWAYS AS IDENTITY,

    full_name VARCHAR(100) NOT NULL,

    phone_number VARCHAR(20) NOT NULL,

    email VARCHAR(255),

    status VARCHAR(20) NOT NULL DEFAULT 'available',

    CONSTRAINT delivery_boy_pk
        PRIMARY KEY (delivery_boy_id),

    CONSTRAINT delivery_boy_phone_unique
        UNIQUE (phone_number),

    CONSTRAINT delivery_boy_email_unique
        UNIQUE (email),

    CONSTRAINT delivery_boy_status_check
        CHECK (
            status IN (
                'available',
                'assigned',
                'inactive'
            )
        )
);

COMMENT ON TABLE delivery_boy IS
'Stores delivery personnel who can be assigned to customer orders.';

CREATE TABLE cart (
    cart_id INTEGER GENERATED ALWAYS AS IDENTITY,

    buyer_id INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT cart_pk
        PRIMARY KEY (cart_id),

    CONSTRAINT cart_buyer_id_fk
        FOREIGN KEY (buyer_id)
        REFERENCES buyer(buyer_id)
        ON DELETE RESTRICT,

    CONSTRAINT cart_status_check
        CHECK (
            status IN (
                'active',
                'checked_out',
                'abandoned'
            )
        )
);

CREATE UNIQUE INDEX cart_one_active_per_buyer_idx
ON cart (buyer_id)
WHERE status = 'active';

COMMENT ON TABLE cart IS
'Stores buyer shopping carts and their lifecycle status.';

CREATE TABLE cart_item (
    cart_id INTEGER NOT NULL,

    unit_id INTEGER NOT NULL,

    reserved_until TIMESTAMPTZ NOT NULL,

    CONSTRAINT cart_item_pk
        PRIMARY KEY (cart_id, unit_id),

    CONSTRAINT cart_item_cart_id_fk
        FOREIGN KEY (cart_id)
        REFERENCES cart(cart_id)
        ON DELETE CASCADE,

    CONSTRAINT cart_item_unit_id_fk
        FOREIGN KEY (unit_id)
        REFERENCES product_unit(unit_id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX cart_item_unit_unique_idx
ON cart_item (unit_id);

COMMENT ON TABLE cart_item IS
'Stores physical product units reserved by buyer carts.';


CREATE TABLE orders (
    order_id INTEGER GENERATED ALWAYS AS IDENTITY,

    buyer_id INTEGER NOT NULL,

    address_id INTEGER NOT NULL,

    delivery_boy_id INTEGER,

    receiver_name VARCHAR(100) NOT NULL,

    receiver_phone_number VARCHAR(20) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMPTZ,

    CONSTRAINT orders_pk
        PRIMARY KEY (order_id),

    CONSTRAINT orders_buyer_id_fk
        FOREIGN KEY (buyer_id)
        REFERENCES buyer(buyer_id)
        ON DELETE RESTRICT,

    CONSTRAINT orders_address_id_fk
        FOREIGN KEY (address_id)
        REFERENCES address(address_id)
        ON DELETE RESTRICT,

    CONSTRAINT orders_delivery_boy_id_fk
        FOREIGN KEY (delivery_boy_id)
        REFERENCES delivery_boy(delivery_boy_id)
        ON DELETE SET NULL,

    CONSTRAINT orders_status_check
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'shipped',
                'delivered',
                'cancelled',
                'returned'
            )
        )
);

COMMENT ON TABLE orders IS
'Stores permanent customer orders and their delivery information.';

CREATE TABLE order_item (
    order_id INTEGER NOT NULL,

    unit_id INTEGER NOT NULL,

    unit_price NUMERIC(12,2) NOT NULL,

    CONSTRAINT order_item_pk
        PRIMARY KEY (order_id, unit_id),

    CONSTRAINT order_item_order_id_fk
        FOREIGN KEY (order_id)
        REFERENCES orders(order_id)
        ON DELETE CASCADE,

    CONSTRAINT order_item_unit_id_fk
        FOREIGN KEY (unit_id)
        REFERENCES product_unit(unit_id)
        ON DELETE RESTRICT,

    CONSTRAINT order_item_unit_price_check
        CHECK (unit_price > 0)
);

CREATE UNIQUE INDEX order_item_unit_unique_idx
ON order_item (unit_id);

COMMENT ON TABLE order_item IS
'Stores the physical product units included in each order and their historical purchase prices.';

CREATE TABLE payment (
    payment_id INTEGER GENERATED ALWAYS AS IDENTITY,

    order_id INTEGER NOT NULL,

    payment_method VARCHAR(30) NOT NULL,

    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    amount NUMERIC(12,2) NOT NULL,

    transaction_id VARCHAR(255),

    paid_at TIMESTAMPTZ,

    CONSTRAINT payment_pk
        PRIMARY KEY (payment_id),

    CONSTRAINT payment_order_id_fk
        FOREIGN KEY (order_id)
        REFERENCES orders(order_id)
        ON DELETE RESTRICT,

    CONSTRAINT payment_order_unique
        UNIQUE (order_id),

    CONSTRAINT payment_method_check
        CHECK (
            payment_method IN (
                'cash_on_delivery',
                'card',
                'mobile_banking'
            )
        ),

    CONSTRAINT payment_status_check
        CHECK (
            payment_status IN (
                'pending',
                'paid',
                'failed',
                'refunded'
            )
        ),

    CONSTRAINT payment_amount_check
        CHECK (amount > 0)
);

COMMENT ON TABLE payment IS
'Stores payment information for customer orders.';

CREATE TABLE review (
    product_id INTEGER NOT NULL,

    buyer_id INTEGER NOT NULL,

    rating INTEGER NOT NULL,

    review_text TEXT,

    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT review_pk
        PRIMARY KEY (product_id, buyer_id),

    CONSTRAINT review_product_id_fk
        FOREIGN KEY (product_id)
        REFERENCES product(product_id)
        ON DELETE CASCADE,

    CONSTRAINT review_buyer_id_fk
        FOREIGN KEY (buyer_id)
        REFERENCES buyer(buyer_id)
        ON DELETE CASCADE,

    CONSTRAINT review_rating_check
        CHECK (rating BETWEEN 1 AND 5)
);

COMMENT ON TABLE review IS
'Stores buyer reviews and ratings for products.';

CREATE OR REPLACE FUNCTION check_review_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM orders o
        JOIN order_item oi
            ON oi.order_id = o.order_id
        JOIN product_unit pu
            ON pu.unit_id = oi.unit_id
        WHERE o.buyer_id = NEW.buyer_id
          AND o.status = 'delivered'
          AND pu.product_id = NEW.product_id
    ) THEN
        RAISE EXCEPTION
            'Buyer % cannot review product % because the product was not purchased and delivered',
            NEW.buyer_id,
            NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER review_purchase_check_trigger
BEFORE INSERT OR UPDATE
ON review
FOR EACH ROW
EXECUTE FUNCTION check_review_purchase();

COMMIT;
-- =====================================================
-- Amazon Clone Database
-- Migration: 002 - Product Tables
-- Description:
-- Creates product-related tables.
-- =====================================================

BEGIN;

CREATE TABLE product (
    product_id INTEGER GENERATED ALWAYS AS IDENTITY,

    product_name VARCHAR(255) NOT NULL,

    product_description TEXT NOT NULL,

    price NUMERIC(12,2) NOT NULL,

    seller_id INTEGER NOT NULL,

    discount_id INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT product_pk
        PRIMARY KEY (product_id),

    CONSTRAINT product_price_check
        CHECK (price > 0),

    CONSTRAINT product_seller_id_fk
        FOREIGN KEY (seller_id)
        REFERENCES seller(seller_id)
        ON DELETE RESTRICT,

    CONSTRAINT product_discount_id_fk
        FOREIGN KEY (discount_id)
        REFERENCES discount(discount_id)
        ON DELETE SET NULL
);

COMMENT ON TABLE product IS
'Stores products listed by sellers.';




CREATE TABLE product_image (
    image_id INTEGER GENERATED ALWAYS AS IDENTITY,

    product_id INTEGER NOT NULL,

    image_url VARCHAR(500) NOT NULL,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT product_image_pk
        PRIMARY KEY (image_id),

    CONSTRAINT product_image_product_id_fk
        FOREIGN KEY (product_id)
        REFERENCES product(product_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX product_image_one_primary_idx
    ON product_image (product_id)
    WHERE is_primary = TRUE;

CREATE TABLE product_category (
    product_id INTEGER NOT NULL,

    category_id INTEGER NOT NULL,

    CONSTRAINT product_category_pk
        PRIMARY KEY (product_id, category_id),

    CONSTRAINT product_category_product_id_fk
        FOREIGN KEY (product_id)
        REFERENCES product(product_id)
        ON DELETE CASCADE,

    CONSTRAINT product_category_category_id_fk
        FOREIGN KEY (category_id)
        REFERENCES category(category_id)
        ON DELETE CASCADE
);

CREATE TABLE product_unit (
    unit_id INTEGER GENERATED ALWAYS AS IDENTITY,

    product_id INTEGER NOT NULL,

    unit_status VARCHAR(20) NOT NULL DEFAULT 'available',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT product_unit_pk
        PRIMARY KEY (unit_id),

    CONSTRAINT product_unit_status_check
        CHECK (
            unit_status IN (
                'available',
                'reserved',
                'sold'
            )
        ),

    CONSTRAINT product_unit_product_id_fk
        FOREIGN KEY (product_id)
        REFERENCES product(product_id)
        ON DELETE RESTRICT --Okay
);

COMMIT;
-- =====================================================
-- Amazon Clone Database
-- Migration: 001 - Foundation Tables
-- Description:
-- Creates independent tables that have no foreign key
-- dependencies.
-- =====================================================

BEGIN;

CREATE TABLE buyer (
    buyer_id INTEGER GENERATED ALWAYS AS IDENTITY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT buyer_pk
        PRIMARY KEY (buyer_id),

    CONSTRAINT buyer_email_unique
        UNIQUE (email)
);
COMMENT ON TABLE buyer IS
'Stores registered customer accounts.';


CREATE TABLE seller (
    seller_id INTEGER GENERATED ALWAYS AS IDENTITY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    business_address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT seller_pk
        PRIMARY KEY (seller_id),

    CONSTRAINT seller_email_unique
        UNIQUE (email)
);
COMMENT ON TABLE seller IS
'Stores seller accounts.';


CREATE TABLE category (
    category_id INTEGER GENERATED ALWAYS AS IDENTITY,

    category_name VARCHAR(100) NOT NULL,

    parent_category_id INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT category_pk
        PRIMARY KEY (category_id),

    CONSTRAINT category_name_unique
        UNIQUE (category_name),

    CONSTRAINT category_parent_category_id_fk
        FOREIGN KEY (parent_category_id)
        REFERENCES category(category_id)
        ON DELETE RESTRICT
);
COMMENT ON TABLE category IS
'Stores product categories in a hierarchical structure.';

CREATE TABLE discount (
    discount_id INTEGER GENERATED ALWAYS AS IDENTITY,

    discount_name VARCHAR(100) NOT NULL,

    discount_type VARCHAR(20) NOT NULL,

    discount_value NUMERIC(10,2) NOT NULL,

    start_date TIMESTAMPTZ NOT NULL,

    end_date TIMESTAMPTZ NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT discount_pk
        PRIMARY KEY (discount_id),

    CONSTRAINT discount_type_check
        CHECK (
            discount_type IN ('percentage', 'fixed_amount')
        ),

    CONSTRAINT discount_value_check
        CHECK (
            (
                discount_type = 'percentage'
                AND discount_value > 0
                AND discount_value <= 100
            )
            OR
            (
                discount_type = 'fixed_amount'
                AND discount_value > 0
            )
        ),

    CONSTRAINT discount_date_check
        CHECK (end_date > start_date)
);

COMMENT ON TABLE discount IS
'Stores promotional discounts that may be applied to products.';

COMMIT;
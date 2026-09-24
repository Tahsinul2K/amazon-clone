
-- Calculate the effective price of a product based on its base price and discount information

CREATE OR REPLACE FUNCTION calculate_effective_price(
    p_price NUMERIC(10,2),
    p_discount_type VARCHAR(20),
    p_discount_value NUMERIC(10,2),
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    effective_price NUMERIC(10,2);
BEGIN
    -- No discount information
    IF p_discount_type IS NULL
       OR p_discount_value IS NULL THEN

        RETURN p_price;
    END IF;

    -- Discount is not currently active
    IF p_is_active IS DISTINCT FROM TRUE
       OR CURRENT_TIMESTAMP < p_start_date
       OR CURRENT_TIMESTAMP > p_end_date THEN

        RETURN p_price;
    END IF;

    -- Percentage discount
    IF p_discount_type = 'percentage' THEN

        effective_price :=
            p_price * (1 - p_discount_value / 100);

    -- Fixed amount discount
    ELSIF p_discount_type = 'fixed_amount' THEN

        effective_price :=
            GREATEST(p_price - p_discount_value, 0);

    ELSE
        -- Unknown discount type
        RETURN p_price;
    END IF;

    RETURN ROUND(effective_price, 2);
END;
$$;
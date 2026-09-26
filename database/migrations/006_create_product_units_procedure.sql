-- Create product units through the database layer.
CREATE OR REPLACE PROCEDURE create_product_units(p_product_id INTEGER, p_stock_count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_stock_count < 0 THEN
        RAISE EXCEPTION 'Stock count cannot be negative';
    END IF;

    IF p_stock_count > 0 THEN
        INSERT INTO product_unit (product_id)
        SELECT p_product_id
        FROM generate_series(1, p_stock_count);
    END IF;
END;
$$;

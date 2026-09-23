# Amazon Clone

## Tech Stack

- Frontend: Next.js
- Backend: Express.js
- Runtime: Node.js
- Database: PostgreSQL

## Team Members

- Tahsinul Jubair Mahmud
- Mustafa Jamal Yaamlikh

## Order, Payment, Delivery Boy

## Done
- Order making and deleting the cart
- Payment tuple is being inserted
- assign delivery boy to orders (automatic)
- make an endpoint to mark an order as completed (PATCH /api/delivery/orders/:orderId/deliver)

## To Do
- let admin make a delivery boy
- a GET api for the orders so that a buyer can see their orders

## dummy categories
```
BEGIN;

-- Top-level categories
INSERT INTO category (category_name)
VALUES
    ('Electronics'),
    ('Home & Kitchen'),
    ('Clothing & Accessories'),
    ('Books'),
    ('Sports & Outdoors'),
    ('Beauty & Personal Care'),
    ('Toys & Games'),
    ('Grocery')
ON CONFLICT (category_name) DO NOTHING;

-- Child categories
INSERT INTO category (category_name, parent_category_id)
SELECT child.category_name, parent.category_id
FROM (
    VALUES
        ('Smartphones', 'Electronics'),
        ('Computers & Tablets', 'Electronics'),
        ('Audio', 'Electronics'),

        ('Kitchen & Dining', 'Home & Kitchen'),
        ('Home Decor', 'Home & Kitchen'),
        ('Furniture', 'Home & Kitchen'),

        ('Men''s Clothing', 'Clothing & Accessories'),
        ('Women''s Clothing', 'Clothing & Accessories'),
        ('Shoes', 'Clothing & Accessories'),

        ('Fiction', 'Books'),
        ('Non-Fiction', 'Books'),
        ('Educational', 'Books'),

        ('Fitness', 'Sports & Outdoors'),
        ('Camping & Hiking', 'Sports & Outdoors'),
        ('Team Sports', 'Sports & Outdoors'),

        ('Skin Care', 'Beauty & Personal Care'),
        ('Hair Care', 'Beauty & Personal Care'),
        ('Makeup', 'Beauty & Personal Care'),

        ('Board Games', 'Toys & Games'),
        ('Puzzles', 'Toys & Games'),
        ('Action Figures', 'Toys & Games'),

        ('Snacks', 'Grocery'),
        ('Beverages', 'Grocery'),
        ('Pantry Staples', 'Grocery')
) AS child(category_name, parent_name)
JOIN category AS parent
    ON parent.category_name = child.parent_name
ON CONFLICT (category_name) DO NOTHING;

COMMIT;

-- Verify the hierarchy
SELECT
    child.category_id,
    child.category_name,
    parent.category_name AS parent_category
FROM category AS child
LEFT JOIN category AS parent
    ON parent.category_id = child.parent_category_id
ORDER BY parent.category_name NULLS FIRST, child.category_name;

```

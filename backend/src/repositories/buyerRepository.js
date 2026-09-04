import pool from "../config/db.js";

export async function findBuyerById(buyerId) {
    const result = await pool.query(
        `
        SELECT buyer_id, full_name, email, created_at
        FROM buyer
        WHERE buyer_id = $1
        `,
        [buyerId]
    );

    return result.rows[0] || null;
}
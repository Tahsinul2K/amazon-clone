import "dotenv/config";
import app from "./app.js";
import pool from "./config/db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        const result = await pool.query("SELECT current_database();");

        console.log(
            `✅ Connected to PostgreSQL database: ${result.rows[0].current_database}`
        );

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to connect to PostgreSQL");
        console.error(error);
        process.exit(1);
    }
}

startServer();
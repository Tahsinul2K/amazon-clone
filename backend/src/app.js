import express from "express";
import cors from "cors";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Temporary test route
app.get("/", (req, res) => {
    res.json({
        message: "Backend is running successfully!"
    });
});

export default app;
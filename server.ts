import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sql from "mssql";
import type { Receipt } from "./src/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envMode = process.env.NODE_ENV === "production" ? "production" : "development";

dotenv.config({ path: path.resolve(process.cwd(), `.env.${envMode}`) });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(`AZURE_SQL_CONNECTION_STRING is required in .env.${envMode} or the process environment`);
  }

  const pool = await sql.connect(connectionString);
  console.log("Connected to Azure SQL Database");
  
  // Basic table check/creation
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Receipts' AND xtype='U')
    CREATE TABLE Receipts (
      id NVARCHAR(50) PRIMARY KEY,
      merchant NVARCHAR(255),
      date NVARCHAR(50),
      total FLOAT,
      currency NVARCHAR(10),
      category NVARCHAR(50),
      tags NVARCHAR(MAX),
      items NVARCHAR(MAX),
      createdAt NVARCHAR(50),
      imageUrl NVARCHAR(MAX),
      box_2d NVARCHAR(255)
    )

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AppSettings' AND xtype='U')
    CREATE TABLE AppSettings (
      keyName NVARCHAR(50) PRIMARY KEY,
      value NVARCHAR(MAX)
    )
  `);

  // API Routes for settings
  app.get("/api/settings/budget", async (req, res) => {
    try {
      const result = await pool.request().input('key', sql.NVarChar, 'monthly_budget').query("SELECT value FROM AppSettings WHERE keyName = @key");
      res.json({ budget: result.recordset[0]?.value || "1000" });
    } catch {
      res.status(500).json({ error: "Failed to load budget" });
    }
  });

  app.post("/api/settings/budget", async (req, res) => {
    try {
      const { budget } = req.body;
      await pool.request()
        .input('key', sql.NVarChar, 'monthly_budget')
        .input('val', sql.NVarChar, budget.toString())
        .query(`
          IF EXISTS (SELECT * FROM AppSettings WHERE keyName = @key)
            UPDATE AppSettings SET value = @val WHERE keyName = @key
          ELSE
            INSERT INTO AppSettings (keyName, value) VALUES (@key, @val)
        `);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to save budget" });
    }
  });

  // API Routes
  app.get("/api/receipts", async (req, res) => {
    try {
      const result = await pool.request().query("SELECT * FROM Receipts ORDER BY createdAt DESC");
      const formatted = result.recordset.map(r => ({
        ...r,
        tags: JSON.parse(r.tags || '[]'),
        items: JSON.parse(r.items || '[]'),
        box_2d: JSON.parse(r.box_2d || 'null')
      }));
      res.json(formatted);
    } catch {
      res.status(500).json({ error: "Failed to read receipts" });
    }
  });

  app.post("/api/receipts", async (req, res) => {
    try {
      const { receipt } = req.body as { receipt: Receipt };
      const isUpdate = receipt.id && !receipt.id.startsWith('temp-');

      if (isUpdate) {
        await pool.request()
          .input('id', sql.NVarChar, receipt.id)
          .input('merchant', sql.NVarChar, receipt.merchant)
          .input('date', sql.NVarChar, receipt.date)
          .input('total', sql.Float, receipt.total)
          .input('currency', sql.NVarChar, receipt.currency)
          .input('category', sql.NVarChar, receipt.category)
          .input('tags', sql.NVarChar, JSON.stringify(receipt.tags || []))
          .input('items', sql.NVarChar, JSON.stringify(receipt.items || []))
          .input('imageUrl', sql.NVarChar, receipt.imageUrl || '')
          .input('box_2d', sql.NVarChar, JSON.stringify(receipt.box_2d || null))
          .query(`
            UPDATE Receipts SET 
              merchant = @merchant,
              date = @date,
              total = @total,
              currency = @currency,
              category = @category,
              tags = @tags,
              items = @items,
              imageUrl = @imageUrl,
              box_2d = @box_2d
            WHERE id = @id
          `);
        return res.json(receipt);
      } else {
        const newId = !receipt.id || receipt.id.startsWith('temp-') ? Date.now().toString() : receipt.id;
        await pool.request()
          .input('id', sql.NVarChar, newId)
          .input('merchant', sql.NVarChar, receipt.merchant)
          .input('date', sql.NVarChar, receipt.date)
          .input('total', sql.Float, receipt.total)
          .input('currency', sql.NVarChar, receipt.currency)
          .input('category', sql.NVarChar, receipt.category)
          .input('tags', sql.NVarChar, JSON.stringify(receipt.tags || []))
          .input('items', sql.NVarChar, JSON.stringify(receipt.items || []))
          .input('createdAt', sql.NVarChar, receipt.createdAt)
          .input('imageUrl', sql.NVarChar, receipt.imageUrl || '')
          .input('box_2d', sql.NVarChar, JSON.stringify(receipt.box_2d || null))
          .query(`
            INSERT INTO Receipts (id, merchant, date, total, currency, category, tags, items, createdAt, imageUrl, box_2d)
            VALUES (@id, @merchant, @date, @total, @currency, @category, @tags, @items, @createdAt, @imageUrl, @box_2d)
          `);
        return res.status(201).json({ ...receipt, id: newId });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save receipt" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.request().input('id', sql.NVarChar, id).query("DELETE FROM Receipts WHERE id = @id");
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

import sql from 'mssql';
import type { PaymentRule, Receipt, ReceiptCategory } from '../shared/types.js';

const DEFAULT_CATEGORIES = [
  'Essen',
  'Verkehr',
  'Einkaufen',
  'Unterhaltung',
  'Gesundheit',
  'Nebenkosten',
  'Lionas',
  'Malias',
  'Sonstiges',
];

const DEFAULT_PAYMENT_RULES: Array<
  Pick<PaymentRule, 'name' | 'frequency'>
> = [
  { name: 'One Time', frequency: 'one_time' },
  { name: 'Monthly', frequency: 'monthly' },
  { name: 'Yearly', frequency: 'yearly' },
];

function mapReceiptRecord(record: any): Receipt {
  return {
    id: record.id,
    merchant: record.merchant,
    date: record.date,
    total: record.total,
    currency: record.currency,
    categoryId: record.categoryId,
    categoryName: record.categoryName,
    paymentRuleId: record.paymentRuleId,
    paymentRuleName: record.paymentRuleName,
    paymentRuleFrequency: record.paymentRuleFrequency,
    tags: JSON.parse(record.tags || '[]'),
    items: JSON.parse(record.items || '[]'),
    createdAt: record.createdAt,
    imageUrl: record.imageUrl || undefined,
    box_2d: JSON.parse(record.box_2d || 'null') ?? undefined,
  };
}

async function ensureSchema(pool: sql.ConnectionPool) {
  const seededCategories = DEFAULT_CATEGORIES.map(
    (category) => `('${category.replace(/'/g, "''")}')`,
  ).join(', ');
  const seededPaymentRules = DEFAULT_PAYMENT_RULES.map(
    (rule) =>
      `('${rule.name.replace(/'/g, "''")}', '${rule.frequency.replace(/'/g, "''")}')`,
  ).join(', ');

  await pool.request().query(`
    IF OBJECT_ID('dbo.Categories', 'U') IS NULL
    BEGIN
      CREATE TABLE Categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL
      )
    END

    IF OBJECT_ID('dbo.Receipts', 'U') IS NULL
    BEGIN
      CREATE TABLE Receipts (
        id NVARCHAR(50) PRIMARY KEY,
        merchant NVARCHAR(255),
        date NVARCHAR(50),
        total FLOAT,
        currency NVARCHAR(10),
        categoryId INT NULL,
        paymentRuleId INT NULL,
        tags NVARCHAR(MAX),
        items NVARCHAR(MAX),
        createdAt NVARCHAR(50),
        imageUrl NVARCHAR(MAX),
        box_2d NVARCHAR(255)
      )
    END

    IF OBJECT_ID('dbo.AppSettings', 'U') IS NULL
    BEGIN
      CREATE TABLE AppSettings (
        keyName NVARCHAR(50) PRIMARY KEY,
        value NVARCHAR(MAX)
      )
    END

    IF OBJECT_ID('dbo.PaymentRules', 'U') IS NULL
    BEGIN
      CREATE TABLE PaymentRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        frequency NVARCHAR(20) NOT NULL
      )
    END

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'UQ_Categories_Name'
        AND object_id = OBJECT_ID('dbo.Categories')
    )
    BEGIN
      CREATE UNIQUE INDEX UQ_Categories_Name ON Categories(name)
    END

    INSERT INTO Categories (name)
    SELECT seeded.name
    FROM (VALUES ${seededCategories}) AS seeded(name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM Categories existing
      WHERE existing.name = seeded.name
    )

    INSERT INTO PaymentRules (name, frequency)
    SELECT seeded.name, seeded.frequency
    FROM (VALUES ${seededPaymentRules}) AS seeded(name, frequency)
    WHERE NOT EXISTS (
      SELECT 1
      FROM PaymentRules existing
      WHERE existing.frequency = seeded.frequency
    )

    IF COL_LENGTH('dbo.Receipts', 'categoryId') IS NULL
    BEGIN
      ALTER TABLE Receipts ADD categoryId INT NULL
    END

    IF COL_LENGTH('dbo.Receipts', 'paymentRuleId') IS NULL
    BEGIN
      ALTER TABLE Receipts ADD paymentRuleId INT NULL
    END

    IF COL_LENGTH('dbo.Receipts', 'category') IS NOT NULL
    BEGIN
      EXEC sp_executesql N'
        INSERT INTO Categories (name)
        SELECT DISTINCT LTRIM(RTRIM(category))
        FROM Receipts
        WHERE category IS NOT NULL
          AND LTRIM(RTRIM(category)) <> ''''
          AND NOT EXISTS (
            SELECT 1
            FROM Categories
            WHERE Categories.name = LTRIM(RTRIM(Receipts.category))
          );
      '

      EXEC sp_executesql N'
        UPDATE Receipts
        SET categoryId = Categories.id
        FROM Receipts
        INNER JOIN Categories
          ON Categories.name = LTRIM(RTRIM(Receipts.category))
        WHERE Receipts.categoryId IS NULL;
      '
    END

    EXEC sp_executesql N'
      UPDATE Receipts
      SET categoryId = (
        SELECT TOP 1 id
        FROM Categories
        WHERE name = ''Sonstiges''
      )
      WHERE categoryId IS NULL;
    '

    EXEC sp_executesql N'
      UPDATE Receipts
      SET paymentRuleId = (
        SELECT TOP 1 id
        FROM PaymentRules
        WHERE frequency = ''one_time''
      )
      WHERE paymentRuleId IS NULL;
    '

    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'FK_Receipts_Categories'
    )
    BEGIN
      ALTER TABLE Receipts WITH CHECK
      ADD CONSTRAINT FK_Receipts_Categories
      FOREIGN KEY (categoryId) REFERENCES Categories(id)
    END

    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'FK_Receipts_PaymentRules'
    )
    BEGIN
      ALTER TABLE Receipts WITH CHECK
      ADD CONSTRAINT FK_Receipts_PaymentRules
      FOREIGN KEY (paymentRuleId) REFERENCES PaymentRules(id)
    END

    IF EXISTS (
      SELECT 1
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.Receipts')
        AND name = 'categoryId'
        AND is_nullable = 1
    )
    BEGIN
      ALTER TABLE Receipts ALTER COLUMN categoryId INT NOT NULL
    END

    IF EXISTS (
      SELECT 1
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.Receipts')
        AND name = 'paymentRuleId'
        AND is_nullable = 1
    )
    BEGIN
      ALTER TABLE Receipts ALTER COLUMN paymentRuleId INT NOT NULL
    END

    IF COL_LENGTH('dbo.Receipts', 'category') IS NOT NULL
    BEGIN
      ALTER TABLE Receipts DROP COLUMN category
    END
  `);
}

export async function initializeDatabase(connectionString: string) {
  const pool = await sql.connect(connectionString);
  await ensureSchema(pool);
  return pool;
}

export async function getBudget(pool: sql.ConnectionPool) {
  const result = await pool
    .request()
    .input('key', sql.NVarChar, 'monthly_budget')
    .query('SELECT value FROM AppSettings WHERE keyName = @key');

  return result.recordset[0]?.value || '1000';
}

export async function updateBudget(
  pool: sql.ConnectionPool,
  budget: number | string,
) {
  await pool
    .request()
    .input('key', sql.NVarChar, 'monthly_budget')
    .input('val', sql.NVarChar, budget.toString()).query(`
      IF EXISTS (SELECT * FROM AppSettings WHERE keyName = @key)
        UPDATE AppSettings SET value = @val WHERE keyName = @key
      ELSE
        INSERT INTO AppSettings (keyName, value) VALUES (@key, @val)
    `);
}

export async function listReceiptCategories(pool: sql.ConnectionPool) {
  const result = await pool
    .request()
    .query('SELECT id, name FROM Categories ORDER BY name ASC');
  return result.recordset as ReceiptCategory[];
}

export async function listPaymentRules(pool: sql.ConnectionPool) {
  const result = await pool.request().query(`
    SELECT id, name, frequency
    FROM PaymentRules
    ORDER BY
      CASE frequency
        WHEN 'one_time' THEN 1
        WHEN 'monthly' THEN 2
        WHEN 'yearly' THEN 3
        ELSE 4
      END
  `);
  return result.recordset as PaymentRule[];
}

export async function saveCategory(
  pool: sql.ConnectionPool,
  category: Partial<ReceiptCategory> & Pick<ReceiptCategory, 'name'>,
) {
  const normalizedName = category.name.trim();

  if (category.id) {
    const updateResult = await pool
      .request()
      .input('id', sql.Int, category.id)
      .input('name', sql.NVarChar, normalizedName).query(`
        UPDATE Categories
        SET name = @name
        WHERE id = @id

        SELECT id, name
        FROM Categories
        WHERE id = @id
      `);

    return updateResult.recordset[0] as ReceiptCategory;
  }

  const insertResult = await pool
    .request()
    .input('name', sql.NVarChar, normalizedName).query(`
      INSERT INTO Categories (name)
      OUTPUT INSERTED.id, INSERTED.name
      VALUES (@name)
    `);

  return insertResult.recordset[0] as ReceiptCategory;
}

export async function countReceiptsByCategory(
  pool: sql.ConnectionPool,
  categoryId: number,
) {
  const result = await pool
    .request()
    .input('id', sql.Int, categoryId)
    .query('SELECT COUNT(*) AS count FROM Receipts WHERE categoryId = @id');

  return result.recordset[0]?.count ?? 0;
}

export async function deleteCategory(
  pool: sql.ConnectionPool,
  categoryId: number,
) {
  await pool
    .request()
    .input('id', sql.Int, categoryId)
    .query('DELETE FROM Categories WHERE id = @id');
}

export async function listReceipts(pool: sql.ConnectionPool) {
  const result = await pool.request().query(`
    SELECT
      Receipts.id,
      Receipts.merchant,
      Receipts.date,
      Receipts.total,
      Receipts.currency,
      Receipts.categoryId,
      Categories.name AS categoryName,
      Receipts.paymentRuleId,
      PaymentRules.name AS paymentRuleName,
      PaymentRules.frequency AS paymentRuleFrequency,
      Receipts.tags,
      Receipts.items,
      Receipts.createdAt,
      Receipts.imageUrl,
      Receipts.box_2d
    FROM Receipts
    INNER JOIN Categories ON Categories.id = Receipts.categoryId
    INNER JOIN PaymentRules ON PaymentRules.id = Receipts.paymentRuleId
    ORDER BY Receipts.createdAt DESC
  `);

  return result.recordset.map(mapReceiptRecord);
}

export async function getReceiptById(pool: sql.ConnectionPool, id: string) {
  const result = await pool.request().input('id', sql.NVarChar, id).query(`
    SELECT
      Receipts.id,
      Receipts.merchant,
      Receipts.date,
      Receipts.total,
      Receipts.currency,
      Receipts.categoryId,
      Categories.name AS categoryName,
      Receipts.paymentRuleId,
      PaymentRules.name AS paymentRuleName,
      PaymentRules.frequency AS paymentRuleFrequency,
      Receipts.tags,
      Receipts.items,
      Receipts.createdAt,
      Receipts.imageUrl,
      Receipts.box_2d
    FROM Receipts
    INNER JOIN Categories ON Categories.id = Receipts.categoryId
    INNER JOIN PaymentRules ON PaymentRules.id = Receipts.paymentRuleId
    WHERE Receipts.id = @id
  `);

  const record = result.recordset[0];
  return record ? mapReceiptRecord(record) : null;
}

export async function saveReceipt(pool: sql.ConnectionPool, receipt: Receipt) {
  const isUpdate = receipt.id && !receipt.id.startsWith('temp-');

  if (isUpdate) {
    await pool
      .request()
      .input('id', sql.NVarChar, receipt.id)
      .input('merchant', sql.NVarChar, receipt.merchant)
      .input('date', sql.NVarChar, receipt.date)
      .input('total', sql.Float, receipt.total)
      .input('currency', sql.NVarChar, receipt.currency)
      .input('categoryId', sql.Int, receipt.categoryId)
      .input('paymentRuleId', sql.Int, receipt.paymentRuleId)
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
          categoryId = @categoryId,
          paymentRuleId = @paymentRuleId,
          tags = @tags,
          items = @items,
          imageUrl = @imageUrl,
          box_2d = @box_2d
        WHERE id = @id
      `);

    return getReceiptById(pool, receipt.id);
  }

  const newId =
    !receipt.id || receipt.id.startsWith('temp-')
      ? Date.now().toString()
      : receipt.id;

  await pool
    .request()
    .input('id', sql.NVarChar, newId)
    .input('merchant', sql.NVarChar, receipt.merchant)
    .input('date', sql.NVarChar, receipt.date)
    .input('total', sql.Float, receipt.total)
    .input('currency', sql.NVarChar, receipt.currency)
    .input('categoryId', sql.Int, receipt.categoryId)
    .input('paymentRuleId', sql.Int, receipt.paymentRuleId)
    .input('tags', sql.NVarChar, JSON.stringify(receipt.tags || []))
    .input('items', sql.NVarChar, JSON.stringify(receipt.items || []))
    .input('createdAt', sql.NVarChar, receipt.createdAt)
    .input('imageUrl', sql.NVarChar, receipt.imageUrl || '')
    .input('box_2d', sql.NVarChar, JSON.stringify(receipt.box_2d || null))
    .query(`
      INSERT INTO Receipts (
        id,
        merchant,
        date,
        total,
        currency,
        categoryId,
        paymentRuleId,
        tags,
        items,
        createdAt,
        imageUrl,
        box_2d
      )
      VALUES (
        @id,
        @merchant,
        @date,
        @total,
        @currency,
        @categoryId,
        @paymentRuleId,
        @tags,
        @items,
        @createdAt,
        @imageUrl,
        @box_2d
      )
    `);

  return getReceiptById(pool, newId);
}

export async function deleteReceipt(
  pool: sql.ConnectionPool,
  receiptId: string,
) {
  await pool
    .request()
    .input('id', sql.NVarChar, receiptId)
    .query('DELETE FROM Receipts WHERE id = @id');
}

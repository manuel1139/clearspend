import sql from 'mssql';
import type {
  KontoEntry,
  PaymentRule,
  Receipt,
  ReceiptCategory,
} from '../shared/types.js';

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

function mapReceiptRecord(record: unknown): Receipt {
  const r = record as Record<string, unknown>;
  return {
    id: String(r.id),
    merchant: String(r.merchant),
    date: String(r.date),
    total: Number(r.total),
    currency: String(r.currency),
    categoryId: Number(r.categoryId),
    categoryName: String(r.categoryName),
    paymentRuleId: Number(r.paymentRuleId),
    paymentRuleName: String(r.paymentRuleName),
    paymentRuleFrequency: r.paymentRuleFrequency as Receipt['paymentRuleFrequency'],
    tags: JSON.parse(String(r.tags || '[]')),
    items: JSON.parse(String(r.items || '[]')),
    createdAt: String(r.createdAt),
    imageUrl: (r.imageUrl as string) || undefined,
    box_2d: JSON.parse(String(r.box_2d || 'null')) ?? undefined,
    kontoEntryId: (r.kontoEntryId as string) || undefined,
    kontoReference: (r.kontoReference as string) || undefined,
  };
}

function mapKontoEntryRecord(record: unknown): KontoEntry {
  const r = record as Record<string, unknown>;
  return {
    id: String(r.id),
    bookingDate: String(r.bookingDate),
    valueDate: (r.valueDate as string) || undefined,
    amount: Number(r.amount),
    currency: String(r.currency),
    counterpartyName: String(r.counterpartyName),
    reference: String(r.reference),
    categoryId: r.categoryId ? Number(r.categoryId) : undefined,
    categoryName: (r.categoryName as string) || undefined,
    categoryType: (r.categoryType as 'ai-generated' | 'manually' | 'by-filter') || undefined,
    counterpartyId: (r.counterpartyId as string) || undefined,
    endToEndId: (r.endToEndId as string) || undefined,
    remittanceInfo: (r.remittanceInfo as string) || undefined,
    sourceFileName: (r.sourceFileName as string) || undefined,
    createdAt: String(r.createdAt),
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
        name NVARCHAR(100) NOT NULL,
        displayOrder INT DEFAULT 0
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

    IF OBJECT_ID('dbo.KontoEntries', 'U') IS NULL
    BEGIN
      CREATE TABLE KontoEntries (
        id NVARCHAR(80) PRIMARY KEY,
        bookingDate NVARCHAR(50) NOT NULL,
        valueDate NVARCHAR(50),
        amount FLOAT NOT NULL,
        currency NVARCHAR(10),
        counterpartyName NVARCHAR(255),
        reference NVARCHAR(MAX),
        counterpartyId NVARCHAR(255),
        endToEndId NVARCHAR(255),
        remittanceInfo NVARCHAR(MAX),
        sourceFileName NVARCHAR(255),
        createdAt NVARCHAR(50) NOT NULL
      )
    END

    IF OBJECT_ID('dbo.CategoryRules', 'U') IS NULL
    BEGIN
      CREATE TABLE CategoryRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        pattern NVARCHAR(255) NOT NULL,
        ruleType NVARCHAR(50) DEFAULT 'text',
        categoryId INT NOT NULL,
        CONSTRAINT FK_Rules_Categories FOREIGN KEY (categoryId) REFERENCES Categories(id) ON DELETE CASCADE
      )
    END

    IF COL_LENGTH('dbo.CategoryRules', 'ruleType') IS NULL
    BEGIN
      ALTER TABLE CategoryRules ADD ruleType NVARCHAR(50) DEFAULT 'text'
    END

    IF COL_LENGTH('dbo.KontoEntries', 'categoryId') IS NULL
    BEGIN
      ALTER TABLE KontoEntries ADD categoryId INT NULL;
      ALTER TABLE KontoEntries ADD CONSTRAINT FK_KontoEntries_Categories FOREIGN KEY (categoryId) REFERENCES Categories(id);
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

    IF COL_LENGTH('dbo.Receipts', 'kontoEntryId') IS NULL
    BEGIN
      ALTER TABLE Receipts ADD kontoEntryId NVARCHAR(80) NULL
    END

    IF COL_LENGTH('dbo.Receipts', 'kontoReference') IS NULL
    BEGIN
      ALTER TABLE Receipts ADD kontoReference NVARCHAR(MAX) NULL
    END

    IF COL_LENGTH('dbo.KontoEntries', 'categoryType') IS NULL
    BEGIN
      ALTER TABLE KontoEntries ADD categoryType NVARCHAR(50) NULL;
    END

    IF COL_LENGTH('dbo.Categories', 'displayOrder') IS NULL
    BEGIN
      ALTER TABLE Categories ADD displayOrder INT DEFAULT 0
    END

    IF COL_LENGTH('dbo.KontoEntries', 'counterpartyId') IS NULL
    BEGIN
      ALTER TABLE KontoEntries ADD counterpartyId NVARCHAR(255) NULL
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

    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = 'FK_Receipts_KontoEntries'
    )
    BEGIN
      ALTER TABLE Receipts WITH NOCHECK
      ADD CONSTRAINT FK_Receipts_KontoEntries
      FOREIGN KEY (kontoEntryId) REFERENCES KontoEntries(id)
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
  if (process.env.NODE_ENV === 'production') {
    console.log('[Backend] Initializing in production mode');
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      console.warn('[Backend] WARNING: GEMINI_API_KEY is missing or empty in environment variables.');
    } else {
      console.log(`[Backend] GEMINI_API_KEY detected (length: ${key.length}).`);
    }
  }

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
    .query('SELECT id, name, displayOrder FROM Categories ORDER BY displayOrder ASC, name ASC');
  return result.recordset as ReceiptCategory[];
}

export async function listKontoEntries(pool: sql.ConnectionPool) {
  const result = await pool.request().query(`
    SELECT
      id,
      bookingDate,
      valueDate,
      amount,
      currency,
      counterpartyName,
      KontoEntries.categoryId,
      Categories.name AS categoryName,
      categoryType,
      reference,
      counterpartyId,
      endToEndId,
      remittanceInfo,
      sourceFileName,
      KontoEntries.createdAt
    FROM KontoEntries
    LEFT JOIN Categories ON Categories.id = KontoEntries.categoryId
    ORDER BY bookingDate DESC, createdAt DESC
  `);

  return result.recordset.map(mapKontoEntryRecord);
}

export async function saveKontoEntries(
  pool: sql.ConnectionPool,
  entries: KontoEntry[],
) {
  const savedEntries: KontoEntry[] = [];

  // Load rules for auto-categorization
  const rulesResult = await pool.request().query('SELECT pattern, ruleType, categoryId FROM CategoryRules');
  const rules = rulesResult.recordset as { pattern: string; ruleType: string; categoryId: number }[];

  for (const entry of entries) {
    // Default categorization logic via rules
    let targetCategoryId = entry.categoryId;
    let targetCategoryType = entry.categoryType;

    if (!targetCategoryId) {
      const rule = rules.find(r => {
        if (r.ruleType === 'account') {
          return entry.counterpartyId === r.pattern;
        }
        // Default: text matching
        const matchStr = `${entry.counterpartyName} ${entry.reference} ${entry.remittanceInfo}`.toLowerCase();
        return matchStr.includes(r.pattern.toLowerCase());
      });

      if (rule) {
        targetCategoryId = rule.categoryId;
        targetCategoryType = 'by-filter';
      } else {
        // Fallback to "Sonstiges"
        const sonstiges = await pool.request().query("SELECT id FROM Categories WHERE name = 'Sonstiges'");
        targetCategoryId = sonstiges.recordset[0]?.id;
      }
    }

    const result = await pool
      .request()
      .input('id', sql.NVarChar, entry.id)
      .input('bookingDate', sql.NVarChar, entry.bookingDate)
      .input('valueDate', sql.NVarChar, entry.valueDate || '')
      .input('amount', sql.Float, entry.amount)
      .input('currency', sql.NVarChar, entry.currency)
      .input('counterpartyName', sql.NVarChar, entry.counterpartyName)
      .input('reference', sql.NVarChar, entry.reference)
      .input('counterpartyId', sql.NVarChar, entry.counterpartyId || '')
      .input('endToEndId', sql.NVarChar, entry.endToEndId || '')
      .input('remittanceInfo', sql.NVarChar, entry.remittanceInfo || '')
      .input('sourceFileName', sql.NVarChar, entry.sourceFileName || '')
      .input('categoryId', sql.Int, targetCategoryId)
      .input('categoryType', sql.NVarChar, targetCategoryType || null)
      .input('createdAt', sql.NVarChar, entry.createdAt).query(`
        IF EXISTS (SELECT 1 FROM KontoEntries WHERE id = @id)
        BEGIN
          UPDATE KontoEntries
          SET
            bookingDate = @bookingDate,
            valueDate = @valueDate,
            amount = @amount,
            currency = @currency,
            counterpartyName = @counterpartyName,
            reference = @reference,
            counterpartyId = @counterpartyId,
            endToEndId = @endToEndId,
            remittanceInfo = @remittanceInfo,
            categoryId = CASE WHEN KontoEntries.categoryType = 'manually' THEN KontoEntries.categoryId ELSE COALESCE(KontoEntries.categoryId, @categoryId) END,
            categoryType = CASE WHEN KontoEntries.categoryType = 'manually' THEN 'manually' ELSE COALESCE(KontoEntries.categoryType, @categoryType) END,
            sourceFileName = @sourceFileName
          WHERE id = @id
        END
        ELSE
        BEGIN
          INSERT INTO KontoEntries (
            id,
            bookingDate,
            valueDate,
            amount,
            currency,
            counterpartyName,
            reference,
            counterpartyId,
            endToEndId,
            remittanceInfo,
            sourceFileName,
            categoryId,
            categoryType,
            createdAt
          )
          VALUES (
            @id,
            @bookingDate,
            @valueDate,
            @amount,
            @currency,
            @counterpartyName,
            @reference,
            @counterpartyId,
            @endToEndId,
            @remittanceInfo,
            @sourceFileName,
            @categoryId,
            @categoryType,
            @createdAt
          )
        END

        SELECT
          id,
          bookingDate,
          valueDate,
          amount,
          currency,
          counterpartyName,
          reference,
          KontoEntries.categoryId,
          Categories.name AS categoryName,
          categoryType,
          counterpartyId,
          endToEndId,
          remittanceInfo,
          sourceFileName,
          KontoEntries.createdAt
        FROM KontoEntries
        LEFT JOIN Categories ON Categories.id = KontoEntries.categoryId
        WHERE id = @id
      `);

    savedEntries.push(mapKontoEntryRecord(result.recordset[0]));
  }

  return savedEntries;
}

export async function updateKontoEntryCategory(pool: sql.ConnectionPool, id: string, categoryId: number, type: string = 'manually') {
  await pool
    .request()
    .input('id', sql.NVarChar, id)
    .input('catId', sql.Int, categoryId)
    .input('type', sql.NVarChar, type)
    .query('UPDATE KontoEntries SET categoryId = @catId, categoryType = @type WHERE id = @id');
    
  return true;
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

export async function updateCategoriesOrder(
  pool: sql.ConnectionPool,
  orders: { id: number; displayOrder: number }[],
) {
  for (const item of orders) {
    await pool
      .request()
      .input('id', sql.Int, item.id)
      .input('order', sql.Int, item.displayOrder).query(`
        UPDATE Categories
        SET displayOrder = @order
        WHERE id = @id
      `);
  }
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
      Receipts.box_2d,
      Receipts.kontoEntryId,
      Receipts.kontoReference
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
      Receipts.box_2d,
      Receipts.kontoEntryId,
      Receipts.kontoReference
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
      .input('kontoEntryId', sql.NVarChar, receipt.kontoEntryId || '')
      .input('kontoReference', sql.NVarChar, receipt.kontoReference || '')
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
          box_2d = @box_2d,
          kontoEntryId = NULLIF(@kontoEntryId, ''),
          kontoReference = NULLIF(@kontoReference, '')
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
    .input('kontoEntryId', sql.NVarChar, receipt.kontoEntryId || '')
    .input('kontoReference', sql.NVarChar, receipt.kontoReference || '')
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
        box_2d,
        kontoEntryId,
        kontoReference
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
        @box_2d,
        NULLIF(@kontoEntryId, ''),
        NULLIF(@kontoReference, '')
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

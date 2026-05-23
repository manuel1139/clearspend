/*
  Temporary cleanup script for imported Amazon receipts.

  What it does:
  1. Deletes duplicate Amazon CSV receipts by `Order: <id>` tag, keeping the newest row.
  2. Deletes refunded / returned Amazon orders from a manually maintained list of order IDs.
  3. Rebuilds Amazon `items` JSON to remove duplicate line items and obvious refund/return placeholders.

  Review the preview queries first.
  Run inside a transaction.
  Commit only after checking the result sets.
*/

BEGIN TRANSACTION;

DECLARE @RefundedAmazonOrders TABLE (
  orderId NVARCHAR(100) PRIMARY KEY
);

/*
  Paste known refunded / returned Amazon order IDs here before running the delete block.
  Example:

  INSERT INTO @RefundedAmazonOrders (orderId)
  VALUES
    ('304-1234567-1234567'),
    ('D01-1234567-1234567');
*/

;WITH AmazonReceipts AS (
  SELECT
    r.id,
    r.createdAt,
    r.merchant,
    r.date,
    r.total,
    r.tags,
    r.items,
    orderTag.orderTag
  FROM Receipts r
  OUTER APPLY (
    SELECT TOP (1) [value] AS orderTag
    FROM OPENJSON(COALESCE(r.tags, '[]'))
    WHERE [value] LIKE 'Order: %'
  ) orderTag
  WHERE EXISTS (
    SELECT 1
    FROM OPENJSON(COALESCE(r.tags, '[]'))
    WHERE [value] = 'Amazon CSV'
  )
)
SELECT
  orderTag,
  COUNT(*) AS duplicateCount,
  MIN(createdAt) AS oldestCreatedAt,
  MAX(createdAt) AS newestCreatedAt
FROM AmazonReceipts
WHERE orderTag IS NOT NULL
GROUP BY orderTag
HAVING COUNT(*) > 1
ORDER BY duplicateCount DESC, orderTag;

;WITH AmazonReceipts AS (
  SELECT
    r.id,
    r.createdAt,
    orderTag.orderTag
  FROM Receipts r
  OUTER APPLY (
    SELECT TOP (1) [value] AS orderTag
    FROM OPENJSON(COALESCE(r.tags, '[]'))
    WHERE [value] LIKE 'Order: %'
  ) orderTag
  WHERE EXISTS (
    SELECT 1
    FROM OPENJSON(COALESCE(r.tags, '[]'))
    WHERE [value] = 'Amazon CSV'
  )
),
RankedDuplicates AS (
  SELECT
    id,
    orderTag,
    ROW_NUMBER() OVER (
      PARTITION BY orderTag
      ORDER BY createdAt DESC, id DESC
    ) AS rowNum
  FROM AmazonReceipts
  WHERE orderTag IS NOT NULL
)
DELETE r
FROM Receipts r
INNER JOIN RankedDuplicates d
  ON d.id = r.id
WHERE d.rowNum > 1;

SELECT
  r.id,
  r.createdAt,
  r.merchant,
  r.date,
  r.total,
  orderTag.orderTag
FROM Receipts r
OUTER APPLY (
  SELECT TOP (1) REPLACE([value], 'Order: ', '') AS orderTag
  FROM OPENJSON(COALESCE(r.tags, '[]'))
  WHERE [value] LIKE 'Order: %'
) orderTag
WHERE EXISTS (
  SELECT 1
  FROM OPENJSON(COALESCE(r.tags, '[]'))
  WHERE [value] = 'Amazon CSV'
)
AND orderTag.orderTag IN (SELECT orderId FROM @RefundedAmazonOrders)
ORDER BY r.createdAt DESC;

DELETE r
FROM Receipts r
OUTER APPLY (
  SELECT TOP (1) REPLACE([value], 'Order: ', '') AS orderTag
  FROM OPENJSON(COALESCE(r.tags, '[]'))
  WHERE [value] LIKE 'Order: %'
) orderTag
WHERE EXISTS (
  SELECT 1
  FROM OPENJSON(COALESCE(r.tags, '[]'))
  WHERE [value] = 'Amazon CSV'
)
AND orderTag.orderTag IN (SELECT orderId FROM @RefundedAmazonOrders);

;WITH AmazonReceipts AS (
  SELECT r.id, r.items
  FROM Receipts r
  WHERE EXISTS (
    SELECT 1
    FROM OPENJSON(COALESCE(r.tags, '[]'))
    WHERE [value] = 'Amazon CSV'
  )
),
ExpandedItems AS (
  SELECT
    r.id,
    LTRIM(RTRIM(j.name)) AS itemName,
    TRY_CAST(j.price AS FLOAT) AS price,
    TRY_CAST(j.quantity AS INT) AS quantity,
    j.imageUrl
  FROM AmazonReceipts r
  CROSS APPLY OPENJSON(COALESCE(r.items, '[]'))
  WITH (
    name NVARCHAR(4000) '$.name',
    price NVARCHAR(100) '$.price',
    quantity NVARCHAR(100) '$.quantity',
    imageUrl NVARCHAR(MAX) '$.imageUrl'
  ) j
),
FilteredItems AS (
  SELECT
    id,
    itemName,
    COALESCE(price, 0) AS price,
    NULLIF(COALESCE(quantity, 1), 0) AS quantity,
    imageUrl
  FROM ExpandedItems
  WHERE itemName IS NOT NULL
    AND itemName <> ''
    AND LOWER(itemName) NOT LIKE '%refund%'
    AND LOWER(itemName) NOT LIKE '%refunded%'
    AND LOWER(itemName) NOT LIKE '%return%'
    AND LOWER(itemName) NOT LIKE '%returned%'
    AND LOWER(itemName) NOT LIKE N'%retoure%'
    AND LOWER(itemName) NOT LIKE N'%rücksend%'
    AND LOWER(itemName) NOT LIKE N'%erstattung%'
),
GroupedItems AS (
  SELECT
    id,
    LOWER(itemName) AS normalizedName,
    MIN(itemName) AS itemName,
    price,
    SUM(COALESCE(quantity, 1)) AS quantity,
    MAX(imageUrl) AS imageUrl
  FROM FilteredItems
  GROUP BY
    id,
    LOWER(itemName),
    price
),
RebuiltItems AS (
  SELECT
    g.id,
    (
      SELECT
        g2.itemName AS [name],
        g2.price AS [price],
        g2.quantity AS [quantity],
        g2.imageUrl AS [imageUrl]
      FROM GroupedItems g2
      WHERE g2.id = g.id
      ORDER BY g2.itemName
      FOR JSON PATH
    ) AS cleanedItemsJson
  FROM GroupedItems g
  GROUP BY g.id
)
UPDATE r
SET items = COALESCE(ri.cleanedItemsJson, '[]')
FROM Receipts r
INNER JOIN RebuiltItems ri
  ON ri.id = r.id;

SELECT
  r.id,
  r.merchant,
  r.date,
  r.total,
  r.createdAt,
  r.tags,
  r.items
FROM Receipts r
WHERE EXISTS (
  SELECT 1
  FROM OPENJSON(COALESCE(r.tags, '[]'))
  WHERE [value] = 'Amazon CSV'
)
ORDER BY r.createdAt DESC;

/*
  Choose one:
*/
-- COMMIT TRANSACTION;
ROLLBACK TRANSACTION;

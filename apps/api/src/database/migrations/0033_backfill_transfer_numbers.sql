-- Backfill transfer_number for existing transfers using window function for sequencing
UPDATE asset_transfers t
SET transfer_number = 
  CONCAT(
    ROW_NUMBER() OVER (PARTITION BY t.asset_id ORDER BY t.created_at ASC),
    '/BBP/',
    COALESCE(ac.code, 'UNCATEGORIZED'),
    '/',
    TO_CHAR(COALESCE(t.completed_at, t.created_at), 'MM'),
    '/',
    TO_CHAR(COALESCE(t.completed_at, t.created_at), 'YYYY')
  )
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
WHERE t.asset_id = a.id;

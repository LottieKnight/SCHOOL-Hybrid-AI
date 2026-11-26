UPDATE bookstore_products
SET metadata_json = metadata_json || '{"coverUrl": "/images/books/becoming-el-matador-cover.jpg"}'::jsonb,
    updated_at = NOW()
WHERE slug = 'becoming-el-matador';

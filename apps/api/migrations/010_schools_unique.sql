DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schools_unique_name_country_city_province'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_unique_name_country_city_province
      UNIQUE (name, country, province, city);
  END IF;
END $$;

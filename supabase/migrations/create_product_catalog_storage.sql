-- Create storage bucket for product catalogs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-catalogs',
  'product-catalogs',
  false,
  52428800, -- 50MB limit
  ARRAY['text/csv', 'application/json', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
CREATE POLICY "Users can upload their brand's catalogs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-catalogs' AND
    (storage.foldername(name))[1] = (
      SELECT brand_id::text 
      FROM usr 
      WHERE email = auth.email()
    )
  );

-- Users can view their brand's catalogs
CREATE POLICY "Users can view their brand's catalogs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-catalogs' AND
    (storage.foldername(name))[1] = (
      SELECT brand_id::text 
      FROM usr 
      WHERE email = auth.email()
    )
  );

-- Users can delete their brand's catalogs
CREATE POLICY "Users can delete their brand's catalogs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-catalogs' AND
    (storage.foldername(name))[1] = (
      SELECT brand_id::text 
      FROM usr 
      WHERE email = auth.email()
    )
  ); 
-- =============================================================================
-- SUPABASE STORAGE POLICIES
-- =============================================================================
-- Instructions:
--   1. Create the four storage buckets in Supabase Dashboard (Storage section)
--   2. Then execute this script in the SQL Editor
--   3. Buckets required:
--      - client-photos
--      - client-ids
--      - payment-vouchers
--      - asset-photos
--
-- Note: Storage policies enforce Row Level Security (RLS) for file access.
--       Users can only access files they own (organized by user_id directory).
-- =============================================================================

-- =============================================================================
-- POLICY 1: client-photos bucket
-- =============================================================================

-- Policy: Allow users to upload profile photos to their own directory
CREATE POLICY "Users can upload client photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to view their own client photos
CREATE POLICY "Users can view own client photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to delete their own client photos
CREATE POLICY "Users can delete own client photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to update their own client photos
CREATE POLICY "Users can update own client photos"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- POLICY 2: client-ids bucket (Cédulas y documentos de identidad)
-- =============================================================================

-- Policy: Allow users to upload ID documents
CREATE POLICY "Users can upload client ID documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to view their own ID documents
CREATE POLICY "Users can view own client ID documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to delete their own ID documents
CREATE POLICY "Users can delete own client ID documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to update their own ID documents
CREATE POLICY "Users can update own client ID documents"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'client-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- POLICY 3: payment-vouchers bucket
-- =============================================================================

-- Policy: Allow users to upload payment vouchers
CREATE POLICY "Users can upload payment vouchers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-vouchers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to view their own payment vouchers
CREATE POLICY "Users can view own payment vouchers"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-vouchers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to delete their own payment vouchers
CREATE POLICY "Users can delete own payment vouchers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-vouchers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to update their own payment vouchers
CREATE POLICY "Users can update own payment vouchers"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'payment-vouchers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- POLICY 4: asset-photos bucket
-- =============================================================================

-- Policy: Allow users to upload asset photos
CREATE POLICY "Users can upload asset photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to view their own asset photos
CREATE POLICY "Users can view own asset photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to delete their own asset photos
CREATE POLICY "Users can delete own asset photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to update their own asset photos
CREATE POLICY "Users can update own asset photos"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

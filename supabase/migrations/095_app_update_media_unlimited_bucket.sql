-- Si 094 a déjà été appliqué avec plafonds, retirer les limites du bucket admin
UPDATE storage.buckets
SET file_size_limit = NULL,
    allowed_mime_types = NULL
WHERE id = 'app-update-media';

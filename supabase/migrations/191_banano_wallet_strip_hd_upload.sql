-- Strip Wallet HD : illustrations ~1125×369 (PassKit @3x) — marge pour fichiers > 2 Mo

UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'banano-wallet-assets';

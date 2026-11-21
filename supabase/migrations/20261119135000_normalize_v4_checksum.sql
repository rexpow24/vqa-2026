-- Correct the V.v4 checksum to the repository's required LF representation.
-- Codebook content and existing annotations are unchanged.
update public.codebook_versions
set sha256 = '6b70d338280afd30aa65ed91e8a63951271850ef9843f11209da6166be2fee6d'
where id = 'V.v4' and sha256 = 'f19baa8ae51bff5089ba429d6fa12ebda9437300216ee26b12db43bc1a58c40b';

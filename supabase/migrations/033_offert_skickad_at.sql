-- Tidpunkt då offerten senast skickades. Jämförs mot updated_at (auto-trigger) för att
-- visa "Ändrad efter utskick" — så man ser om kunden sitter på en äldre version.
alter table offers add column if not exists skickad_at timestamptz;

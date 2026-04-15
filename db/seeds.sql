-- Initial Seed Data for Libanos Epoxy POS + Inventory

-- Default Branch
INSERT INTO branches (name, location, phone) 
VALUES ('Main Branch', 'Addis Ababa, Jacros', '+251911000000')
ON CONFLICT (name) DO NOTHING;

-- Default Categories
INSERT INTO categories (name, description) VALUES
('Epoxy', 'Epoxy resin products'),
('Hardener', 'Hardener products'),
('Tools', 'Mixing and application tools'),
('Accessories', 'Other accessories')
ON CONFLICT (name) DO NOTHING;

-- Initial Admin User (Password will be hashed by the app if not already present)
-- Note: The app will handle hashing the password if it's the first run.
-- This is just a placeholder to ensure the branch exists for the admin.

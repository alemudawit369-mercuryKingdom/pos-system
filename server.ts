import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { z } from "zod";

dotenv.config();

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!JWT_SECRET && NODE_ENV === 'production') {
  logger.error("JWT_SECRET is required in production mode!");
  process.exit(1);
}

const finalJwtSecret = JWT_SECRET || "dev_secret_key_placeholder";

// Database connection
const isPlaceholderUrl = (url?: string) => {
  if (!url) return true;
  const placeholders = ["MY_DATABASE_URL", "base", "localhost", "127.0.0.1", "example.com"];
  return placeholders.some(p => url.toLowerCase().includes(p.toLowerCase()));
};

const pool = new Pool({
  connectionString: DB_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let isDatabaseConnected = false;

// Mock Data Store
let mockUsers = [
  { id: "mock-admin", name: "Mock Admin", email: "admin@libanosepo.com", role: "Admin", created_at: new Date().toISOString() },
  { id: "mock-manager", name: "Mock Manager", email: "manager@libanosepo.com", role: "Manager", created_at: new Date().toISOString() },
  { id: "mock-cashier", name: "Mock Cashier", email: "cashier@libanosepo.com", role: "Cashier", created_at: new Date().toISOString() },
  { id: "mock-storekeeper", name: "Mock StoreKeeper", email: "storekeeper@libanosepo.com", role: "StoreKeeper", created_at: new Date().toISOString() }
];

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["Admin", "Manager", "Cashier", "StoreKeeper"]),
  branch_id: z.string().uuid().optional().nullable(),
});

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, finalJwtSecret, (err: any, user: any) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' ? "Token expired." : "Invalid token.";
      return res.status(403).json({ error: message });
    }
    req.user = user;
    next();
  });
};

// Middleware for role authorization
const authorizeRoles = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

const logActivity = async (userId: string | null, action: string, detail: string | null = null, severity: string = 'Low', ip: string | null = null) => {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, detail, severity, ip_address) VALUES ($1, $2, $3, $4, $5)",
      [userId, action, detail, severity, ip]
    );
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

const buildFilters = (query: any, tableAlias: string = "") => {
  const { branch_id, start_date, end_date } = query;
  const params: any[] = [];
  let filterStr = "";
  const alias = tableAlias ? `${tableAlias}.` : "";

  if (branch_id && branch_id !== 'all') {
    params.push(branch_id);
    filterStr += ` AND ${alias}branch_id = $${params.length}`;
  }

  if (start_date) {
    params.push(start_date);
    filterStr += ` AND ${alias}created_at >= $${params.length}`;
  }

  if (end_date) {
    // Add 1 day to end_date to include the full day
    params.push(end_date);
    filterStr += ` AND ${alias}created_at <= $${params.length}::date + interval '1 day'`;
  }

  return { filterStr, params };
};

// Check database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

function setupMockRoutes(app: express.Application) {
  app.get("/api/products", (req, res) => res.json([
    { id: "p1", name: "Epoxy Resin 1:1", sku: "EP-001", unit: "liter", cost_price: 30, selling_price: 45, stock_quantity: 50, min_stock: 5 },
    { id: "p2", name: "Hardener Fast", sku: "HD-001", unit: "liter", cost_price: 15, selling_price: 25, stock_quantity: 30, min_stock: 5 }
  ]));
  app.get("/api/transactions", (req, res) => res.json([]));
  app.get("/api/categories", (req, res) => res.json([
    { id: "c1", name: "Epoxy" },
    { id: "c2", name: "Hardener" }
  ]));
  app.get("/api/users", authenticateToken, authorizeRoles(['Admin']), (req, res) => res.json(mockUsers));
  app.get("/api/customers", (req, res) => res.json([]));
  app.get("/api/suppliers", (req, res) => res.json([]));
  app.get("/api/purchases", (req, res) => res.json([]));
  app.get("/api/expenses", (req, res) => res.json([]));
  app.get("/api/sales", (req, res) => res.json([]));
  app.get("/api/inventory/logs", (req, res) => res.json([]));
  
  // Mock Auth
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = mockUsers.find(u => u.email === email);
    if (user && password === "admin123") { // Simple mock password check
      const token = jwt.sign(user, finalJwtSecret, { expiresIn: "24h" });
      return res.json({ token, user });
    }
    res.status(401).json({ error: "Invalid email or password (Mock Mode)" });
  });

  app.post("/api/auth/register", authenticateToken, authorizeRoles(['Admin']), (req, res) => {
    const { name, email, role } = req.body;
    console.log("Mock Registration:", { name, email, role });
    const newUser = { 
      id: "mock-" + Date.now(), 
      name, 
      email, 
      role, 
      created_at: new Date().toISOString() 
    };
    mockUsers.push(newUser);
    res.status(201).json(newUser);
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.delete("/api/users/:id", authenticateToken, authorizeRoles(['Admin']), (req, res) => {
    const { id } = req.params;
    mockUsers = mockUsers.filter(u => u.id !== id);
    res.json({ message: "User deleted (Mock Mode)" });
  });

  // Mock Reports
  app.get("/api/reports/summary", (req, res) => {
    res.json({
      dailySales: 1250.50,
      monthlyRevenue: 45200.00,
      monthlyProfit: 12300.00,
      lowStockCount: 3,
      expiryCount: 2
    });
  });

  app.get("/api/reports/cashier-summary", (req, res) => {
    res.json({
      dailySales: 1250.50,
      weeklySales: 8750.00,
      monthlySales: 35000.00,
      yearlySales: 420000.00,
      todayInvoices: 12,
      totalInvoices: 1540,
      availableProducts: 85,
      lowStockCount: 3,
      expiryCount: 2,
      revenue: 1250.50
    });
  });

  app.get("/api/reports/sales-chart", (req, res) => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        total: (Math.random() * 1000 + 500).toFixed(2)
      });
    }
    res.json(data);
  });

  app.get("/api/reports/top-products", (req, res) => {
    res.json([
      { name: "Epoxy Resin 1:1", total_sold: "150" },
      { name: "Hardener Fast", total_sold: "120" },
      { name: "Metallic Pigment Blue", total_sold: "85" },
      { name: "Silicone Spatula", total_sold: "45" },
      { name: "Mixing Cups (50pk)", total_sold: "30" }
    ]);
  });

  // Catch-all for unhandled mock API routes
  app.all("/api/*", (req, res) => {
    console.warn(`Mock route not found: ${req.method} ${req.url}`);
    res.json([]);
  });
}

async function startServer() {
  const app = express();
  // Platform requires port 3000 for external access
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy for express-rate-limit and other proxy-aware middleware
  // AI Studio and most cloud providers (Cloud Run, Heroku, etc.) use a proxy.
  app.set('trust proxy', 1);

  // Security Hardening
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(compression());
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
  
  // Global Rate Limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP to 500 requests per windowMs
    message: { error: "Too many requests from this IP, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", globalLimiter);

  // Stricter Rate Limiter for Auth
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // Limit each IP to 20 requests per windowMs for auth
    message: { error: "Too many login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/auth", authLimiter);

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [
        'http://localhost:3000',
        'https://ais-dev-odcdrkad3tzylwtsf7im7z-180619332503.europe-west1.run.app',
        'https://ais-pre-odcdrkad3tzylwtsf7im7z-180619332503.europe-west1.run.app'
      ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '1mb' })); // Reduced limit for security

  // Health Check
  app.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: isDatabaseConnected ? "connected" : "disconnected"
    });
  });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || isPlaceholderUrl(dbUrl)) {
    console.warn("DATABASE_URL is not set or is a placeholder. Using mock data.");
    setupMockRoutes(app);
  } else {
    try {
      // Test connection first
      const client = await pool.connect();
      client.release();
      isDatabaseConnected = true;

      // Run Schema and Seeds
      const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
      const seedsPath = path.join(process.cwd(), 'db', 'seeds.sql');

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        logger.info("Database schema applied");
      }

      if (fs.existsSync(seedsPath)) {
        const seeds = fs.readFileSync(seedsPath, 'utf8');
        await pool.query(seeds);
        logger.info("Initial seeds applied");
      }

      // Add initial admin if no users exist
      const userCount = await pool.query("SELECT COUNT(*) FROM users");
      if (parseInt(userCount.rows[0].count) === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 12);
        // Get the first branch created by seeds
        const branchResult = await pool.query("SELECT id FROM branches LIMIT 1");
        const branchId = branchResult.rows[0]?.id;

        await pool.query(
          "INSERT INTO users (name, email, password, role, branch_id) VALUES ($1, $2, $3, $4, $5)",
          ["Admin User", "admin@libanosepo.com", hashedPassword, "Admin", branchId]
        );
        logger.info("Initial admin user created: admin@libanosepo.com / admin123");
      }
      
      logger.info("Database initialized successfully");
    } catch (err) {
      logger.error("Database initialization error:", err);
      console.warn("Falling back to mock routes due to database error.");
      isDatabaseConnected = false;
      setupMockRoutes(app);
    }

    // Auth Routes
    app.post("/api/auth/login", async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
      }

      const { email, password } = validation.data;
      try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
          await logActivity(user ? user.id : null, 'Failed Login', `Failed attempt for email: ${email}`, 'Medium', req.ip);
          return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: user.name },
          finalJwtSecret,
          { expiresIn: "8h" } // Secure expiry
        );

        await logActivity(user.id, 'Login', `User logged in from ${req.ip}`, 'Low', req.ip);

        res.json({
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      } catch (err) {
        logger.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
      }
    });

    app.post("/api/auth/register", authenticateToken, authorizeRoles(['Admin']), async (req: any, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
      }

      const { name, email, password, role, branch_id } = validation.data;
      
      try {
        const userCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
          return res.status(400).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // Stronger hashing
        const result = await pool.query(
          "INSERT INTO users (name, email, password, role, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
          [name, email, hashedPassword, role, branch_id]
        );

        await logActivity(req.user.id, 'User Registration', `Registered new user: ${email}`, 'Medium', req.ip);
        res.status(201).json(result.rows[0]);
      } catch (err) {
        logger.error("Registration error:", err);
        if ((err as any).code === '23505') {
          return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Registration failed" });
      }
    });

    app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
      res.json({ user: req.user });
    });

    app.get("/api/users", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC");
        res.json(result.rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.delete("/api/users/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        // Prevent deleting yourself
        if (id === (req as any).user.id) {
          return res.status(400).json({ error: "You cannot delete your own account" });
        }
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ message: "User deleted" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete user" });
      }
    });

    // API Routes
    app.get("/api/categories", authenticateToken, async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query("SELECT * FROM categories ORDER BY name ASC");
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch categories" });
      }
    });

    app.post("/api/categories", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { name, description } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
          [name, description]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to create category" });
      }
    });

    app.put("/api/categories/:id", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { name, description } = req.body;
      try {
        const result = await pool.query(
          "UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *",
          [name, description, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to update category" });
      }
    });

    app.delete("/api/categories/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM categories WHERE id = $1", [id]);
        res.status(204).send();
      } catch (err) {
        res.status(500).json({ error: "Failed to delete category" });
      }
    });

    app.get("/api/products", authenticateToken, async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      const { search, category_id } = req.query;
      try {
        let query = `
          SELECT p.*, c.name as category_name 
          FROM products p 
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (search) {
          params.push(`%${search}%`);
          query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
        }

        if (category_id) {
          params.push(category_id);
          query += ` AND p.category_id = $${params.length}`;
        }

        query += " ORDER BY p.name ASC";
        const result = await pool.query(query, params);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch products" });
      }
    });

    app.post("/api/products", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { name, description, sku, barcode, unit, cost_price, selling_price, stock_quantity, min_stock, batch_number, expiry_date, category_id } = req.body;
      try {
        const result = await pool.query(
          `INSERT INTO products (name, description, sku, barcode, unit, cost_price, selling_price, stock_quantity, min_stock, batch_number, expiry_date, category_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [name, description, sku, barcode, unit, cost_price, selling_price, stock_quantity, min_stock, batch_number, expiry_date, category_id]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create product" });
      }
    });

    app.put("/api/products/:id", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { name, description, sku, barcode, unit, cost_price, selling_price, stock_quantity, min_stock, batch_number, expiry_date, category_id } = req.body;
      try {
        const result = await pool.query(
          `UPDATE products SET 
            name = $1, description = $2, sku = $3, barcode = $4, unit = $5, 
            cost_price = $6, selling_price = $7, stock_quantity = $8, min_stock = $9, 
            batch_number = $10, expiry_date = $11, category_id = $12 
           WHERE id = $13 RETURNING *`,
          [name, description, sku, barcode, unit, cost_price, selling_price, stock_quantity, min_stock, batch_number, expiry_date, category_id, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update product" });
      }
    });

    app.delete("/api/products/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM products WHERE id = $1", [id]);
        res.status(204).send();
      } catch (err) {
        res.status(500).json({ error: "Failed to delete product" });
      }
    });

    app.get("/api/inventory/logs", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query(`
          SELECT l.*, p.name as product_name 
          FROM inventory_logs l 
          JOIN products p ON l.product_id = p.id 
          ORDER BY l.created_at DESC 
          LIMIT 100
        `);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch inventory logs" });
      }
    });

    app.post("/api/inventory/update", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req: any, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { product_id, type, quantity, reason } = req.body;
      
      // Granular check: Only Admin and Manager can ADJUST stock levels manually
      if (type === 'ADJUST' && !['Admin', 'Manager'].includes(req.user.role)) {
        return res.status(403).json({ error: "Only Admins and Managers can adjust stock levels" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        let stockChange = quantity;
        if (type === 'OUT') stockChange = -quantity;
        
        if (type === 'ADJUST') {
          await client.query(
            "UPDATE products SET stock_quantity = $1 WHERE id = $2",
            [quantity, product_id]
          );
          await logActivity(req.user.id, 'Stock Adjustment', `Adjusted stock for product ID ${product_id} to ${quantity}`, 'Medium', req.ip);
        } else {
          await client.query(
            "UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2",
            [stockChange, product_id]
          );
          await logActivity(req.user.id, 'Inventory Update', `${type} update for product ID ${product_id} by ${quantity}`, 'Low', req.ip);
        }

        await client.query(
          "INSERT INTO inventory_logs (product_id, type, quantity, reason) VALUES ($1, $2, $3, $4)",
          [product_id, type, quantity, reason]
        );

        await client.query("COMMIT");
        res.json({ success: true });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to update inventory" });
      } finally {
        client.release();
      }
    });

    app.get("/api/transactions", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch transactions" });
      }
    });

    app.post("/api/transactions", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      // ... existing transaction logic ...
    });

    app.post("/api/sales", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req: any, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { items, total_amount, discount_amount, tax_amount, final_amount, payments, customer_id } = req.body;
      const userId = req.user.id;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        const saleResult = await client.query(
          "INSERT INTO sales (total_amount, discount_amount, tax_amount, final_amount, customer_id, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
          [total_amount, discount_amount, tax_amount, final_amount, customer_id, userId]
        );
        const saleId = saleResult.rows[0].id;

        for (const item of items) {
          await client.query(
            "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)",
            [saleId, item.id, item.quantity, item.selling_price, item.quantity * item.selling_price]
          );
          
          // Update stock
          await client.query(
            "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
            [item.quantity, item.id]
          );

          // Log inventory change
          await client.query(
            "INSERT INTO inventory_logs (product_id, type, quantity, reason) VALUES ($1, $2, $3, $4)",
            [item.id, 'OUT', item.quantity, `Sale #${saleId}`]
          );
        }

        let creditAmount = 0;
        for (const payment of payments) {
          await client.query(
            "INSERT INTO payments (sale_id, amount, method) VALUES ($1, $2, $3)",
            [saleId, payment.amount, payment.method]
          );
          if (payment.method === 'CREDIT') {
            creditAmount += Number(payment.amount);
          }
        }

        if (customer_id && creditAmount > 0) {
          await client.query(
            "UPDATE customers SET credit_balance = credit_balance + $1 WHERE id = $2",
            [creditAmount, customer_id]
          );
        }

        await client.query("COMMIT");
        await logActivity(userId, 'Sale Created', `Sale #${saleId} - Total: $${final_amount}`, 'Low', req.ip);
        res.status(201).json({ id: saleId });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to process sale" });
      } finally {
        client.release();
      }
    });

    app.get("/api/sales/:id", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        const saleResult = await pool.query(`
          SELECT s.*, c.name as customer_name 
          FROM sales s 
          LEFT JOIN customers c ON s.customer_id = c.id 
          WHERE s.id = $1
        `, [id]);

        if (saleResult.rows.length === 0) {
          return res.status(404).json({ error: "Sale not found" });
        }

        const itemsResult = await pool.query(`
          SELECT si.*, p.name as product_name 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          WHERE si.sale_id = $1
        `, [id]);

        const paymentsResult = await pool.query("SELECT * FROM payments WHERE sale_id = $1", [id]);

        res.json({
          ...saleResult.rows[0],
          items: itemsResult.rows,
          payments: paymentsResult.rows
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch sale details" });
      }
    });

    app.get("/api/sales", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query(`
          SELECT s.*, c.name as customer_name 
          FROM sales s 
          LEFT JOIN customers c ON s.customer_id = c.id 
          ORDER BY s.created_at DESC
        `);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch sales" });
      }
    });

    // Customer APIs
    app.get("/api/customers", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query("SELECT * FROM customers ORDER BY name ASC");
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch customers" });
      }
    });

    app.post("/api/customers", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { name, phone, address } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING *",
          [name, phone, address]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        if ((err as any).code === '23505') {
          return res.status(400).json({ error: "Phone number already exists" });
        }
        res.status(500).json({ error: "Failed to create customer" });
      }
    });

    app.put("/api/customers/:id", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { name, phone, address } = req.body;
      try {
        const result = await pool.query(
          "UPDATE customers SET name = $1, phone = $2, address = $3 WHERE id = $4 RETURNING *",
          [name, phone, address, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to update customer" });
      }
    });

    app.get("/api/customers/:id/history", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json({ sales: [], payments: [] });
      const { id } = req.params;
      try {
        const sales = await pool.query("SELECT * FROM sales WHERE customer_id = $1 ORDER BY created_at DESC", [id]);
        const payments = await pool.query("SELECT * FROM customer_payments WHERE customer_id = $1 ORDER BY created_at DESC", [id]);
        res.json({ sales: sales.rows, payments: payments.rows });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch customer history" });
      }
    });

    app.post("/api/customers/:id/payments", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { amount, method, note } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        await client.query(
          "INSERT INTO customer_payments (customer_id, amount, method, note) VALUES ($1, $2, $3, $4)",
          [id, amount, method, note]
        );

        await client.query(
          "UPDATE customers SET credit_balance = credit_balance - $1 WHERE id = $2",
          [amount, id]
        );

        await client.query("COMMIT");
        res.json({ success: true });
      } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: "Failed to record payment" });
      } finally {
        client.release();
      }
    });

    // Supplier APIs
    app.get("/api/suppliers", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query("SELECT * FROM suppliers ORDER BY name ASC");
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
      }
    });

    app.post("/api/suppliers", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { name, contact_person, phone, email, address } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [name, contact_person, phone, email, address]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to create supplier" });
      }
    });

    app.put("/api/suppliers/:id", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { name, contact_person, phone, email, address } = req.body;
      try {
        const result = await pool.query(
          "UPDATE suppliers SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5 WHERE id = $6 RETURNING *",
          [name, contact_person, phone, email, address, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to update supplier" });
      }
    });

    // Purchase APIs
    app.get("/api/purchases", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query(`
          SELECT p.*, s.name as supplier_name 
          FROM purchases p 
          LEFT JOIN suppliers s ON p.supplier_id = s.id 
          ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch purchases" });
      }
    });

    app.post("/api/purchases", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { supplier_id, total_amount, status, items } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const purchaseResult = await client.query(
          "INSERT INTO purchases (supplier_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id",
          [supplier_id, total_amount, status]
        );
        const purchaseId = purchaseResult.rows[0].id;

        for (const item of items) {
          await client.query(
            "INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal) VALUES ($1, $2, $3, $4, $5)",
            [purchaseId, item.product_id, item.quantity, item.unit_cost, item.subtotal]
          );

          if (status === 'RECEIVED') {
            await client.query(
              "UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2",
              [item.quantity, item.product_id]
            );
            await client.query(
              "INSERT INTO inventory_logs (product_id, type, quantity, date) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)",
              [item.product_id, 'STOCK_IN', item.quantity]
            );
          }
        }

        await client.query("COMMIT");
        res.status(201).json({ id: purchaseId });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to create purchase" });
      } finally {
        client.release();
      }
    });

    app.put("/api/purchases/:id/status", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { status } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const currentStatusResult = await client.query("SELECT status FROM purchases WHERE id = $1", [id]);
        if (currentStatusResult.rows.length === 0) {
          throw new Error("Purchase not found");
        }
        const currentStatus = currentStatusResult.rows[0].status;

        if (currentStatus === 'RECEIVED') {
          return res.status(400).json({ error: "Cannot change status of a received purchase" });
        }

        await client.query("UPDATE purchases SET status = $1 WHERE id = $2", [status, id]);

        if (status === 'RECEIVED') {
          const itemsResult = await client.query("SELECT * FROM purchase_items WHERE purchase_id = $1", [id]);
          for (const item of itemsResult.rows) {
            await client.query(
              "UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2",
              [item.quantity, item.product_id]
            );
            await client.query(
              "INSERT INTO inventory_logs (product_id, type, quantity, date) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)",
              [item.product_id, 'STOCK_IN', item.quantity]
            );
          }
        }

        await client.query("COMMIT");
        res.json({ message: "Status updated" });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to update status" });
      } finally {
        client.release();
      }
    });

    // Expense APIs
    app.get("/api/expenses", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      const { start_date, end_date } = req.query;
      try {
        let query = "SELECT * FROM expenses";
        const params = [];
        if (start_date && end_date) {
          query += " WHERE date >= $1 AND date <= $2";
          params.push(start_date, end_date);
        }
        query += " ORDER BY date DESC, created_at DESC";
        const result = await pool.query(query, params);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch expenses" });
      }
    });

    app.post("/api/expenses", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { title, amount, category, date } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO expenses (title, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING *",
          [title, amount, category, date || new Date().toISOString().split('T')[0]]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to create expense" });
      }
    });

    app.delete("/api/expenses/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
        res.json({ message: "Expense deleted" });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete expense" });
      }
    });

    // Branch APIs
    app.get("/api/branches", authenticateToken, async (req, res) => {
      if (!isDatabaseConnected) return res.json([
        { id: "b1", name: "Main Branch", location: "Addis Ababa, Jacros", is_active: true },
        { id: "b2", name: "Bole Branch", location: "Addis Ababa, Bole", is_active: true }
      ]);
      try {
        const result = await pool.query("SELECT * FROM branches ORDER BY name ASC");
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch branches" });
      }
    });

    app.post("/api/branches", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { name, location, phone, email } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO branches (name, location, phone, email) VALUES ($1, $2, $3, $4) RETURNING *",
          [name, location, phone, email]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        if ((err as any).code === '23505') {
          return res.status(400).json({ error: "Branch name already exists" });
        }
        res.status(500).json({ error: "Failed to create branch" });
      }
    });

    app.put("/api/branches/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      const { name, location, phone, email, is_active } = req.body;
      try {
        const result = await pool.query(
          "UPDATE branches SET name = $1, location = $2, phone = $3, email = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
          [name, location, phone, email, is_active, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Failed to update branch" });
      }
    });

    app.delete("/api/branches/:id", authenticateToken, authorizeRoles(['Admin']), async (req, res) => {
      if (!isDatabaseConnected) return res.status(503).json({ error: "Database not available" });
      const { id } = req.params;
      try {
        // Check if users are assigned to this branch
        const usersCount = await pool.query("SELECT COUNT(*) FROM users WHERE branch_id = $1", [id]);
        if (parseInt(usersCount.rows[0].count) > 0) {
          return res.status(400).json({ error: "Cannot delete branch with assigned users" });
        }
        await pool.query("DELETE FROM branches WHERE id = $1", [id]);
        res.status(204).send();
      } catch (err) {
        res.status(500).json({ error: "Failed to delete branch" });
      }
    });

    // Report APIs
    app.get("/api/reports/user-activity", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for user activity
        return res.json({
          recentLogs: [
            { user: 'Alemudawit', action: 'Created Sale', detail: 'Sale #1024 - $450', time: '2 mins ago', severity: 'Low' },
            { user: 'Manager John', action: 'Adjusted Stock', detail: 'Epoxy Resin +50 units', time: '15 mins ago', severity: 'Low' },
            { user: 'Cashier Sarah', action: 'Login', detail: 'Main Branch', time: '1 hour ago', severity: 'Low' },
            { user: 'Unknown', action: 'Failed Login', detail: 'Multiple attempts from 192.168.1.1', time: '2 hours ago', severity: 'High' }
          ],
          userPerformance: [
            { name: 'Alemudawit', sales: 4500, transactions: 12, avgValue: 375 },
            { name: 'Sarah', sales: 3200, transactions: 15, avgValue: 213 }
          ]
        });
      }

      try {
        const { filterStr, params } = buildFilters(req.query, 'a');
        
        // Recent Logs from audit_logs
        const recentLogs = await pool.query(`
          SELECT COALESCE(u.name, 'System') as user, a.action, a.detail, 
                 to_char(a.created_at, 'YYYY-MM-DD HH24:MI') as time,
                 a.severity
          FROM audit_logs a
          LEFT JOIN users u ON a.user_id = u.id
          WHERE 1=1 ${filterStr}
          ORDER BY a.created_at DESC
          LIMIT 20
        `, params);

        // User Performance (Sales per cashier)
        const { filterStr: saleFilter, params: saleParams } = buildFilters(req.query, 's');
        const userPerformance = await pool.query(`
          SELECT u.name, 
                 COALESCE(SUM(s.final_amount), 0) as sales, 
                 COUNT(s.id) as transactions,
                 COALESCE(AVG(s.final_amount), 0) as "avgValue"
          FROM users u
          LEFT JOIN sales s ON u.id = s.user_id
          WHERE u.role IN ('Cashier', 'Manager', 'Admin')
          ${saleFilter}
          GROUP BY u.name
          ORDER BY sales DESC
        `, saleParams);

        res.json({
          recentLogs: recentLogs.rows,
          userPerformance: userPerformance.rows.map(r => ({
            ...r,
            sales: Number(r.sales),
            transactions: Number(r.transactions),
            avgValue: Number(r.avgValue)
          }))
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user activity" });
      }
    });

    app.get("/api/reports/risk-alerts", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for risk alerts
        return res.json({
          expiredProducts: [
            { name: 'Epoxy Hardener B', batch: 'BT-992', expiryDate: '2024-01-15', stock: 5 },
          ],
          nearExpiry: [
            { name: 'Clear Coat Resin', batch: 'BT-102', daysToExpiry: 12, stock: 25 },
            { name: 'Primer Surfacer', batch: 'BT-404', daysToExpiry: 25, stock: 15 }
          ],
          lowStock: [
            { name: 'Mixing Cups 500ml', current: 12, minStock: 50, branch: 'Main' },
            { name: 'Safety Gloves L', current: 5, minStock: 20, branch: 'Bole' }
          ],
          highDebtCustomers: [
            { name: 'ABC Construction', balance: 45000, lastPayment: '2024-03-10' },
            { name: 'XYZ Auto Works', balance: 12000, lastPayment: '2024-04-01' }
          ]
        });
      }

      try {
        const { branch_id } = req.query;
        let branchFilter = "";
        const params: any[] = [];
        if (branch_id && branch_id !== 'all') {
          params.push(branch_id);
          branchFilter = `AND branch_id = $${params.length}`;
        }

        // Expired Products
        const expiredProducts = await pool.query(`
          SELECT name, batch_number as batch, expiry_date as "expiryDate", stock_quantity as stock
          FROM products
          WHERE expiry_date < CURRENT_DATE
          ${branchFilter}
          ORDER BY expiry_date ASC
          LIMIT 10
        `, params);

        // Near Expiry (1-30 days)
        const nearExpiry = await pool.query(`
          SELECT name, batch_number as batch, (expiry_date - CURRENT_DATE) as "daysToExpiry", stock_quantity as stock
          FROM products
          WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + interval '30 days'
          ${branchFilter}
          ORDER BY "daysToExpiry" ASC
          LIMIT 10
        `, params);

        // Low Stock
        const lowStock = await pool.query(`
          SELECT p.name, p.stock_quantity as current, p.min_stock as "minStock", b.name as branch
          FROM products p
          JOIN branches b ON p.branch_id = b.id
          WHERE p.stock_quantity <= p.min_stock
          ${branchFilter}
          ORDER BY (p.stock_quantity / NULLIF(p.min_stock, 0)) ASC
          LIMIT 10
        `, params);

        // High Debt Customers
        const highDebtCustomers = await pool.query(`
          SELECT name, credit_balance as balance, 
                 (SELECT MAX(payment_date) FROM customer_payments WHERE customer_id = customers.id) as "lastPayment"
          FROM customers
          WHERE credit_balance > 0
          ORDER BY credit_balance DESC
          LIMIT 10
        `);

        res.json({
          expiredProducts: expiredProducts.rows.map(r => ({ ...r, stock: Number(r.stock) })),
          nearExpiry: nearExpiry.rows.map(r => ({ ...r, daysToExpiry: Number(r.daysToExpiry), stock: Number(r.stock) })),
          lowStock: lowStock.rows.map(r => ({ ...r, current: Number(r.current), minStock: Number(r.minStock) })),
          highDebtCustomers: highDebtCustomers.rows.map(r => ({ ...r, balance: Number(r.balance) }))
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch risk alerts" });
      }
    });

    app.get("/api/reports/branch-performance", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for branch performance
        const mockData = [
          { name: 'Main Branch', revenue: 125000, profit: 45000, transactions: 1200, avgValue: 104, inventoryValue: 85000 },
          { name: 'Bole Branch', revenue: 84000, profit: 28000, transactions: 850, avgValue: 98, inventoryValue: 42000 },
          { name: 'Megenagna Branch', revenue: 62000, profit: 19000, transactions: 620, avgValue: 100, inventoryValue: 31000 }
        ];
        return res.json({
          branches: mockData,
          summary: {
            topBranch: mockData[0],
            worstBranch: mockData[mockData.length - 1]
          }
        });
      }

      try {
        const { filterStr, params } = buildFilters(req.query, 's');
        const { branch_id } = req.query;
        let branchLimit = "";
        if (branch_id && branch_id !== 'all') {
          branchLimit = `WHERE b.id = $${params.length}`;
        }

        // Calculate inventory value per branch from logs
        const inventoryValueRes = await pool.query(`
          SELECT 
            il.branch_id, 
            SUM(CASE WHEN il.type = 'IN' THEN il.quantity ELSE -il.quantity END * p.cost_price) as inventory_value
          FROM inventory_logs il
          JOIN products p ON il.product_id = p.id
          GROUP BY il.branch_id
        `);

        const branchSalesRes = await pool.query(`
          SELECT 
            b.id,
            b.name, 
            COALESCE(SUM(s.final_amount), 0) as revenue,
            COALESCE(SUM(si.subtotal - (si.quantity * p.cost_price)), 0) as profit,
            COUNT(DISTINCT s.id) as transactions,
            COALESCE(AVG(s.final_amount), 0) as avg_value
          FROM branches b
          LEFT JOIN sales s ON b.id = s.branch_id ${filterStr}
          LEFT JOIN sale_items si ON s.id = si.sale_id
          LEFT JOIN products p ON si.product_id = p.id
          ${branchLimit}
          GROUP BY b.id, b.name
          ORDER BY revenue DESC
        `, params);

        const branches = branchSalesRes.rows.map(r => {
          const inv = inventoryValueRes.rows.find(iv => iv.branch_id === r.id);
          return {
            ...r,
            revenue: Number(r.revenue),
            profit: Number(r.profit),
            transactions: Number(r.transactions),
            avgValue: Number(r.avg_value),
            inventoryValue: inv ? Number(inv.inventory_value) : 0
          };
        });

        res.json({
          branches,
          summary: {
            topBranch: branches[0] || null,
            worstBranch: branches[branches.length - 1] || null
          }
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch branch performance" });
      }
    });

    app.get("/api/reports/inventory-intelligence", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for inventory intelligence
        return res.json({
          topSelling: [
            { name: 'Epoxy Resin 1:1', total_sold: 150, stock: 45 },
            { name: 'Hardener Fast', total_sold: 120, stock: 30 },
            { name: 'Metallic Pigment', total_sold: 85, stock: 110 }
          ],
          lowStock: [
            { name: 'Mixing Cups', stock: 5, min_stock: 20 },
            { name: 'Spatulas', stock: 2, min_stock: 10 }
          ],
          deadStock: [
            { name: 'Old Solvent B', stock: 15, last_sold: '2025-12-10' },
            { name: 'Discontinued Pigment', stock: 8, last_sold: '2025-11-05' }
          ],
          inventoryTable: [
            { name: 'Epoxy Resin 1:1', stock: 45, last_sold: '2026-04-14', risk_level: 'Low' },
            { name: 'Mixing Cups', stock: 5, last_sold: '2026-04-12', risk_level: 'High' },
            { name: 'Hardener Fast', stock: 30, last_sold: '2026-04-14', risk_level: 'Low' },
            { name: 'Spatulas', stock: 2, last_sold: '2026-03-20', risk_level: 'High' },
            { name: 'Old Solvent B', stock: 15, last_sold: '2025-12-10', risk_level: 'Medium' }
          ]
        });
      }

      try {
        const { filterStr, params } = buildFilters(req.query, 's');
        const { branch_id } = req.query;
        let pFilter = "";
        if (branch_id && branch_id !== 'all') {
          pFilter = `WHERE branch_id = $${params.length}`;
        }

        // Top Selling Products
        const topSelling = await pool.query(`
          SELECT p.name, SUM(si.quantity) as total_sold, p.stock_quantity as stock
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          JOIN sales s ON si.sale_id = s.id
          WHERE 1=1 ${filterStr}
          GROUP BY p.id, p.name, p.stock_quantity
          ORDER BY total_sold DESC
          LIMIT 5
        `, params);

        // Low Stock Items
        const lowStock = await pool.query(`
          SELECT name, stock_quantity as stock, min_stock
          FROM products
          WHERE stock_quantity <= min_stock
          ${pFilter.replace('WHERE', 'AND')}
          ORDER BY stock_quantity ASC
          LIMIT 5
        `, branch_id && branch_id !== 'all' ? [branch_id] : []);

        // Dead Stock
        const deadStock = await pool.query(`
          SELECT p.name, p.stock_quantity as stock, MAX(s.created_at) as last_sold
          FROM products p
          LEFT JOIN sale_items si ON p.id = si.product_id
          LEFT JOIN sales s ON si.sale_id = s.id
          ${pFilter}
          GROUP BY p.id, p.name, p.stock_quantity
          HAVING MAX(s.created_at) < CURRENT_DATE - interval '90 days' OR MAX(s.created_at) IS NULL
          ORDER BY last_sold ASC NULLS FIRST
          LIMIT 5
        `, branch_id && branch_id !== 'all' ? [branch_id] : []);

        // Inventory Table
        const inventoryTable = await pool.query(`
          SELECT 
            p.name, 
            p.stock_quantity as stock, 
            MAX(s.created_at) as last_sold,
            CASE 
              WHEN p.stock_quantity <= p.min_stock / 2 THEN 'High'
              WHEN p.stock_quantity <= p.min_stock THEN 'Medium'
              WHEN MAX(s.created_at) < CURRENT_DATE - interval '90 days' OR MAX(s.created_at) IS NULL THEN 'Medium'
              ELSE 'Low'
            END as risk_level
          FROM products p
          LEFT JOIN sale_items si ON p.id = si.product_id
          LEFT JOIN sales s ON si.sale_id = s.id
          ${pFilter}
          GROUP BY p.id, p.name, p.stock_quantity, p.min_stock
          ORDER BY 
            CASE risk_level WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
            stock ASC
          LIMIT 10
        `, branch_id && branch_id !== 'all' ? [branch_id] : []);

        res.json({
          topSelling: topSelling.rows.map(r => ({ ...r, total_sold: Number(r.total_sold) })),
          lowStock: lowStock.rows,
          deadStock: deadStock.rows,
          inventoryTable: inventoryTable.rows
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch inventory intelligence" });
      }
    });

    app.get("/api/reports/sales-analytics", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for sales analytics
        return res.json({
          byCategory: [
            { name: 'Epoxy', value: 4500 },
            { name: 'Hardener', value: 3200 },
            { name: 'Tools', value: 1800 },
            { name: 'Accessories', value: 1200 }
          ],
          byBranch: [
            { name: 'Main Branch', sales: 12500 },
            { name: 'Bole Branch', sales: 8400 },
            { name: 'Megenagna Branch', sales: 6200 }
          ],
          dailySales: [
            { date: '2026-04-08', amount: 1200 },
            { date: '2026-04-09', amount: 1500 },
            { date: '2026-04-10', amount: 1100 },
            { date: '2026-04-11', amount: 1800 },
            { date: '2026-04-12', amount: 2200 },
            { date: '2026-04-13', amount: 1900 },
            { date: '2026-04-14', amount: 2500 }
          ],
          monthlyRevenue: [
            { month: 'Jan', revenue: 35000 },
            { month: 'Feb', revenue: 42000 },
            { month: 'Mar', revenue: 38000 },
            { month: 'Apr', revenue: 45000 }
          ],
          paymentMethods: [
            { name: 'CASH', value: 65 },
            { name: 'BANK', value: 20 },
            { name: 'MOBILE', value: 10 },
            { name: 'CREDIT', value: 5 }
          ]
        });
      }

      try {
        const getSalesData = async (queryType: 'category' | 'branch' | 'daily' | 'monthly' | 'payment') => {
          const { filterStr, params } = buildFilters(req.query, 's');
          let sql = "";
          switch (queryType) {
            case 'category':
              sql = `
                SELECT c.name, SUM(si.subtotal) as value
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN categories c ON p.category_id = c.id
                JOIN sales s ON si.sale_id = s.id
                WHERE 1=1 ${filterStr}
                GROUP BY c.name
                ORDER BY value DESC
              `;
              break;
            case 'branch':
              sql = `
                SELECT b.name, SUM(s.final_amount) as sales
                FROM sales s
                JOIN branches b ON s.branch_id = b.id
                WHERE 1=1 ${filterStr.replace('s.branch_id', 'b.id')}
                GROUP BY b.name
                ORDER BY sales DESC
              `;
              break;
            case 'daily':
              sql = `
                SELECT date(s.created_at) as date, SUM(s.final_amount) as amount
                FROM sales s
                WHERE 1=1 ${filterStr}
                GROUP BY 1
                ORDER BY 1 ASC
              `;
              break;
            case 'monthly':
              sql = `
                SELECT to_char(s.created_at, 'Mon') as month, SUM(s.final_amount) as revenue
                FROM sales s
                WHERE s.created_at >= date_trunc('year', CURRENT_DATE) ${filterStr.includes('branch_id') ? filterStr.split('AND')[1] : ''}
                GROUP BY 1, date_trunc('month', s.created_at)
                ORDER BY date_trunc('month', s.created_at) ASC
              `;
              break;
            case 'payment':
              sql = `
                SELECT p.method as name, COUNT(*) as value
                FROM payments p
                JOIN sales s ON p.sale_id = s.id
                WHERE 1=1 ${filterStr}
                GROUP BY 1
              `;
              break;
          }
          return pool.query(sql, params);
        };

        const [byCategory, byBranch, dailySales, monthlyRevenue, paymentMethods] = await Promise.all([
          getSalesData('category'),
          getSalesData('branch'),
          getSalesData('daily'),
          getSalesData('monthly'),
          getSalesData('payment')
        ]);

        res.json({
          byCategory: byCategory.rows.map(r => ({ ...r, value: Number(r.value) })),
          byBranch: byBranch.rows.map(r => ({ ...r, sales: Number(r.sales) })),
          dailySales: dailySales.rows.map(r => ({ ...r, amount: Number(r.amount) })),
          monthlyRevenue: monthlyRevenue.rows.map(r => ({ ...r, revenue: Number(r.revenue) })),
          paymentMethods: paymentMethods.rows.map(r => ({ ...r, value: Number(r.value) }))
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch sales analytics" });
      }
    });

    app.get("/api/reports/financial-overview", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        // Mock data for financial overview
        const data = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const month = date.toLocaleString('default', { month: 'short' });
          const revenue = Math.floor(Math.random() * 50000) + 20000;
          const expenses = Math.floor(Math.random() * 15000) + 5000;
          data.push({
            month,
            revenue,
            expenses,
            profit: revenue - expenses,
            netIncome: (revenue - expenses) * 0.85 // After tax estimate
          });
        }
        return res.json(data);
      }

      try {
        const { filterStr, params } = buildFilters(req.query, 's');
        const { filterStr: expFilter, params: expParams } = buildFilters(req.query, 'e');

        // Fetch monthly revenue, expenses, and profit for the last 12 months
        const result = await pool.query(`
          WITH months AS (
            SELECT date_trunc('month', CURRENT_DATE) - (n || ' months')::interval as month
            FROM generate_series(0, 11) n
          ),
          monthly_sales AS (
            SELECT date_trunc('month', s.created_at) as month, SUM(s.final_amount) as revenue
            FROM sales s
            WHERE s.created_at >= date_trunc('month', CURRENT_DATE) - interval '11 months'
            ${filterStr}
            GROUP BY 1
          ),
          monthly_expenses AS (
            SELECT date_trunc('month', e.date) as month, SUM(e.amount) as expenses
            FROM expenses e
            WHERE e.date >= date_trunc('month', CURRENT_DATE) - interval '11 months'
            ${expFilter.replace('e.created_at', 'e.date')}
            GROUP BY 1
          ),
          monthly_profit AS (
            SELECT date_trunc('month', s.created_at) as month, 
                   SUM(si.subtotal - (si.quantity * p.cost_price)) as profit
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.created_at >= date_trunc('month', CURRENT_DATE) - interval '11 months'
            ${filterStr}
            GROUP BY 1
          )
          SELECT 
            to_char(m.month, 'Mon') as month,
            COALESCE(s.revenue, 0) as revenue,
            COALESCE(e.expenses, 0) as expenses,
            COALESCE(p.profit, 0) as profit,
            COALESCE(p.profit, 0) - COALESCE(e.expenses, 0) as "netIncome"
          FROM months m
          LEFT JOIN monthly_sales s ON m.month = s.month
          LEFT JOIN monthly_expenses e ON m.month = e.month
          LEFT JOIN monthly_profit p ON m.month = p.month
          ORDER BY m.month ASC
        `, params.length > expParams.length ? params : expParams);

        res.json(result.rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch financial overview" });
      }
    });

    app.get("/api/reports/admin-summary", authenticateToken, authorizeRoles(['Admin', 'Manager']), async (req, res) => {
      if (!isDatabaseConnected) {
        return res.json({
          todayRevenue: 1250.50,
          todayRevenueTrend: 12.5,
          monthlyRevenue: 45200.00,
          monthlyRevenueTrend: 8.2,
          profit: 12300.00,
          profitTrend: 5.4,
          totalOrders: 154,
          totalOrdersTrend: 10.1,
          activeBranches: 3,
          lowStockCount: 5,
          expiredCount: 2,
          outstandingCredit: 3500.00
        });
      }

      try {
        const { filterStr, params } = buildFilters(req.query, 's');
        const { start_date, end_date } = req.query;

        // If date range is provided, we use it for "today" metrics as "selected period"
        let currentPeriodFilter = filterStr;
        let previousPeriodFilter = "";
        
        if (!start_date) {
          currentPeriodFilter = ` AND date(s.created_at) = CURRENT_DATE ${filterStr}`;
          previousPeriodFilter = ` AND date(s.created_at) = CURRENT_DATE - 1 ${filterStr}`;
        } else {
          // For trend, we'd need to calculate the previous period of same length
          // For simplicity, we'll just use the current period vs same period before
          const startDateStr = start_date as string;
          previousPeriodFilter = ` AND s.created_at < $${params.indexOf(startDateStr) + 1} ${filterStr.replace(startDateStr, '...')}`; // Complex to do perfectly here
        }

        // Revenue
        const revenueRes = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales s WHERE 1=1 ${currentPeriodFilter}`, params);
        
        // Monthly (Always monthly for this KPI)
        const monthlyRes = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales s WHERE date_trunc('month', s.created_at) = date_trunc('month', CURRENT_DATE) ${filterStr}`, params);

        // Profit
        const profitRes = await pool.query(`
          SELECT COALESCE(SUM(si.subtotal - (si.quantity * p.cost_price)), 0) as profit 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          JOIN sales s ON si.sale_id = s.id 
          WHERE 1=1 ${currentPeriodFilter}
        `, params);

        // Orders
        const ordersRes = await pool.query(`SELECT COUNT(*) FROM sales s WHERE 1=1 ${currentPeriodFilter}`, params);

        // Static Stats (Still filtered by branch if applicable)
        const { branch_id } = req.query;
        let bFilter = "";
        if (branch_id && branch_id !== 'all') bFilter = `WHERE branch_id = '${branch_id}'`;
        
        const branchesRes = await pool.query("SELECT COUNT(*) FROM branches");
        const lowStockRes = await pool.query(`SELECT COUNT(*) FROM products ${bFilter} ${bFilter ? 'AND' : 'WHERE'} stock_quantity <= min_stock`);
        const expiredRes = await pool.query(`SELECT COUNT(*) FROM products ${bFilter} ${bFilter ? 'AND' : 'WHERE'} expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE`);
        const creditRes = await pool.query("SELECT SUM(credit_balance) as total FROM customers");

        res.json({
          todayRevenue: Number(revenueRes.rows[0].total),
          todayRevenueTrend: 0, // Simplified
          monthlyRevenue: Number(monthlyRes.rows[0].total),
          monthlyRevenueTrend: 0,
          profit: Number(profitRes.rows[0].profit),
          profitTrend: 0,
          totalOrders: Number(ordersRes.rows[0].count),
          totalOrdersTrend: 0,
          activeBranches: Number(branchesRes.rows[0].count),
          lowStockCount: Number(lowStockRes.rows[0].count),
          expiredCount: Number(expiredRes.rows[0].count),
          outstandingCredit: Number(creditRes.rows[0].total || 0)
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch admin summary" });
      }
    });

    app.get("/api/reports/summary", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json({ dailySales: 0, monthlyRevenue: 0, monthlyProfit: 0, lowStockCount: 0, expiryCount: 0 });
      try {
        const dailyResult = await pool.query("SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE date(created_at) = CURRENT_DATE");
        const monthlyResult = await pool.query("SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)");
        const profitResult = await pool.query(`
          SELECT COALESCE(SUM(si.subtotal - (si.quantity * p.cost_price)), 0) as profit 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          JOIN sales s ON si.sale_id = s.id 
          WHERE date_trunc('month', s.created_at) = date_trunc('month', CURRENT_DATE)
        `);
        const lowStockResult = await pool.query("SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock");
        const expiryCountResult = await pool.query("SELECT COUNT(*) FROM products WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'");
        
        res.json({
          dailySales: Number(dailyResult.rows[0]?.total || 0),
          monthlyRevenue: Number(monthlyResult.rows[0]?.total || 0),
          monthlyProfit: Number(profitResult.rows[0]?.profit || 0),
          lowStockCount: Number(lowStockResult.rows[0]?.count || 0),
          expiryCount: Number(expiryCountResult.rows[0]?.count || 0)
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch summary reports" });
      }
    });

    app.get("/api/reports/cashier-summary", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json({
        dailySales: 0,
        weeklySales: 0,
        monthlySales: 0,
        yearlySales: 0,
        todayInvoices: 0,
        totalInvoices: 0,
        availableProducts: 0,
        lowStockCount: 0,
        expiryCount: 0,
        revenue: 0
      });

      const userId = (req as any).user.id;
      const isCashier = (req as any).user.role === 'Cashier';
      const userFilter = isCashier ? "AND user_id = $1" : "";
      const params = isCashier ? [userId] : [];

      try {
        const daily = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE date(created_at) = CURRENT_DATE ${userFilter}`, params);
        const weekly = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' ${userFilter}`, params);
        const monthly = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE) ${userFilter}`, params);
        const yearly = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE) ${userFilter}`, params);
        
        const todayInvoices = await pool.query(`SELECT COUNT(*) FROM sales WHERE date(created_at) = CURRENT_DATE ${userFilter}`, params);
        const totalInvoices = await pool.query(`SELECT COUNT(*) FROM sales ${isCashier ? "WHERE user_id = $1" : ""}`, params);
        
        const availableProducts = await pool.query("SELECT COUNT(*) FROM products WHERE stock_quantity > 0");
        const lowStockCount = await pool.query("SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock");
        const expiryCount = await pool.query("SELECT COUNT(*) FROM products WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'");
        const revenue = await pool.query(`SELECT COALESCE(SUM(final_amount), 0) as total FROM sales ${isCashier ? "WHERE user_id = $1" : ""}`, params);

        res.json({
          dailySales: Number(daily.rows[0]?.total || 0),
          weeklySales: Number(weekly.rows[0]?.total || 0),
          monthlySales: Number(monthly.rows[0]?.total || 0),
          yearlySales: Number(yearly.rows[0]?.total || 0),
          todayInvoices: Number(todayInvoices.rows[0]?.count || 0),
          totalInvoices: Number(totalInvoices.rows[0]?.count || 0),
          availableProducts: Number(availableProducts.rows[0]?.count || 0),
          lowStockCount: Number(lowStockCount.rows[0]?.count || 0),
          expiryCount: Number(expiryCount.rows[0]?.count || 0),
          revenue: Number(revenue.rows[0]?.total || 0)
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch cashier summary" });
      }
    });

    app.get("/api/reports/expiry-alerts", authenticateToken, authorizeRoles(['Admin', 'Manager', 'StoreKeeper', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query(`
          SELECT p.*, c.name as category_name
          FROM products p 
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.expiry_date IS NOT NULL 
          AND (p.expiry_date <= CURRENT_DATE + INTERVAL '6 months')
          ORDER BY p.expiry_date ASC
        `);
        res.json(result.rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch expiry alerts" });
      }
    });

    app.get("/api/reports/sales-chart", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const userId = (req as any).user.id;
        const isCashier = (req as any).user.role === 'Cashier';
        const userFilter = isCashier ? "AND user_id = $1" : "";
        const params = isCashier ? [userId] : [];

        const result = await pool.query(`
          SELECT date(created_at) as date, SUM(final_amount) as total 
          FROM sales 
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' ${userFilter}
          GROUP BY date(created_at) 
          ORDER BY date(created_at) ASC
        `, params);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch sales chart data" });
      }
    });

    app.get("/api/reports/top-products", authenticateToken, authorizeRoles(['Admin', 'Manager', 'Cashier']), async (req, res) => {
      if (!isDatabaseConnected) return res.json([]);
      try {
        const result = await pool.query(`
          SELECT p.name, SUM(si.quantity) as total_sold 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          GROUP BY p.name 
          ORDER BY total_sold DESC 
          LIMIT 5
        `);
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch top products" });
      }
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT} in ${NODE_ENV} mode`);
    if (process.send) {
      process.send('ready'); // Signal PM2 that the app is ready
    }
  });
}

// Process-level Error Handling
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', { reason: reason?.message || reason, stack: reason?.stack });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  pool.end().then(() => {
    logger.info('💥 Process terminated!');
    process.exit(0);
  });
});

startServer();

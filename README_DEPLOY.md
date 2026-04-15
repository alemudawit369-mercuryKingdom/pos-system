# Deployment Guide: POS + Inventory System

This guide outlines the steps to deploy this application to a production environment.

## 1. Environment Variables
Ensure the following variables are set in your production environment:
- `DATABASE_URL`: Your production PostgreSQL connection string.
- `JWT_SECRET`: A long, random string for securing user sessions.
- `NODE_ENV`: Set to `production`.
- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend domains.
- `GEMINI_API_KEY`: Your Google Gemini API key.

## 2. Database Setup
The application automatically initializes the database schema on startup. However, for large-scale production, it is recommended to:
- Use a managed database service (e.g., Google Cloud SQL, AWS RDS).
- Regularly back up your database.
- Monitor query performance using the indexes added in `server.ts`.

## 3. Security
The following security measures are implemented:
- **Helmet**: Sets various security-related HTTP headers.
- **Rate Limiting**: Protects authentication endpoints from brute-force attacks.
- **CORS**: Restricted to allowed origins.
- **Compression**: Gzip compression for faster response times.
- **Input Sanitization**: Parameterized queries are used for all database interactions.

## 4. Deployment Options

### Option A: Docker (Recommended)
Build and run using the provided `Dockerfile`:
```bash
docker build -t pos-system .
docker run -p 3000:3000 --env-file .env pos-system
```

### Option B: Docker Compose (Local Production Testing)
Test the entire stack locally:
```bash
docker-compose up --build
```

### Option C: Manual Deployment
1. Build the frontend: `npm run build`
2. Install production dependencies: `npm install --omit=dev`
3. Start the server: `npm start`

## 5. Monitoring & Health
- **Health Check**: Access `/health` to verify system status.
- **Logs**: Structured JSON logs are output to the console via `winston`.
- **Audit Logs**: Critical actions are recorded in the `audit_logs` table in the database.

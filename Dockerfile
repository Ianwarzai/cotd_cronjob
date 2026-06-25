# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install only production dependencies (no devDependencies like nodemon)
RUN npm ci --omit=dev

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Final production image
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Add non-root user for security
RUN addgroup -S crongroup && adduser -S cronuser -G crongroup

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all application source files
COPY . .

# Give ownership to non-root user
RUN chown -R cronuser:crongroup /app

USER cronuser

# Port exposed by the Express health-check server (app.js)
EXPOSE 3005

# Use node directly (NOT nodemon) in production
CMD ["node", "app.js"]

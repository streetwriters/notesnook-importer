# Stage 1: Build the application
FROM node:18-buster AS builder
WORKDIR /app
# Copy the entire repository to the container
COPY . .
# Install dependencies (allowing prepare scripts to run)
RUN npm install
# Build the application
RUN npm run build

# Stage 2: Serve the production build
FROM node:18-buster
WORKDIR /app
# Copy the built static files from the builder stage
COPY --from=builder /app/apps/importer/build ./build
EXPOSE 3000
# Use npx to start the static file server (serving the 'build' folder)
CMD ["npx", "serve", "build", "-l", "3000"]

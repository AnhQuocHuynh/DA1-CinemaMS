# Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Copy dependency definition and install packages
COPY package*.json ./
RUN npm install --include=optional

# Copy application source code and compile
COPY . .
RUN npm run build

# Run stage
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

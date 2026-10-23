# Build stage. bookworm supplies glibc. The lockfile was generated on Windows
# and omits the Linux Rollup and esbuild binaries, so those are installed here.
FROM node:20-bookworm-slim AS build
WORKDIR /app

# The browser calls host-published ports, not Docker DNS names.
# Leave these empty for the monolith image so the source fallbacks stay in effect.
ARG VITE_API_BASE_URL=
ARG VITE_KEYCLOAK_URL=
ARG VITE_KEYCLOAK_REALM=
ARG VITE_KEYCLOAK_CLIENT_ID=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

# Copy dependency definition and install packages
COPY package*.json ./
RUN npm ci \
 && npm install --no-save --include=optional \
      @rollup/rollup-linux-x64-gnu@4.60.1 \
      @esbuild/linux-x64@0.21.5

# Copy application source code and compile
COPY . .
RUN npm run build

# Run stage
FROM nginx:1.25-alpine
ARG NGINX_CONF=nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

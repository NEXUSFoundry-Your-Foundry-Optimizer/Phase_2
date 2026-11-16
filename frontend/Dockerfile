# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# A relative API base keeps REST and WebSocket traffic on this Nginx origin.
ENV VITE_API_URL="/"

COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

ENV BACKEND_URL="http://backend:8000"
ENV NGINX_ENVSUBST_FILTER="^BACKEND_URL$"

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

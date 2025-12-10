# syntax=docker/dockerfile:1

FROM node:25-alpine AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps


COPY frontend/ ./
RUN npm run build

FROM nginx:1.29.4-alpine

# Copy custom site configuration
COPY nginx/emmatresor.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets
COPY --from=frontend-build /app/dist/ /usr/share/nginx/html/

# Prepare directories for shared static and media files
RUN mkdir -p /var/www/emmatresor/static /var/www/emmatresor/media \
    && chown -R nginx:nginx /var/www/emmatresor

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

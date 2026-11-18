FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
ARG VITE_API_URL
ARG VITE_OIDC_ENABLED=false
ARG VITE_OIDC_API_URL
ARG VITE_CENTRAL_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OIDC_ENABLED=$VITE_OIDC_ENABLED
ENV VITE_OIDC_API_URL=$VITE_OIDC_API_URL
ENV VITE_CENTRAL_URL=$VITE_CENTRAL_URL
RUN npm run build

FROM nginx:alpine
ARG NGINX_CONFIG=nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

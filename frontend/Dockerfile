# ---- Etapa 1: build Angular ----
FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_STRICT=0
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npm config set strict-ssl false && npm install -g npm@10
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx ng build --configuration production

# ---- Etapa 2: servidor Nginx ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
# --- Этап 1: Сборка приложения ---
FROM node:22-alpine AS builder
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies для компиляции)
RUN npm i

# Копируем исходный код и схему базы данных
COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma/
COPY src ./src/

# Генерируем клиент Prisma внутрь папки src (как настроено в схеме)
RUN npx prisma generate

# Компилируем TypeScript в чистый JavaScript (папка dist)
RUN npm run build

# Удаляем dev-зависимости, чтобы облегчить продакшен образ
RUN npm prune --production

# --- Этап 2: Финальный легковесный образ ---
FROM node:22-alpine AS runner 
WORKDIR /app

# Копируем только необходимые для запуска файлы из этапа сборки
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Экспонируем порт NestJS
EXPOSE 3000

# Команда запуска скомпилированного сервера
CMD ["node", "dist/main.js"]

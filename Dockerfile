FROM node:18-alpine
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4125
CMD ["node", "server.js"]
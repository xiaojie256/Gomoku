FROM node:18-alpine
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com
COPY package*.json ./
RUN npm ci
COPY . .
ENV BACKEND_URL=http://backend:4125
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
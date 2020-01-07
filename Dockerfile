FROM node:10

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY ./src ./src

EXPOSE 8080
cmd ["node", "src", "index.js"]

FROM node:24.15.0-bookworm-slim

# Nest CLI uses ps to stop child processes when restarting in watch mode.
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]

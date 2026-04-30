FROM node:20.19.0-slim

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for caching
COPY package.json package-lock.json ./

# Install dependencies with rebuild of native modules
RUN npm install
RUN npm rebuild

COPY . .

# Build the production artifact during image build so runtime doesn't depend
# on a host bind-mount for `dist`.
RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]
FROM node:24-alpine AS runtime
RUN corepack enable pnpm

WORKDIR /app

# Copy package.json
COPY package.json ./

# Copy the built application and node_modules
COPY dist ./dist
COPY node_modules ./node_modules

EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

CMD ["pnpm", "start"]

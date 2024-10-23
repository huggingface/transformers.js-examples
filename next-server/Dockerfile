# Adapted from https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
# For more information, see https://nextjs.org/docs/pages/building-your-application/deploying#docker-image

# Use a base image for building
FROM node:18-slim AS base

# Install git
RUN apt-get update && apt-get install -y git

# Clone the repository and navigate to the next-server folder
WORKDIR /app
RUN git clone https://github.com/huggingface/transformers.js-examples .

# Set the working directory to the next-server folder
WORKDIR /app/next-server

# Install dependencies only when needed
FROM base AS deps

# Install dependencies based on the preferred package manager
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app/next-server
COPY --from=deps /app/next-server/node_modules ./node_modules
COPY . .

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app/next-server

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/next-server/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/next-server/.next/standalone ./ 
COPY --from=builder --chown=nextjs:nodejs /app/next-server/.next/static ./.next/static

USER nextjs

# Allow the running process to write model files to the cache folder.
RUN mkdir -p /app/next-server/node_modules/@huggingface/transformers/.cache
RUN chmod 777 -R /app/next-server/node_modules/@huggingface/transformers/.cache

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

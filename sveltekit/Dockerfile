
# Use a base image for building
FROM node:18-slim AS base

# Install git
RUN apt-get update && apt-get install -y git

# Clone the repository and navigate to the sveltekit folder
WORKDIR /app
RUN git clone -b sveltekit https://github.com/huggingface/transformers.js-examples .

# Set the working directory to the sveltekit folder
WORKDIR /app/sveltekit

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
WORKDIR /app/sveltekit
COPY --from=deps /app/sveltekit/node_modules ./node_modules
COPY . .

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run sveltekit
FROM base AS runner
WORKDIR /app/sveltekit

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sveltekit

COPY --from=builder --chown=nextjs:nodejs /app/sveltekit .

USER sveltekit

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "build"]

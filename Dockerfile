# Use an official Node.js runtime as the base image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Install and enable Corepack (no longer bundled with Node) so the pnpm
# version pinned in package.json is used
RUN npm install -g corepack@latest && corepack enable

# Copy package.json, pnpm-lock.yaml, pnpm-workspace.yaml and .npmrc
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Use dumb-init as the entry point to handle signals properly
RUN apk add --no-cache dumb-init

# Start the application
CMD ["dumb-init", "node", "systemair.js"]

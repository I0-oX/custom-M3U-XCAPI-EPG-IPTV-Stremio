# Use official Node.js LTS image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install --production

COPY . .
RUN npm run patches
# Expose the default port
# Labels for OCI image metadata
LABEL org.opencontainers.image.source=https://github.com/I0-oX/custom-M3U-XCAPI-EPG-IPTV-Stremio
LABEL org.opencontainers.image.description="A feature‑rich, configurable Stremio addon that ingests IPTV M3U playlists and optional EPG (XMLTV) guide data – with built‑in Xtream Codes API support, encrypted configuration tokens, caching (LRU + optional Redis), dynamic per‑user instances, and a polished web configuration UI. Spanish title matching + TMDB metadata support."
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.vendor=I0-oX

EXPOSE 7000

# Start the server
CMD ["npm", "start"]

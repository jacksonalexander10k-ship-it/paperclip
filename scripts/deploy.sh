#!/usr/bin/env bash
set -euo pipefail

# ── Aygency World Production Deploy Script ───────────────────────────────────
#
# Usage:
#   ./scripts/deploy.sh              # Full deploy (build + start)
#   ./scripts/deploy.sh restart      # Restart without rebuilding
#   ./scripts/deploy.sh logs         # Tail logs
#   ./scripts/deploy.sh ssl          # Initial SSL certificate setup
#   ./scripts/deploy.sh status       # Check service status

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.production.example to .env.production and fill in your values."
  exit 1
fi

# Export env vars for docker-compose
set -a
source "$ENV_FILE"
set +a

case "${1:-deploy}" in
  deploy)
    echo "Building and deploying Aygency World..."
    docker compose -f "$COMPOSE_FILE" build --no-cache app
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "Waiting for health check..."
    sleep 10
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Deploy complete. Check: docker compose -f $COMPOSE_FILE logs -f app"
    ;;

  restart)
    echo "Restarting services..."
    docker compose -f "$COMPOSE_FILE" restart app
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "${2:-app}"
    ;;

  status)
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Health checks:"
    curl -sf http://localhost:3100/api/health && echo " ← App OK" || echo " ← App DOWN"
    ;;

  ssl)
    echo "Obtaining SSL certificate for aygencyworld.com..."
    echo "Make sure DNS A record points to this server first."
    echo ""

    # Start nginx without SSL first (for ACME challenge)
    docker compose -f "$COMPOSE_FILE" up -d nginx

    # Get certificate
    docker compose -f "$COMPOSE_FILE" run --rm certbot \
      certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email admin@aygencyworld.com \
      --agree-tos \
      --no-eff-email \
      -d aygencyworld.com \
      -d www.aygencyworld.com

    # Restart nginx with SSL
    docker compose -f "$COMPOSE_FILE" restart nginx
    echo "SSL certificate installed."
    ;;

  seed)
    echo "Running demo seed..."
    docker compose -f "$COMPOSE_FILE" exec app \
      node --import ./server/node_modules/tsx/dist/loader.mjs packages/db/src/seed-demo.ts
    ;;

  migrate)
    echo "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec app \
      node --import ./server/node_modules/tsx/dist/loader.mjs packages/db/src/migrate.ts
    ;;

  *)
    echo "Usage: ./scripts/deploy.sh [deploy|restart|logs|status|ssl|seed|migrate]"
    exit 1
    ;;
esac

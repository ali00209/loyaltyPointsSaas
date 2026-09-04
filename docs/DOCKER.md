# Docker deployment

## Requirements

- Docker Engine with Compose v2
- A `.env` file based on `.env.example`

Set strong values for `POSTGRES_PASSWORD` and `JWT_SECRET` before starting the
application. Do not commit `.env`.

## Start the application

```bash
cp .env.example .env
docker compose up -d --build
```

The application is available at `http://localhost:${APP_PORT:-3000}`. The
PostgreSQL database is private to the Compose network and persists in the
`postgres_data` volume.

The app container waits for PostgreSQL to become healthy, runs pending Drizzle
migrations, and then starts Next.js. Migrations run again safely on subsequent
deployments.

## Operations

```bash
docker compose logs -f app
docker compose ps
docker compose down
```

`docker compose down` preserves the database volume. To remove application
containers and all database data, use `docker compose down -v`.

The health endpoint is:

```text
http://localhost:${APP_PORT:-3000}/api/health
```

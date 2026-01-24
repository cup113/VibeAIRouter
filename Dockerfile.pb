FROM ghcr.io/muchobien/pocketbase:latest

COPY ./db/pb_migrations /pb_migrations

ENV PB_MIGRATIONS_DIR=/pb_migrations

EXPOSE 8090

ENTRYPOINT ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb_migrations"]

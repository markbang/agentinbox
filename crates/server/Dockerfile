# Build from the repository root: docker build -f crates/server/Dockerfile .
# With the web client baked in (ghcr.io/markbang/agentinbox): add
#   --target web --build-context site=<`nsh package --target web` site with app/web/sw.js next to index.html>
FROM rust:1-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates crates
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked -p agentinbox-server \
    && mkdir -p /out/data \
    && cp target/release/agentinbox-server /out/

FROM gcr.io/distroless/cc-debian12:nonroot AS server
COPY --from=build /out/agentinbox-server /usr/local/bin/agentinbox-server
COPY --from=build --chown=65532:65532 /out/data /data
# What `GET /healthz` reports: the release's version (app/nsh.json) and the commit. CI passes both;
# a plain `docker build` names itself `0.0.0-dev`. Either can be overridden at run time (compose).
ARG AGENTINBOX_VERSION=0.0.0-dev
ARG AGENTINBOX_GIT_SHA=
ENV AGENTINBOX_DATA_DIR=/data AGENTINBOX_BIND=0.0.0.0:8080 \
    AGENTINBOX_VERSION=$AGENTINBOX_VERSION AGENTINBOX_GIT_SHA=$AGENTINBOX_GIT_SHA
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["/usr/local/bin/agentinbox-server", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/agentinbox-server"]

FROM server AS web
COPY --from=site . /web
ENV AGENTINBOX_WEB_DIR=/web

FROM server

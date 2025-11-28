# Build Stage
FROM rust:1.75-slim-bullseye as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create new empty shell project
WORKDIR /usr/src/phoenix
COPY . .

# Build with release optimizations
RUN cargo build --release

# Runtime Stage
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl1.1 \
    && rm -rf /var/lib/apt/lists/*

# Create phoenix user
RUN useradd -ms /bin/bash phoenix

# Create necessary directories
RUN mkdir -p /data /config /axioms /values \
    && chown -R phoenix:phoenix /data /config /axioms /values

# Copy binaries from builder
COPY --from=builder /usr/src/phoenix/target/release/phoenix-kernel /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/plastic-ltm /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/triune-conscience /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/world-self-model /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/incremental-learner /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/value-lock /usr/local/bin/
COPY --from=builder /usr/src/phoenix/target/release/perception-fusion /usr/local/bin/

# Switch to phoenix user
USER phoenix
WORKDIR /home/phoenix

# Environment variables
ENV RUST_LOG=info \
    PHOENIX_ENV=production \
    PHOENIX_DATA_DIR=/data \
    PHOENIX_CONFIG_DIR=/config \
    PHOENIX_AXIOMS_DIR=/axioms \
    PHOENIX_VALUES_DIR=/values

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9090/health/deep || exit 1

# Default command
ENTRYPOINT ["phoenix-kernel"]
CMD ["--always-on"]

# Labels
LABEL org.opencontainers.image.title="Phoenix AGI Kernel" \
      org.opencontainers.image.description="Conscience-driven AGI with eternal memory" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Phoenix Project" \
      org.opencontainers.image.url="https://github.com/phoenix-project/phoenix-kernel" \
      org.opencontainers.image.documentation="https://docs.phoenix-project.org" \
      org.opencontainers.image.source="https://github.com/phoenix-project/phoenix-kernel" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.created="2025-11-27"
#!/bin/sh
# Inside a container "127.0.0.1"/"localhost" is the container itself. The MySQL and Redis of
# this project run on the host, so point loopback URLs at host.docker.internal, then run "$@".
for name in DATABASE_URL REDIS_URL; do
  eval "value=\${$name:-}"
  if [ -n "$value" ]; then
    value=$(printf '%s' "$value" | sed -E 's#(@|//)(127\.0\.0\.1|localhost)([:/])#\1host.docker.internal\3#')
    export "$name=$value"
  fi
done
exec "$@"

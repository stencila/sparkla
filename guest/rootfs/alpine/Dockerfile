# Build stage to build vsock-server

FROM alpine

RUN apk update
RUN apk add          \
      build-base     \
      gcc            \
      linux-headers

COPY vsock-server.c .
RUN gcc -o vsock-server vsock-server.c

# Filesystem stage with vsock-server installed
# and init script added to 

FROM alpine

RUN apk update
RUN apk add          \
      openrc

COPY --from=0 /vsock-server /usr/bin

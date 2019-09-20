# Build stage to build nc-vsock

FROM alpine

RUN apk update       \
 && apk add          \
      build-base     \
      gcc            \
      linux-headers

COPY nc-vsock.c .
RUN gcc -o nc-vsock nc-vsock.c

# Filesystem stage with nc-vsock installed

FROM alpine

COPY --from=0 /nc-vsock /bin

RUN apk update       \
 && apk add          \
      openrc

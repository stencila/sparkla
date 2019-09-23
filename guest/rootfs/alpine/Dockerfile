# Build stage
# To avoid adding packages to the filesystem that are only necessary
# for building dependencies

FROM alpine

RUN apk update
RUN apk add          \
      build-base     \
      gcc            \
      linux-headers

COPY vsock-server.c .
RUN gcc -o vsock-server vsock-server.c

# Filesystem stage
# With dependencies copied from build stage

FROM alpine

RUN apk add --update \
      openrc         \
      nodejs         \
      npm

WORKDIR /usr/bin/execution-server
RUN npm install --save \
      length-prefixed-stream

COPY --from=0 /vsock-server /usr/bin

COPY execution-server.js /usr/bin/execution-server/index.js
COPY execution-server.sh /etc/init.d/execution-server
RUN rc-update add execution-server default

CMD node /usr/bin/execution-server

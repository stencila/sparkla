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

# Install base system packages
RUN apk add --update \
      openrc         \
      util-linux

# Set the hostname
# Do it this way, rather than setting /etc/hostname due
# to the fact that Docker overwrites that file
COPY hostname.sh /etc/init.d/hostname
RUN rc-update add hostname boot

# Set up the ttyS0 serial console to be able to interact with VM
RUN ln -s agetty /etc/init.d/agetty.ttyS0 \
 && echo ttyS0 > /etc/securetty           \
 && rc-update add agetty.ttyS0 default

# Set up the execution server
RUN apk add --update \
      nodejs         \
      npm
WORKDIR /usr/bin/execution-server
RUN npm install --save \
      length-prefixed-stream
COPY --from=0 /vsock-server /usr/bin
COPY execution-server.js /usr/bin/execution-server/index.js
COPY execution-server.sh /etc/init.d/execution-server
RUN rc-update add execution-server default

# Docker command just to test the execution server will start
CMD node /usr/bin/execution-server
# Build stage
# To avoid adding packages to the filesystem that are only necessary
# for building dependencies

FROM alpine

RUN apk update
RUN apk add          \
      build-base     \
      gcc            \
      linux-headers

# TODO: Build vsock-server which is now in Executa
#COPY vsock-server.c .
#RUN gcc -o vsock-server vsock-server.c

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
      npm            \
      python3
RUN npm install --save @stencila/schema
RUN npm install --save @stencila/executa
RUN pip3 install -i https://test.pypi.org/simple/ stencila-schema==0.30.3
RUN python3 -m stencila.schema register
RUN node /node_modules/@stencila/schema/dist/interpreter.js register

#COPY --from=0 /vsock-server /usr/bin

COPY executa.sh /etc/init.d/executa
RUN rc-update add executa default

# Docker command just to test the execution server will start
CMD /usr/bin/node /node_modules/@stencila/executa/dist/lib/cli.js --stdio

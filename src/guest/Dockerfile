
# Build stage to build nc-vsock
FROM alpine
RUN apk add build-base gcc linux-headers
COPY nc-vsock.c .
RUN gcc -o nc-vsock nc-vsock.c

# Run stage
FROM alpine
# Copy nc-vsock from build stage
COPY --from=0 /nc-vsock /bin

# Based on https://github.com/firecracker-microvm/firecracker/blob/master/docs/rootfs-and-kernel-setup.md
# If you run the original commands from there get the error:
# "rc-update: service `agetty.ttyS0' does not exist"
# So have used ttyS1
RUN apk add openrc util-linux
RUN ln -s agetty /etc/init.d/agetty.ttyS1 \
  & echo ttyS1 > /etc/securetty \
  & rc-update add agetty.ttyS1 default \
  & rc-update add devfs boot \
  & rc-update add procfs boot \
  & rc-update add sysfs boot

# Add script that will be used to extract files at run time
COPY extract-rootfs.sh .

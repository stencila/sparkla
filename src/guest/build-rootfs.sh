#! /bin/sh

# Script to build rootfs.ext4

set -e

# Build the Docker image
docker build --tag sparkla-guest .

# Extract it into rootfs.ext4
# Based on https://github.com/firecracker-microvm/firecracker/blob/master/docs/rootfs-and-kernel-setup.md
rm rootfs.ext4
dd if=/dev/zero of=rootfs.ext4 bs=1M count=100
mkfs.ext4 rootfs.ext4
mkdir -p rootfs
sudo mount rootfs.ext4 rootfs
docker run -it --rm -v $PWD/rootfs:/rootfs sparkla-guest ./extract-rootfs.sh
sudo umount rootfs

#! /bin/sh

# Script to create a `rootfs.ext4` from a Docker image

set -e

# Name of the Docker image and to use for the temporary Docker container
NAME=sparkla-$(basename $PWD)

# Export the image's filesystem to a tar archive
docker create --name "$NAME" "stencila/$NAME"
docker export --output rootfs.tar "$NAME"
docker rm "$NAME"

# Create `rootfs.ext4` from the tar archive
dd if=/dev/zero of=rootfs.ext4 bs=1M count=500
mkfs.ext4 rootfs.ext4
mkdir -p rootfs
sudo mount rootfs.ext4 rootfs
sudo tar xf rootfs.tar -C rootfs
sudo umount rootfs
rm -rf rootfs

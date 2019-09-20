#!/bin/sh

# Script to extract files to the rootfs volume
# Based on https://github.com/firecracker-microvm/firecracker/blob/master/docs/rootfs-and-kernel-setup.md

for dir in bin etc lib root sbin usr; do tar c "/$dir" | tar x -C /rootfs; done
for dir in dev proc run sys var; do mkdir /rootfs/${dir}; done

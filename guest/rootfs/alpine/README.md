# `alpine` root filesystem

A root filesystem extracted from a recent Alpine Linux Docker image with the following additions:

- `openrc` to provide an `init` system

- `vsock-server` to allow communication between the host and the guest microVM

The intended use case is as a base for other root filesystems. Extensions will normally add init scripts to `/etc/init.d/` which run one or more servers that use `vsock-server` to listen on a virtual socket port.

# ✨ Sparkla

> Compute sessions for executable documents: fast-to-start, isolated, reproducible. Pick any three.

> :warning: Well, that's the aim ;) Sparkla is currently in early development. It started as an experiment in using Amazon's Firecracker as a more secure (but just as fast-to-start) alternative to Docker containers. It is intended to supersede [`stencila/cloud`](https://github.com/stencila/cloud).

## Install

```bash
npm install -g @stencila/sparkla
```

Sparkla creates sessions in either Firecracker microVMs or Docker containers. So you'll need at least one of these installed.

### Firecracker

Firecracker is only available on Linux.
Download the latest Firecracker binary from https://github.com/firecracker-microvm/firecracker/releases:

```bash
curl -L -o firecracker https://github.com/firecracker-microvm/firecracker/releases/download/v0.18.0/firecracker-v0.18.0
chmod +x firecracker
```

Firecracker is built on top of KVM and needs read/write access to `/dev/kvm`. Log in to the host in one terminal and set up that access:

```bash
sudo setfacl -m u:${USER}:rw /dev/kvm
```

### Docker

If you want to use Docker-based sessions then you'll need to have `docker` installed.

## Usage

Run Sparkla using the command line interface e.g.

```bash
sparkla serve --port 9001 --cpuTotal 1
```

### Options

<!-- prettier-ignore-start -->
<!-- OPTIONS-BEGIN -->

| Name            | Description                                                                                                              | Type                           | Default              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------- |
| debug           | Output debug level log entries?                                                                                          | boolean                        | false                |
| host            | The host address that the server should listen on.                                                                       | string                         | "127.0.0.1"          |
| port            | The port that the server should listen on.                                                                               | number                         | 9000                 |
| jwtSecret       | The JWT secret to use to sign and verify JWT tokens. If `null` then a random secret will be generated.                   | string, null                   |  null                |
| sessionType     | The class of sessions created.                                                                                           | "firecracker", "docker"        | "docker"             |
| cpuTotal        | The total number of CPUs that can be allocated to sessions. `null` = use the number of CPUs on the machine.              | number, null                   |  null                |
| memoryTotal     | The total number amount of memory (Gib) that can be allocated to sessions. `null` = use the total amount of memory on the machine. | number, null                   |  null                |
| expiryInterval  | Interval in seconds between checks for expired sessions.                                                                 | number                         | 15                   |
| durationWarning | Number of seconds to provide clients with a warning prior to reaching maximum session duration.                          | number                         | 600                  |
| timeoutWarning  | Number of seconds to provide clients with a warning prior to a reaching session timeout.                                 | number                         | 60                   |
| staleInterval   | Interval in seconds between checks for stale sessions.                                                                   | number                         | 60                   |
| stalePeriod     | Number of seconds that a stopped session is considered stale and will be removed from the list of sessions.              | number                         | 3600                 |
| statsInterval   | Interval in seconds for collecting system statistics                                                                     | number                         | 60                   |
| statsPrometheus | The port to serve Prometheus compatible metrics on. Set to `0` to turn off Prometheus exporting.                         | number                         | 9464                 |
| logsSentry      | The Sentry DSN (Data Source Name) to record warning and error log entries. Set to `null` to not send logs to Sentry.     | string                         | "https://7a4f9c9b0ef5474596c0066bb364e615@sentry.io/1818023" |
| peerSwarm       | The name of the peer swarm to join.                                                                                      | string, null                   | "sparkla"            |

<!-- OPTIONS-END -->
<!-- prettier-ignore-end -->

All options can be set, in decending order of priority, by:

- a command line argument e.g. `--port 80`
- an environment variable prefixed with `SPARKLA_` e.g. `SPARKLA_PORT=80`
- a `.json` or `.ini` configuration file, set using the `--config` option, or `.sparklarc` by default

## Development

```bash
npm run serve:dev
```

### Firecracker

To check for running `FirecrackerSession`s:

```bash
ps aux | firecracker
```

You can also check the logs and metrics of a Firecracker VM while it is running:

```bash
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/log.fifo
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/metrics.fifo
```

### Docker

To check for running `DockerSession`s:

```bash
docker ps
```

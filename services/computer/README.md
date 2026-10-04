# Baymax terminal container

Build from the repository root with `docker build -t baymax-computer:local services/computer`.
Enable the computer in server configuration and use the Computer screen to start it.
The service requires a running Docker engine and never executes commands on the host.
It creates a deployment-labelled named workspace volume, retained across container stops.
The container runs as UID/GID 1000 with a read-only root, no network, no capabilities,
no host bind mounts, a 512 MiB memory cap, one CPU and 128 process limit.
Commands have a 30 second container timeout and 128 KiB combined output limit.
Timeouts and interruptions stop the entire sandbox before another operation can run.
Files are limited to `/workspace`; the fixed Python helper rejects symlink traversal.
Private command receipts live in the configured server data directory and preserve
operation IDs and uncertain outcomes across restarts. They contain submitted command
text and output, so retain them with the same care as the rest of the application's data.
Do not share one deployment ID/data directory among concurrent server processes.

Docker isolation checks, Dockerfile and files.py are adapted from
[OpenMuse](https://github.com/CopilotKit/openmuse), commit
`b06caad7005ac5b6d2b451752a3794a6ae1759c1`, under the included MIT LICENSE.

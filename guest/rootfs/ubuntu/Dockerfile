FROM ubuntu:20.04

# Install system dependencies
RUN apt-get update -y
RUN apt-get install -y \
      curl \
      systemd-sysv

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y \
      nodejs

# Install Executa
RUN npm config --global set user root
RUN npm install --global @stencila/executa@0.11.0

# Run Executa at startup when in a Firecracker VM
RUN mkdir -p /etc/init \
 && printf 'start on runlevel [2345] \n \
            respawn                  \n \
            exec /usr/bin/executa    \n'\
    >> /etc/init/executa.conf

# Install Python executor
RUN apt-get install -y \
      python3 python3-pip
RUN pip3 install -i https://test.pypi.org/simple/ stencila-schema==0.31.0

# Install Javascript executor
RUN npm install --global @stencila/schema@0.31.0

# Setup the same user that Dockta will use, so that registered manifests go to the right place
RUN id -u guest >/dev/null 2>&1 || useradd --create-home --uid 1001 -s /bin/bash guest
USER guest

# Register Manifests
RUN python3 -m stencila.schema register
RUN node /usr/lib/node_modules/@stencila/schema/dist/interpreter.js register

# Run Executa by default when in a Docker container
CMD node /usr/bin/executa serve --stdio

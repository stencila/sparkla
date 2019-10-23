FROM ubuntu:18.10

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
RUN npm install --global @stencila/executa@0.3.1

# Run Executa at startup when in a Firecracker VM
RUN mkdir -p /etc/init \
 && printf 'start on runlevel [2345] \n \
            respawn                  \n \
            exec /usr/bin/executa    \n'\
    >> /etc/init/executa.conf

# Install and register Python executor
RUN apt-get install -y \
      python3 python3-pip
RUN pip3 install -i https://test.pypi.org/simple/ stencila-schema==0.30.3
RUN python3 -m stencila.schema register

# Install and register Javascript executor
RUN npm install --global @stencila/schema @stencila/logga minimist
RUN node /usr/lib/node_modules/@stencila/schema/dist/interpreter.js register

# Run Execta by default when in a Docker container
CMD node /usr/bin/executa serve --stdio

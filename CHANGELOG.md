## [0.5.1](https://github.com/stencila/sparkla/compare/v0.5.0...v0.5.1) (2019-10-29)


### Bug Fixes

* Package-lock.json out of sync ([337de2e](https://github.com/stencila/sparkla/commit/337de2e3441da8c92218c651c818f404c49da915))
* Setting up ubuntu image to run as guest user, updated dockta ([a07ee32](https://github.com/stencila/sparkla/commit/a07ee3202c757862c318144838e045fd75a5b28a))

# [0.5.0](https://github.com/stencila/sparkla/compare/v0.4.0...v0.5.0) (2019-10-29)


### Bug Fixes

* **DockerSession:** Fix stdio based comms with session container ([974c427](https://github.com/stencila/sparkla/commit/974c427c2c2068e7b0c5b53a22fd24f948c3d9d7))
* **DockerSession:** Update to new Schema ([2f814c3](https://github.com/stencila/sparkla/commit/2f814c3c5222ce8ad8e574fb9fc2524c8b4eb7df))
* **DockerSession:** Use dockerode for begin and end of sessions ([ac975c7](https://github.com/stencila/sparkla/commit/ac975c76a7113e7a07e28d004e2a7196fca4cbf3))
* **Manager:** Upgrade to latest Schema and Executa versions ([ff900e1](https://github.com/stencila/sparkla/commit/ff900e19e81431822fa376ed045cfddf03687048))


### Features

* Adding limits to session begin request ([26389fc](https://github.com/stencila/sparkla/commit/26389fca8bef9dd23ac9f824bcd6a0bebaea38cf))
* Applying session limits to manager session start ([0adcdb2](https://github.com/stencila/sparkla/commit/0adcdb288e122e8aba910e5707007c2526a75a68))

# [0.4.0](https://github.com/stencila/sparkla/compare/v0.3.1...v0.4.0) (2019-10-24)


### Bug Fixes

* **Ubuntu-Midi:** Fix DESCRIPTION syntax ([592d595](https://github.com/stencila/sparkla/commit/592d595ab232ef9df085337f308d3a7a7bf6b474))
* **Ubuntu-Midi:** Update Dockta and fix compile command ([bf4c30f](https://github.com/stencila/sparkla/commit/bf4c30ff33397e85209cd3a22e5b20fd5043596b))
* **Ubuntu-Midi:** Update Dockta command so it works! ([9467788](https://github.com/stencila/sparkla/commit/9467788e28605e5141917f24f4c7cfea897c0666))


### Features

* **Ubuntu-Midi rootfs:** Add Dockta based image ([d26c8f1](https://github.com/stencila/sparkla/commit/d26c8f1da9b8316366ef180d2e81f17f331c5a2a))

## [0.3.1](https://github.com/stencila/sparkla/compare/v0.3.0...v0.3.1) (2019-10-24)


### Bug Fixes

* **Manager:** Upgrade to executa@0.4.0 and change `execute` accordingly ([a6b2caf](https://github.com/stencila/sparkla/commit/a6b2caf215265f894816de96049f06b79d26dc6b))

# [0.3.0](https://github.com/stencila/sparkla/compare/v0.2.0...v0.3.0) (2019-10-22)


### Bug Fixes

* **Manager:** Don't pass on properties that are not in schema ([536b31a](https://github.com/stencila/sparkla/commit/536b31aa9451009105b7de3e835d3697eda9151a))
* **rootfs/ubuntu:** Add Python and JS executors ([ceacc11](https://github.com/stencila/sparkla/commit/ceacc11f0321ffa4e871f9118277c388914c6f5c))


### Features

* **Manager:** Add options for host and port to serve on ([c4cfb59](https://github.com/stencila/sparkla/commit/c4cfb592303fee09e6f5df963aa355591d5c7605))

# [0.2.0](https://github.com/stencila/sparkla/compare/v0.1.0...v0.2.0) (2019-10-22)


### Bug Fixes

* **Docker:** Prefix image names with stencila ([e85b5ab](https://github.com/stencila/sparkla/commit/e85b5ab4dc3f62ccfd4f482a786aa1a5f9fef409))
* **Manager:** Delegate execute calls to session instances ([605453c](https://github.com/stencila/sparkla/commit/605453c66d79442ea74a549c1af11c322d788e04))
* **rootfs/ubuntu:** Install Executa into image ([9634431](https://github.com/stencila/sparkla/commit/9634431e0eabc54c59c7ca6ed60a27ad57cb5d9a))


### Features

* Updated alpine docker image to use executa ([4fa18e8](https://github.com/stencila/sparkla/commit/4fa18e81698d94f129f28a64a84508f3ebd1031c))
* **CLI:** Rename serve.ts to cli.ts and make bin command ([8ab1683](https://github.com/stencila/sparkla/commit/8ab168359e2de38b67cac3fdc250b06ab00a4a2e))

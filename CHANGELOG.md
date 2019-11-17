## [0.12.2](https://github.com/stencila/sparkla/compare/v0.12.1...v0.12.2) (2019-11-17)


### Bug Fixes

* **Dependencies:** Upgrade Executa to 0.14.1 ([16b6884](https://github.com/stencila/sparkla/commit/16b6884430fb3a039b8de55d4293d87bde4249c8)), closes [#35](https://github.com/stencila/sparkla/issues/35)
* **Logging:** Fix how errors are sent to Sentry ([a51db1b](https://github.com/stencila/sparkla/commit/a51db1b09fe5b23d6c0a8bcd8354751593d04561)), closes [#34](https://github.com/stencila/sparkla/issues/34)

## [0.12.1](https://github.com/stencila/sparkla/compare/v0.12.0...v0.12.1) (2019-11-14)


### Bug Fixes

* **Logs:** Use log tags (aka labels)  for more useful metrics ([7292101](https://github.com/stencila/sparkla/commit/7292101ead273cedc6997ae4550e8ca20ed43415))
* **Sats:** Continuously record version ([d7068b2](https://github.com/stencila/sparkla/commit/d7068b28bcdc498c846b129aea360f233598e7e9))

# [0.12.0](https://github.com/stencila/sparkla/compare/v0.11.1...v0.12.0) (2019-11-13)


### Bug Fixes

* **Admin:** Improve logging of errors ([a0b2e85](https://github.com/stencila/sparkla/commit/a0b2e85bed18f9c12d1a6c0ab81cb524018ea0cc))
* **DockerSession:** Avoid error re CPU quota less than 1000 ([44569ba](https://github.com/stencila/sparkla/commit/44569ba13d6427c3bf4ef7afcc21e65af7c73ddc))


### Features

* **Logging:** Send logs to Sentry and record in statistics ([3b88e63](https://github.com/stencila/sparkla/commit/3b88e63219394ceeadb5454760884561d85b47d2))

## [0.11.1](https://github.com/stencila/sparkla/compare/v0.11.0...v0.11.1) (2019-11-13)


### Bug Fixes

* **ManagerServer:** Remove redundant stop method ([d014b6c](https://github.com/stencila/sparkla/commit/d014b6c75b225a3f8fa960a03cdb6627ed9c9583))
* **Package:** Include static files in dist ([ea93919](https://github.com/stencila/sparkla/commit/ea9391925b9d368bebb05b599fdc792393fedf90))

# [0.11.0](https://github.com/stencila/sparkla/compare/v0.10.0...v0.11.0) (2019-11-13)


### Bug Fixes

* **Packaging:** Change how package.json is read ([a3d514b](https://github.com/stencila/sparkla/commit/a3d514bd203115da6bea250a51022adaa4190679))


### Features

* **Stats:** Add package version number to stats ([ddb3dd6](https://github.com/stencila/sparkla/commit/ddb3dd6c90daa25914aa8228ed60ba784745b207))

# [0.10.0](https://github.com/stencila/sparkla/compare/v0.9.0...v0.10.0) (2019-11-12)


### Bug Fixes

* **Admin:** Fix JWT token query param ([0ce9648](https://github.com/stencila/sparkla/commit/0ce964868f41896f80abd18e90943af4cec56522))
* **CLI:** Add help command ([576557b](https://github.com/stencila/sparkla/commit/576557b283e4477bc30c2d49a2b82567558db601))
* **Package:** Update Executa ([74917f9](https://github.com/stencila/sparkla/commit/74917f9e88b757f53862b12b30743fbe5741f4e4))


### Features

* **admin page:** Add peer list to admin page ([e4359f2](https://github.com/stencila/sparkla/commit/e4359f268b709c0c55b5f4dd5fa8163b338b903f))
* **Manager:**  Pass requests through to other instances ([a0d3787](https://github.com/stencila/sparkla/commit/a0d3787d6cbe21810fe99534651fa1ba3826a702))
* **Manager:** Keep track of allocatable resources ([48ae2e9](https://github.com/stencila/sparkla/commit/48ae2e9cc71bd02aac831503d9021f1aeee01af7))
* **Peers:** Add discovery of peers ([53ef8b3](https://github.com/stencila/sparkla/commit/53ef8b3e797a421f182c207cb37b29f364f2020a))

# [0.9.0](https://github.com/stencila/sparkla/compare/v0.8.0...v0.9.0) (2019-11-11)


### Features

* **Config:** Upgrade Executa and Logga and add JWT secret to config ([fa7cd61](https://github.com/stencila/sparkla/commit/fa7cd61d829e9a6d017ce6a24bc0fed3724bcee6))

# [0.8.0](https://github.com/stencila/sparkla/compare/v0.7.0...v0.8.0) (2019-11-11)


### Features

* **Configuration:** Configure from files, env vars or argv ([96757b0](https://github.com/stencila/sparkla/commit/96757b0fc91f4332ffacff782bf399cbbf5fef0c))
* **Routable session ids:** Change session ids so that they can be routed ([eb4150b](https://github.com/stencila/sparkla/commit/eb4150b96fa2ee6b8bfa877552b4a180261af470))

# [0.7.0](https://github.com/stencila/sparkla/compare/v0.6.0...v0.7.0) (2019-11-07)


### Bug Fixes

* **Admin page:** Reduce noise in display of session instances ([99836ea](https://github.com/stencila/sparkla/commit/99836eabc33beabfc96756f206708d7d77e7458b))
* **Dependencies:** Update Executa version ([ce16a2a](https://github.com/stencila/sparkla/commit/ce16a2a3c5a5d324cf9848553b86f68b6bea5d9f))
* **Dependencies:** Upgrade Executa version ([7913fa9](https://github.com/stencila/sparkla/commit/7913fa9e6647c1451ce1684fcac52de197ad315a))
* **Dependencies:** Upgrade Executa version ([c756937](https://github.com/stencila/sparkla/commit/c756937ba8d25fa0c08ac140065a419b4c2459df))
* **DockerSession:** Adapt to new Schema version; other fixes ([eb8e7a8](https://github.com/stencila/sparkla/commit/eb8e7a8e485f51eb656bf7664b1546aad95272f5))
* **Manager:** Fix ending of sessions when client disconnects ([0e95ef6](https://github.com/stencila/sparkla/commit/0e95ef69ade250d499b7ef7064776625ae1a55ad))
* **Manager:** Handle missing session id better ([d23c7b4](https://github.com/stencila/sparkla/commit/d23c7b4bc2bc65d08a28bf75fcd5b50db3b78f52))
* **Manager Server:** Require special JWT for admin routes ([fe564a0](https://github.com/stencila/sparkla/commit/fe564a0003270452c8e1ff2778a326e85a150f8f))
* **Type declarations:** Add type declarations file ([a29dd52](https://github.com/stencila/sparkla/commit/a29dd52af73844d4d9e4d59eb9206a2744d0b988))
* **Ubuntu rootfs:** Update versions of Schema and Executa ([3f2dd40](https://github.com/stencila/sparkla/commit/3f2dd40d708aaabaf062f4ae3738ace914034a41))


### Features

* Added JWT admin checking for admin page and skipping for /public ([3368d53](https://github.com/stencila/sparkla/commit/3368d53ffb45015dac256277adaf2cd3635edfc6))
* **Admin:** Add client page and reorganise JS and CSS ([93d2586](https://github.com/stencila/sparkla/commit/93d25862a9b25821d88acf88dc5013268cc83a47))
* **Admin page:** Add admin page ([36d9a76](https://github.com/stencila/sparkla/commit/36d9a76cb29c430cdd2b44895e8d4d27a2b82d5e)), closes [#20](https://github.com/stencila/sparkla/issues/20)
* **Docker:** Add ability to disable network ([e23f4dd](https://github.com/stencila/sparkla/commit/e23f4dd055b0e4a3b237322b79518dd0a2145b01))
* **Manager:** Add checking of clients, duration and timeout ([6c22e6d](https://github.com/stencila/sparkla/commit/6c22e6d22a3e523ccd0ac2d6aa96f5f4445eb862))
* **Manager:** Notify clients when session is ending ([b5d2d36](https://github.com/stencila/sparkla/commit/b5d2d36d3196657d82d2850ccbf05499d484615b))
* **Sessions:** Give each session a human readable name if necessary ([b2e1080](https://github.com/stencila/sparkla/commit/b2e10805a28d8ca9c278b463939ba293b7a05969))

# [0.6.0](https://github.com/stencila/sparkla/compare/v0.5.1...v0.6.0) (2019-11-04)


### Bug Fixes

* Added missing continuation-local-storage types ([ef95207](https://github.com/stencila/sparkla/commit/ef95207371e53a254f315de5cfa0034c40bdabc6))
* Linting fixes ([5c6f90d](https://github.com/stencila/sparkla/commit/5c6f90d9100cee8e4b2233f7b660d49d27aa8a56))


### Features

* **Manager:** Close sessions when associated client disconnects ([19dcb66](https://github.com/stencila/sparkla/commit/19dcb6625c773c51500250d4673c9b61f9ecb216)), closes [#9](https://github.com/stencila/sparkla/issues/9)
* Add logging of session count to opencensus with prometheus export ([a9e0b24](https://github.com/stencila/sparkla/commit/a9e0b243238c9470fcdf07992ccd375c39e248ac))
* Added measuring of system CPU and memory usage ([ada3729](https://github.com/stencila/sparkla/commit/ada3729fa65a5c4e84b6b00c5a9f4efed30c7f27))
* Added Session and Host data logging with opencensus ([df5f7f1](https://github.com/stencila/sparkla/commit/df5f7f1af6324ba4f3968f3fa2553d7e376fe428))

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

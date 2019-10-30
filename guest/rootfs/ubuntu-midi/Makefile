FROM=stencila/sparkla-ubuntu
TAG=stencila/sparkla-ubuntu-midi

docker: DESCRIPTION package.json requirements.txt
	# Because there is a package.json in this folder,
	# to run `npx dockta` we need to jump out of it ;/
	cd .. && \
	npx dockta compile --from $(FROM) ubuntu-midi && \
	cd ubuntu-midi
	docker build --file .Dockerfile --tag $(TAG) .

push:
	docker push $(TAG)

pull:
	docker push $(TAG)

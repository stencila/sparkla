FROM=stencila/sparkla-ubuntu
TAG=stencila/sparkla-ubuntu-midi

docker: DESCRIPTION package.json requirements.txt
	dockta compile
	docker build --file .Dockerfile --tag $(TAG) .

push:
	docker push $(TAG)

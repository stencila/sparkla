FROM=stencila/sparkla-ubuntu
TAG=stencila/sparkla-ubuntu-midi

docker: DESCRIPTION package.json requirements.txt
	npx dockta compile --from $(FROM)
	docker build --file .Dockerfile --tag $(TAG) .

push:
	docker push $(TAG)

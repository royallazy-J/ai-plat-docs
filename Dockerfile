FROM nginx:1.27-alpine

ARG SITE_DIR=public

COPY deployment/nginx.container.conf /etc/nginx/conf.d/default.conf
COPY ${SITE_DIR}/ /usr/share/nginx/html/

EXPOSE 8080

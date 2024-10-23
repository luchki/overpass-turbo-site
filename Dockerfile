FROM node:18 AS node

RUN mkdir /data

COPY . /data

WORKDIR /data
RUN corepack enable && corepack install --global yarn@4.3.1 && yarn install && yarn run build

FROM nginx

COPY --from=node /data/dist /usr/share/nginx/html
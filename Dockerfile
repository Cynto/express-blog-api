FROM node:18-alpine

WORKDIR ./

COPY package.json package-lock.json ./

RUN apk add --update python3 make g++\
   && rm -rf /var/cache/apk/* \
    && npm install


COPY . .

CMD ["npm", "start"]


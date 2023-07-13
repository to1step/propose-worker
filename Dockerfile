FROM node:16-alpine3.14

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm run build

# Get secret from git action
ARG DATABASE_URL
ARG DATABASE_USER
ARG DATABASE_PASSWORD
ARG DATABASE_NAME
ARG LOG_PATH

# Copy secret to ENV
ENV NODE_ENV=production \
 DATABASE_URL=$DATABASE_URL \
 DATABASE_USER=$DATABASE_USER \
 DATABASE_PASSWORD=$DATABASE_PASSWORD \
 DATABASE_NAME=$DATABASE_NAME \
 REDIS_URL=$REDIS_URL \
 LOG_PATH=$LOG_PATH

EXPOSE 4000

CMD ["node", "dist/src/app.js"]

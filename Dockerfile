FROM keymetrics/pm2:8-alpine
COPY . /app/
WORKDIR /app/
RUN yarn install
CMD [ "pm2-runtime", "npm", "--", "start" ]
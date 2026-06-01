FROM nginx:1.25-alpine
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/websocket.conf /etc/nginx/conf.d/websocket.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]

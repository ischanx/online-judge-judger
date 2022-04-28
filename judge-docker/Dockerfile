FROM node:15.10.0-slim
COPY . ./main
WORKDIR /judge
#RUN useradd judger
#USER judger
ENV CURRENT_STEP ""
ENV SAMPLE_NAME ""
RUN sed -i s@/deb.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list
RUN sed -i s@/security.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list
RUN  apt-get clean
RUN apt-get update
RUN apt-get install g++ -y
RUN apt install time
CMD node /main/index.js


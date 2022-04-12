
console.log('__dirname=', __dirname);

module.exports = { 
  BASE_DIR: __dirname,
  UPLOAD_URL: "upload",
  HOST_SITE: "127.0.0.1:8000",
  SECRET_KEY: "adslfjalsdjflasjkdf",
  JWT_EXPIRE_DAYS: 7,
  JWT_AUTH_COOKIE: "JwtCookie",

  EMAIL_SERVER_TYPE: "qq", //类型qq邮箱
  EMAIL_PORT: 587,
  EMAIL_HOST_USER: "81037981@qq.com", // 发送方的邮箱
  EMAIL_HOST_PASSWORD: "hlqzyssfrifkbjea", // smtp 的授权码

  MYSQL_DB: "koablog",
  MYSQL_USERNAME: "root",
  MYSQL_PASSWORD: "123456",
  MYSQL_HOST: "127.0.0.1",
  MYSQL_PORT: "3306",

  ELASTICSEARCH_ON: false,
  ELASTICSEARCH_INDEX: "koablog"
};


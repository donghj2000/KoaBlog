const Koa = require("koa");
const koajwt = require("koa-jwt");
const bodyParser = require("koa-bodyparser");
const koaBody = require('koa-body');
const static = require('koa-static'); 
const path = require("path");
const controller = require("./controller");
const config = require("./config");
const { custom_match } = require("./utils/util");

const app = new Koa();

app.use(koaBody({
	multipart: true,
	formidable: { maxFieldsSize: 200*1024*1024 }// 设置上传文件大小最大限制，默认2M
}));

app.use(koajwt({secret: config.SECRET_KEY, cookie: config.JWT_AUTH_COOKIE})
	.unless({ custom: custom_match }));

app.use(controller());

app.use(static(
    path.join( __dirname,  '')
)) 

app.listen(8000);

console.log('app started at port 8000...');

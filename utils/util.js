const nodemailer = require('nodemailer'); //引入模块
const crypto = require('crypto');
const slugify = require("slugify");
const fs = require("fs");
const url = require("url");
const bcrypt = require("bcryptjs");
const path = require("path");
const config = require("./../config");
const stringRandom = require('string-random');

const custom_match = (ctx) => {
    console.log(ctx.method.toUpperCase(), url.parse(ctx.url).pathname);
    
    if ((url.parse(ctx.url).pathname == "/api/user/" && ctx.method.toUpperCase().startsWith("POST")) ||
        (url.parse(ctx.url).pathname == "/api/jwt_login") || 
        (url.parse(ctx.url).pathname == "/account/result") ||
        (url.parse(ctx.url).pathname == "/api/user/pwd" && ctx.method.toUpperCase().startsWith("PUT")) ||
        (url.parse(ctx.url).pathname.startsWith("/api/upload")) || 
        (url.parse(ctx.url).pathname.startsWith("/upload")) ||
        (url.parse(ctx.url).pathname.startsWith("/api/article") && ctx.method.toUpperCase().startsWith("GET")) ||
        (url.parse(ctx.url).pathname == "/api/archive/") ||
        (url.parse(ctx.url).pathname == "/api/comment/" && ctx.method.toUpperCase().startsWith("GET")) ||
        (url.parse(ctx.url).pathname == "/api/message/" && ctx.method.toUpperCase().startsWith("POST")) ||
        (url.parse(ctx.url).pathname == "/api/es/")
       ) {
        console.log('no jwt auth');
        return true;
    }   
    console.log('jwt auth');
    return true;
}

let transporter = nodemailer.createTransport({
    service: config.EMAIL_SERVER_TYPE, 
    port: config.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: config.EMAIL_HOST_USER, // 发送方的邮箱
        pass: config.EMAIL_HOST_PASSWORD // smtp 的授权码
    }
});
//pass 不是邮箱账户的密码而是stmp的授权码（必须是相应邮箱的stmp授权码）
//邮箱---设置--账户--POP3/SMTP服务---开启---获取stmp授权码

function send_mail(toMail, subject, text, html, call) {
    // 发送的配置项
    let mailOptions = {
        from: config.EMAIL_HOST_USER, // 发送方
        to: toMail, //接收者邮箱，多个邮箱用逗号间隔
        subject: subject, // 标题
        text: text, // 文本内容
        html: html
    };

    //发送函数
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            call(false)
        } else {
            call(true) //因为是异步 所有需要回调函数通知成功结果
        }
    });
}

const hash_node = val =>
  new Promise(resolve =>
    setTimeout(() =>resolve(crypto.createHash('sha256').update(val).digest('hex')),0)
);

const get_hash256 = val => 
    crypto.createHash('sha256').update(val).digest('hex');

const get_random_password = () =>
    stringRandom(8, { letters: true, numbers: false });


Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };

    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }

    return fmt;
}

const get_upload_filepath = (base_path, upload_name) => {
    let date_path = new Date().format("yyyy/MM/dd"); 
    let upload_path = path.join(config.UPLOAD_URL, base_path, date_path);
    let full_path = path.join(config.BASE_DIR, upload_path);
    make_sure_path_exist(full_path);

    return { full_file_path: path.join(full_path, upload_name), 
                  file_path: path.join('/', upload_path, upload_name)}
}

const slugify_filename = (filename) => {
    let ext = path.extname(filename);
    let name = filename.substring(0, filename.length - ext.length);
    let slugified = get_slugified_name(name)
    return slugified + ext
}


const get_slugified_name = (filename) => {
    let slugified = slugify(filename)
    return slugified || get_random_string()
}

const get_random_string = () => {
    return stringRandom(6, { letters: true, numbers: false });
}

const make_sure_path_exist = (full_path)=> {
    if ( fs.existsSync(full_path)==true)
        return;
    fs.mkdirSync(full_path, { recursive: true });
}

const encrypt = password => {
    let salt = bcrypt.genSaltSync(5);
    let hash = bcrypt.hashSync(password, salt);
    return hash;
}
const decrypt = (password, hash) => {
    return bcrypt.compareSync(password, hash);
}

module.exports =  { 
    custom_match,
    send_mail,
    hash_node,
    get_hash256, 
    get_random_password,
    get_upload_filepath,
    encrypt,
    decrypt
}

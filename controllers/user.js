const fs = require("fs");
const path = require("path");
const { User } = require("./../models/user");
const config = require("./../config");
const jwt = require('jsonwebtoken');
const { get_hash256, send_mail, get_random_password, get_upload_filepath, encrypt, decrypt } = require("./../utils/util");

var CreateUser = async (ctx, next) => {
    let user = ctx.request.body;
    user.is_superuser=false;
    user.is_active = false;
    user.creator = 0;
    user.modifier = 0;

    try {
        user.password = encrypt(user.password);
        var ret = await User.create(user);
        if (ret == null) {
            ctx.response.body = { detail: "保存数据库失败" };
            ctx.response.status = 500;
            return;
        }
       
        let sign = get_hash256(get_hash256(config.SECRET_KEY + ret.id))
        let site = config.HOST_SITE;
        let path = "/account/result";
        let url  = `http://${site}${path}?type=validation&id=${ret.id}&sign=${sign} `;
        let content =  `<p>请点击下面链接验证您的邮箱</p>
                        <a href="${url}" rel="bookmark">${url}</a>
                        再次感谢您！
                        <br />
                        如果上面链接无法打开，请将此链接复制至浏览器。
                        ${url}`

        send_mail(user.email, subject="验证您的电子邮箱", text="验证您的电子邮箱", html=content, (ret)=>{
            // if (ret == true) {
            //     ctx.body = { detail: "向你的邮箱发送了一封邮件，请打开验证，完成注册。"};
            // } else {
            //     ctx.body = { detail: "发送验证邮箱失败，请检查邮箱是否正确。" };
            // }
        }); 

        user.creator = ret.id;
        await ret.update(user, {
            where: { id: ret.id }
        });

        ctx.response.status = 201;
        ctx.body = { detail: "向你的邮箱发送了一封邮件，请打开验证，完成注册。"};
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
};
var ListUsers = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {'detail': '没有管理员权限！'};
        return;   
    }

    let option = {};
    let params = {};
    if (ctx.query.username !== "" && ctx.query.username !== undefined) {
        params.username = ctx.query.username;
    }
    if (ctx.query.is_active != undefined) {
        if (ctx.query.is_active == "true") {
            params.is_active = true;
       } else {
            params.is_active = false;
       }
    }
    if (ctx.query.is_superuser != undefined) {
        if (ctx.query.is_superuser === "true") {
           params.is_superuser = true;
        } else if (ctx.query.is_superuser === "false") {
            params.is_superuser = false;
        }
    }

    if (ctx.query.page != undefined && ctx.query.page != "") {
        let page         = parseInt(ctx.query.page);
        let page_size    = parseInt(ctx.query.page_size);
        option.offset = (page - 1) * page_size;
        option.limit = page_size;
    } 
    option.where = params;

    try {
        let { count, rows } = await User.findAndCountAll(option);
        if (rows != null && rows.length > 0) {
            let ret     = {};
            ret.count   = count;
            ret.results = rows.map(user=>{
                return {
                    id:         user.id,
                    username:   user.username,
                    last_login: user.last_login,
                    email:      user.email,
                    avatar:     user.avatar,
                    nickname:   user.nickname,
                    is_active:  user.is_activate,
                    is_superuser: user.is_superuser,
                    created_at: user.created_at }
            });
            ctx.response.body = ret;
            return;
        } 
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
};
var GetUser = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true && ctx.state.user.id != ctx.params.id ) {
        ctx.response.body = { detail: "只能获取自己的个人信息" };
        ctx.response.status = 400;
        return;   
    }

    if (ctx.params.id !== "" && ctx.params.id !== undefined) {
        let id = parseInt(ctx.params.id);
        try {
            let user = await User.findOne({
              where: {id: id} });
            if (user != null) {
                ret = {
                    id:         user.id,
                    username:   user.username,
                    last_login: user.last_login,
                    email:      user.email,
                    avatar:     user.avatar,
                    nickname:   user.nickname,
                    is_active:  user.is_activate,
                    is_superuser: user.is_superuser,
                    created_at: user.created_at
                };
                ctx.response.body = ret;
                return;
            }
        } catch (e) {
            console.log("e=",e);
            ctx.response.body = { detail: "内部错误！" };
            ctx.response.status = 500;
        }
    } else {
        ctx.response.body = { detail: "参数错误！" };
        ctx.response.status = 500;
    }
};

var JwtLogin = async (ctx, next) => {
    const data = ctx.request.body;
    const result = await User.findOne({
        where: { username: data.username }
    });
    
    if (result !== null) {
        if (result.is_active == false) {
            ctx.response.status = 400;
            ctx.body = { detail: "未完成用户验证！" }
            return; 
        }

        const passwordOk = decrypt(data.password, result.password);
        if (passwordOk != true) {
            ctx.response.status = 400;
            ctx.body = { detail: "用户名或密码错误。" }
            return;   
        }

        const token = jwt.sign({
            username:       result.username,
            id:             result.id,
            is_superuser:   result.is_superuser
        }, config.SECRET_KEY, { expiresIn: config.JWT_EXPIRE_DAYS + "d"  });

        var expiration = new Date();　　
        var ms = config.JWT_EXPIRE_DAYS*24*3600*1000;
        expiration.setTime(expiration.getTime() + ms);
        ctx.cookies.set(config.JWT_AUTH_COOKIE, token, {
            expires:  expiration,
            httpOnly: true
        });

        let user = {
            id:         result.id,
            username:   result.username,
            last_login: result.last_login,
            email:      result.email,
            avatar:     result.avatar,
            nickname:   result.nickname,
            is_active:  result.is_active,
            is_superuser: result.is_superuser,
            created_at: result.created_at
        };

        ctx.body = {
            expire_days: config.JWT_EXPIRE_DAYS,
            token, 
            user
        };
    } else {
        ctx.response.status = 400;
        ctx.body = { detail: '用户名或密码错误！' }
    }
};

var UpdateUser = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true && ctx.state.user.id != ctx.params.id ) {
        ctx.response.status = 400;
        ctx.body = {'detail': '只能修改自己的个人信息！'};
        return;   
    }

    var user = {};
    if (ctx.request.body.nickname != undefined && ctx.request.body.nickname != "") {
        user.nickname = ctx.request.body.nickname;
    }
    if (ctx.request.body.email != undefined && ctx.request.body.nickname != "") {
        user.email = ctx.request.body.email;
    }
    if (ctx.request.body.desc != undefined && ctx.request.body.desc != "") {
        user.desc = ctx.request.body.desc;
    }
    if (ctx.request.body.avatar != undefined && ctx.request.body.avatar != "") {
        user.avatar = ctx.request.body.avatar;
    }

    user.modifier = ctx.params.id;
    try {
        let result = await User.update(user, {
            where: { id: ctx.params.id }
        });
        ctx.body = {'detail': '修改个人信息成功。'};
        return; 
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {'detail': '修改个人信息失败。'};
        console.log("e=",e);
        return ;
    }
};

var UpdatePassword  = async (ctx, next) => {
    var password = "", new_password = "";
    if (ctx.request.body.password != undefined && ctx.request.body.password != "") {
        password = ctx.request.body.password;
    }
    if (ctx.request.body.new_password != undefined && ctx.request.body.new_password != "") {
        new_password = ctx.request.body.new_password;
    }

    var result = await User.findOne({
        where: { id: ctx.state.user.id }
    });
    if (result == null) {
        ctx.response.status = 400;
        ctx.body = {'detail': '用户不存在！'};
        return;
    }
    var passwordOk = decrypt(password, result.password);
    if (passwordOk != true) {
        ctx.response.status = 400;
        ctx.body = { detail: "密码错误！" }
        return;   
    }

    try {
        let modifier = ctx.state.user.id;
        password = encrypt(new_password);        
        result = await User.update({ password: password, modifier: modifier }, {
            where: { id: ctx.state.user.id }
        });

        ctx.body = {'detail': '修改密码成功。'};
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {'detail': '修改密码失败。'};
        console.log("e=",e);
    }
    return;
};

var ForgetPassword = async (ctx, next) => {
    let username = "";
    if (ctx.request.body.username != undefined && ctx.request.body.username != "") {
        username = ctx.request.body.username;
    }

    let user = await User.findOne({
        where: { username: username } 
    });

    if (user != null) {
        if (user.is_active == false) {
            ctx.response.status = 400;
            ctx.body = {'detail': '账号未激活.'};
            return;
        }
        let password = get_random_password()
        try {
            send_mail(user.email, subject="您在博客NodeBlog上的新密码", 
                     text="验证您的电子邮箱", 
                     html=`Hi: 你的新密码: \n${password}`, (ret)=>{
                if (ret == true) {
                    ctx.body = { detail: "向你的邮箱发送了一封邮件，请打开验证，完成注册。"};
                } else {
                    ctx.body = { detail: "发送验证邮箱失败，请检查邮箱是否正确。" };
                }
            }); 

            var result = await User.update({ password: encrypt(password) }, {
                where: { username: username }
            });

            ctx.body = {'detail': '新密码已经发送到你的邮箱。'};
            return;
        } catch (e) {
            console.log(e)
            ctx.body = {'detail': 'Send New email failed, Please check your email address'};
            ctx.status = 400;
            return;
        }
    } else {
        ctx.body = {'detail': '账号不存在。'}
        ctx.status = 403;
        return;
    }
}

var GetConstant = async (ctx, next) => {
    ctx.response.body = "";
};

var UploadImage = async (ctx, next) => {
    const file = ctx.request.files.file;
    const { full_file_path, file_path } = get_upload_filepath(ctx.params.path, file.name);
    const reader = fs.createReadStream(file.path);
    const upStream = fs.createWriteStream(full_file_path);
    reader.pipe(upStream);
    return ctx.body = { url: file_path };
};

var AccountResult = async (ctx, next) => {
    let type = "", id = 0;
    if (ctx.query.type !== "" && ctx.query.type !== undefined) {
        type = ctx.query.type;
    }
    if (ctx.query.id !== "" && ctx.query.id !== undefined) {
        id = parseInt(ctx.query.id);
    }

    let user = await User.findOne({
        where: {id: id} 
    });

    if (user != null && user.is_active == true) {
        ctx.body = { detail: "已经验证成功，请登录。" };
        return;
    }

    if (type == "validation") {
        let c_sign = get_hash256(get_hash256(config.SECRET_KEY + user.id))
        let sign = ctx.query.sign;
        if (sign != c_sign) {
            ctx.body = { detail: "验证失败。" };
            ctx.response.status = 400;
            return ;
        }

        var result = await User.update({ is_active: true }, {
            where: { id: id }
        });
                    
        ctx.body = { detail :"验证成功。恭喜您已经成功的完成邮箱验证，您现在可以使用您的账号来登录本站" };
    } else {
        ctx.body = { detail :"验证成功。" };
    }
};

module.exports = {
    'POST /api/user/':      CreateUser,
    'GET /api/user/':       ListUsers,
    'POST /api/jwt_login':  JwtLogin,

    'PUT /api/user/pwd':    ForgetPassword,
    'POST /api/user/pwd':   UpdatePassword,

    'GET /api/user/:id':    GetUser,
    'PUT /api/user/:id/':   UpdateUser,
    'PATCH /api/user/:id':  UpdateUser,

    'GET /api/constant':    GetConstant,
    'POST /api/upload/:path': UploadImage,
    'GET /account/result':  AccountResult
}; 

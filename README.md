# KoaBlog
基于koa+sequelize+elasticsearch7的博客后端，包括注册/登录，个人信息修改，文章列表，全文搜索等。 

### 安装依赖包
```
cnpm install
全局安装nodemon(用于开发，热更新),pm2(用于部署)
cnpm install nodemon,pm2 -g
```

### 创建数据库和管理员账号
```
node create_db.js。
```

### 创建elasticsearch 索引
```
node create_index.js。
```

### 开发
```
nodemon app.js
```

### 部署
```
pm2 start pm2.conf.json
```

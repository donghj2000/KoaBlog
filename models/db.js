const { Sequelize, DataTypes, Model } = require('sequelize');
const config = require('./../config');

//方法 2: 分别传递参数 (sqlite)
const sequelize = new Sequelize(options={
  dialect: 'sqlite',
  storage: 'data/db.sqlite3',
  define: {
    timestamps: true,
    createdAt:"created_at", 
    updatedAt:"modified_at"
  }
});

//方法 3: 分别传递参数 (其它数据库)
//CREATE DATABASE `koablog` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
// const sequelize = new Sequelize(config.MYSQL_DB, config.MYSQL_USERNAME, config.MYSQL_PASSWORD, {
// 	host: config.MYSQL_HOST,
// 	port: config.MYSQL_PORT,
// 	dialect: 'mysql',
// 	pool: {
// 		  max: 5,
// 		  idle: 30000,
// 		  acquire: 60000
// 	},
// 	dialectOptions: {
// 		charset: "utf8mb4",
// 	},
// 	define: {
// 		freezeTableName: true, 
// 		timestamps: true,
//         createdAt:"created_at", 
//         updatedAt:"modified_at"
// 	}
// });

module.exports = sequelize;
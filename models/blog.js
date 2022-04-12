const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require("./db");
const { User } = require("./user");
const constants = require("./constants");


class Catalog extends Model {}
Catalog.init({
  id:       { type: DataTypes.INTEGER,    autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER,    allowNull: true }, 
  modifier: { type: DataTypes.INTEGER,    allowNull: true }, 
  name:     { type: DataTypes.STRING(50), allowNull: false, unique: true},     
}, { sequelize, tableName: "blog_catalog" });


class Article extends Model {}
Article.init({
  id:       { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER,      allowNull: true }, 
  modifier: { type: DataTypes.INTEGER,      allowNull: true }, 
  title:    { type: DataTypes.STRING(100),  allowNull: false, unique: true},     
  cover:    { type: DataTypes.TEXT,         allowNull: true },
  excerpt:  { type: DataTypes.STRING(200),  allowNull: true },
  keyword:  { type: DataTypes.STRING(200),  allowNull: true },
  markdown: { type: DataTypes.TEXT,         allowNull: false },
  status:   { type: DataTypes.STRING(30),   allowNull: false, defaultValue: constants.ARTICLE_STATUS_DRAFT },
  views:    { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0, validate: {min: 0} },
  comments: { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0, validate: {min: 0} },
  likes:    { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0, validate: {min: 0} },
  words:    { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0, validate: {min: 0} },
}, { sequelize, tableName: "blog_article" });

class Comment extends Model {}
Comment.init({
  id:       { type: DataTypes.INTEGER,  autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER,  allowNull: true }, 
  modifier: { type: DataTypes.INTEGER,  allowNull: true }, 
  content:  { type: DataTypes.TEXT,     allowNull: false },     
}, { sequelize, tableName: "blog_comment" });

class Like extends Model {}
Like.init({
  id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER, allowNull: true }, 
  modifier: { type: DataTypes.INTEGER, allowNull: true },      
}, { sequelize, tableName: "blog_like" });

class Message extends Model {}
Message.init({
  id:       { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER,      allowNull: true }, 
  modifier: { type: DataTypes.INTEGER,      allowNull: true },      
  email:    { type: DataTypes.STRING(100),  allowNull: false },
  content:  { type: DataTypes.TEXT,         allowNull: false },
  phone:    { type: DataTypes.STRING(20),   allowNull: true },
  name:     { type: DataTypes.STRING(20),   allowNull: true }, 
}, { sequelize, tableName: "blog_message" });

class Tag extends Model {}
Tag.init({
  id:       { type: DataTypes.INTEGER,    autoIncrement: true, primaryKey: true, allowNull: false},  
  creator:  { type: DataTypes.INTEGER,    allowNull: true }, 
  modifier: { type: DataTypes.INTEGER,    allowNull: true },      
  name:     { type: DataTypes.STRING(20), allowNull: false, unique: true }, 
}, { sequelize, tableName: "blog_tag" });

class ArticleTag extends Model {}

Article.belongsTo(Catalog, {
  onDelete: "NO ACTION",
  foreignKey: {name: "catalog_id",allowNull: false}
});
Article.belongsTo(User, {
  onDelete: "NO ACTION",
  foreignKey: {name: "author_id",allowNull: false}
});
Catalog.hasMany(Article, {
  onDelete: "NO ACTION",
  foreignKey: {name: "catalog_id",allowNull: false}
});
User.hasMany(Article, {
  onDelete: "NO ACTION",
  foreignKey: {name: "author_id",allowNull: false}
});


Catalog.belongsTo(Catalog, {
  onDelete: 'CASCADE',
  foreignKey: {name: "parent_id",allowNull: true}
});
Catalog.hasMany(Catalog, {
  onDelete: 'CASCADE',
  foreignKey: {name: "parent_id",allowNull: true}
});


Comment.belongsTo(Article, {
  onDelete: "NO ACTION",
  foreignKey: {name: "article_id",allowNull: false}
});
Comment.belongsTo(Comment, {
  onDelete: "CASCADE",
  foreignKey: {name: "reply_id",allowNull: true},
});
Comment.belongsTo(User,{
  onDelete: "CASCADE",
  foreignKey: {name: "user_id",allowNull: true}
});
Article.hasMany(Comment, {
  onDelete: "NO ACTION",
  foreignKey: {name: "article_id",allowNull: false}
});
Comment.hasMany(Comment, {
  onDelete: "CASCADE",
  foreignKey: {name: "reply_id",allowNull: true},
   as: 'replies'
});
User.hasMany(Comment, {
  onDelete: "NO ACTION",
  foreignKey: {name: "user_id",allowNull: false}
});


Like.belongsTo(Article, {
  onDelete: "NO ACTION",
  foreignKey: {name: "article_id",allowNull: false}
});
Like.belongsTo(User,{
  onDelete: "NO ACTION",
  foreignKey: {name: "user_id",allowNull: false}
});
Article.hasMany(Like, {
  onDelete: "NO ACTION",
  foreignKey: {name: "article_id",allowNull: false}
});
User.hasMany(Like, {
  onDelete: "NO ACTION",
  foreignKey: {name: "user_id",allowNull: false}
});


Article.belongsToMany(Tag, { through: "article_tag" });
Tag.belongsToMany(Article, { through: "article_tag" });


module.exports = { 
  Article, 
  Catalog, 
  Comment,
  Like,
  Message,
  Tag,
  ArticleTag
};
const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class User extends Model {}

User.init({
  id:           { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true, allowNull: false},  
  password:     { type: DataTypes.STRING(128),  allowNull: false },     
  last_login:   { type: DataTypes.DATE,         allowNull: true  },
  is_superuser: { type: DataTypes.BOOLEAN,      allowNull: false },
  username:     { type: DataTypes.STRING(150),  allowNull: false, unique: true },
  email:        { type: DataTypes.STRING(254),  allowNull: false },
  is_active:    { type: DataTypes.BOOLEAN,      allowNull: false },  
  creator:      { type: DataTypes.INTEGER,      allowNull: true  }, 
  modifier:     { type: DataTypes.INTEGER,      allowNull: true  }, 
  avatar:       { type: DataTypes.STRING(1000), allowNull: true  },
  nickname:     { type: DataTypes.STRING(200),  allowNull: true  },    
  desc:         { type: DataTypes.STRING(200),  allowNull: true  }
}, { sequelize, tableName: "blog_user" });

module.exports = { 
  User
};
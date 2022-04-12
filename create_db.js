const sequelize = require("./models/db");
const { encrypt } = require("./utils/util");

const { User } = require("./models/user");
const { Catalog, Tag, Article, Message, Comment, Like,ArticleTag } = require("./models/blog");

const CreateDatabase = async ()=>{
    await sequelize.sync({ force: true });
}

const CreateAdmin = async () => {
	let admin = {
	  password:     encrypt("123456"), 
	  is_superuser: true,
	  username:     "admin",
	  email:        "xxxxxxxxx@qq.com",
	  is_active:    true,  
	  creator:      0, 
	  modifier:     0, 
	  avatar:       "",
	  nickname:     "admin"
	};
    
	ret = await User.create(admin);
	admin.creator = ret.id;
	let result = await ret.update(admin, {
        where: { id: ret.id }
    });
}

const func = async ()=> {
    await CreateDatabase();
    console.log("created database");
    await CreateAdmin();
    console.log("created admin");
}
func();

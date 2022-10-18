const { Op } = require("sequelize");
const sequelize = require("sequelize");
const { Article, Catalog, Comment, Like, Message, Tag } = require("./../models/blog");
const { User } = require("./../models/user");
const config = require("./../config");
const constants = require("./../models/constants");
const { ESUpdateIndex, ESSearchIndex } = require("./../elasticsearch7");

var CreateArticle = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }

    let article = ctx.request.body;
    let tagIds = article.tags;
    article.catalog_id = article.catalog;
    article.creator    = ctx.state.user.id;
    article.author_id  = ctx.state.user.id;
    try {
        let ret = await Article.findOne({
              where: { title: article.title }
        });

        if (ret != null) {
            ctx.response.status = 500;
            ctx.response.body={  detail: "标题已经存在！" };
            return;
        }
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }

    try {
        let ret = await Article.create(article);
        if (ret != null && tagIds != undefined) {
            let tags = await Tag.findAll({
                where: { id: tagIds }
            });
            if (tags != null && tags.length > 0) {
                ret.setTags(tags);
            }
        
            ret = await Article.findOne({
                where: { id: ret.id },
                include: [ Catalog, Tag, User ]
            });
            if (ret != null) {
                await ESUpdateIndex(ret);
            }
        }

        ctx.response.status = 201;
        ctx.body = { detail: "保存文章成功！"};
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
};

// 递归获取父节点 id
var ancestorIds = [];
var get_ancestors = async (parent_id) => {
    if (parent_id != null) {
        ancestorIds.unshift(parent_id);
        let ret = null;
        try {
            ret = await Catalog.findOne({
                attributes: [ "id", "parent_id" ],
                where: { id: parent_id }
            });
        } catch (e) {
            return ancestorIds;
        }

        if (ret != null) {
            let parent_id_tmp = ret.parent_id;
            await get_ancestors(parent_id_tmp);
        } else {
            return ancestorIds;
        }
    } else {
        return ancestorIds;
    }
}

// 递归获取子节点 id
var descendantsIds = [];
var get_descendants = async (catalog_id) => {
    descendantsIds.unshift(catalog_id);
    let catalogObj = null
    try {
        catalogObj= await Catalog.findAndCountAll({
            attributes: [ "id", "parent_id" ],
            where: { parent_id: catalog_id }
        });
    } catch (e) {
        console.log("e=",e)
        return descendantsIds;
    }

    if (catalogObj.rows != null && catalogObj.count != 0) {
        for (i = 0;i < catalogObj.count; i++ ) {
            let catalog_id_tmp = catalogObj.rows[i].id;
            await get_descendants(catalog_id_tmp);    
        }
    } else {
        return descendantsIds;
    }
}

var ListArticles = async (ctx, next) => {
    let params = {};
    let page      = parseInt(ctx.request.query.page);
    let page_size = parseInt(ctx.request.query.page_size);
    let status    = ctx.request.query.status;
    let search    = ctx.request.query.search;
    let tag_id    = parseInt(ctx.request.query.tag);
    let catalog   = parseInt(ctx.request.query.catalog);

    if (status != undefined && status != null) {
        params.status = status; //读者获取文章列表，Published
    } 
    if (isNaN(catalog)==false) {
        descendantsIds = [];
        await get_descendants(catalog);
        params.catalog_id = { [Op.in]: descendantsIds };
    }

    if (search != undefined && search != "") {  //搜索 title
        params.title = { [Op.substring]: search };
    }

    let articleObj = { count: 0, rows: null};
    try {
        if (isNaN(tag_id)==false) {
            tag = await Tag.findOne({
                where:   {id: tag_id},
                include: [ Article ]
            });
            
            articleObj.count = await tag.countArticles();
            articleObj.rows = await tag.getArticles({
                where:   params,
                offset:  (page - 1) * page_size,
                limit:   page_size,
                include: [ Catalog, Tag, User ],
                order:   [["id", "asc"]]
            });
        } else {
            articleObj = await Article.findAndCountAll({
                where:   params,
                offset:  (page - 1) * page_size,
                limit:   page_size,
                include: [ Catalog, Tag, User ],
                order:   [["id", "asc"]]
            });
        }
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    
    let {count, rows} = articleObj;
    if (rows == null || rows.length == 0) {
        ctx.response.body = { detail: "没有文章！" };
        ctx.response.status = 400;
    } else {
        let ret = {};
        ret.count   = count;
        ret.results = [];
        for (article of rows) {
            let tags_info = article.Tags.map(tag=>{
                return {
                    id:         tag.id,
                    name:       tag.name,
                    created_at: tag.created_at,
                    modified_at:tag.modified_at }
            });

            ancestorIds = [article.Catalog.id];
            await get_ancestors(article.Catalog.parent_id);
            let catalog_info = {
                id:         article.Catalog.id,
                name:       article.Catalog.name,
                parents:    ancestorIds
            }
            ret.results.push({
                id:         article.id,
                title:      article.title,
                excerpt:    article.excerpt,
                cover:      article.cover,
                status:     article.status,
                created_at: article.created_at,
                modified_at:article.modified_at,
                tags_info:  tags_info,
                catalog_info: catalog_info,
                views:      article.views,
                comments:   article.comments,
                words:      article.words,
                likes:      article.likes })
        }

        ctx.response.body = ret;
        ctx.response.status = 200;
    }
}
var GetArticle = async (ctx, next) => {
    let article = null;
    try {
        article = await Article.findOne({
            where: { id: ctx.params.id },
            include: [Catalog, Tag, User]
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }

    if (article == null) {
        ctx.response.body = { detail: "获取文章失败！" };
        ctx.response.status = 400;
    } else {
        let ret = {};
        let tags_info = article.Tags.map(tag=>{
            return {
                id:         tag.id,
                name:       tag.name,
                created_at: tag.created_at,
                modified_at:tag.modified_at}
        });
        ancestorIds = [article.Catalog.id];
        await get_ancestors(article.Catalog.parent_id);
        let catalog_info = {
            id:         article.Catalog.id,
            name:       article.Catalog.name,
            parents:    ancestorIds
        }
        ret = {
            id:         article.id,
            title:      article.title,
            excerpt:    article.excerpt,
            keyword:    article.keyword,
            cover:      article.cover,
            markdown:   article.markdown,
            status:     article.status,
            created_at: article.created_at,
            modified_at:article.modified_at,
            tags_info:  tags_info,
            catalog_info: catalog_info,
            views:      article.views,
            comments:   article.comments,
            words:      article.words,
            likes:      article.likes,
            author:     article.User.username
        };
        try {
            await article.update({ views: article.views + 1 });
        } catch (e) {
            console.log("e=",e);
            ctx.response.body = { detail: "内部错误！" };
            ctx.response.status = 500;
            return;
        }
        
        ctx.response.body = ret;
        ctx.response.status = 200;
    }
}

var PutArticle = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }

    let article = ctx.request.body;
    let tagIds = article.tags;
    article.catalog_id = article.catalog;
    article.modifier = ctx.state.user.id;

    let ret = null;
    try {
        ret = await Article.findOne({
            where: { id: ctx.params.id }
        });

        if (ret == null) {
            ctx.response.status = 500;
            ctx.response.body={ detail: "文章不存在！" };
            return;
        }
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }

    try {
        ret = await ret.update(article);
        if (ret != null && tagIds != undefined) {
            let tags = await Tag.findAll({
                where: { id: tagIds }
            });
            if (tags != null && tags.length > 0) {
                ret.setTags(tags);
            }

            ret = await Article.findOne({
                where: { id: ctx.params.id },
                include: [ Catalog, Tag, User ]
            });

            if (ret != null) {
                await ESUpdateIndex(ret);
            }
        }

        ctx.response.status = 201;
        ctx.body = { detail: "保存文章成功。"};
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
}

var ListArchive = async (ctx, next) => {
    let page      = parseInt(ctx.request.query.page);
    let page_size = parseInt(ctx.request.query.page_size);

    let articleObj = null;
    try {
        articleObj = await Article.findAndCountAll({
            attributes: ["id", "title", "created_at"],
            where:   { status: constants.ARTICLE_STATUS_PUBLISHED },
            order:   sequelize.literal("id ASC"),
            offset:  (page - 1) * page_size,
            limit:   page_size
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    let { count, rows } = articleObj;
    if (rows == null || rows.length == 0) {
        ctx.response.body = { detail: "没有文章！" };
        ctx.response.status = 400;
    } else {
        let ret = {};
        ret.count = count;
        years = {};
        ret.results = [];
        rows.forEach((article, index)=>{
            let date = new Date(article.created_at);
            let year = date.getFullYear();
            let articles_year = years[year];
            if (articles_year == null) {
                articles_year = [];
                years[year] = articles_year;
            }
            articles_year.push({
                id:         article.id,
                title:      article.title,
                created_at: article.created_at
            });
        });
        Object.getOwnPropertyNames(years).forEach(function(key){
            ret.results.push({
                year: key,
                list: years[key]
            });
        });

        ctx.response.body = ret;
        ctx.response.status = 200;
    }
}

var CreateComment = async (ctx, next) => {
    let comment = ctx.request.body;
    comment.article_id = comment.article;
    comment.user_id    = comment.user;
    comment.reply_id   = comment.reply;
    comment.creator    = comment.user_id;
    comment.modifier   = comment.user_id;
    try {
        let ret = await Comment.create(comment);
        ctx.response.status = 201;
        ctx.body = { detail: "保存文章成功。"};

        let article = await Article.findOne({
            where: {
                id: comment.article_id
            }
        });
        if (article != null) {
            await article.update({ comments: article.comments + 1 });
        }
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
}

var getReplies =  async (replies) => {
    let comment_replies = [];
    if (replies!=undefined) {
        for (reply of replies){
            replyTmp = await Comment.findOne({
                where: { id: reply.id },
                include : [{ model: Comment, as: "replies"}, User ]
            });
          
            comment_replies.push({
                id:             replyTmp.id,
                content:        replyTmp.content,
                user_info:      {
                    id:          replyTmp.User.id,
                    name:        replyTmp.User.nickname || user_rep.username,
                    avatar:      replyTmp.User.avatar,   
                    role:        replyTmp.User.is_superuser==true?"Admin":"" },
                created_at:      replyTmp.created_at,
                comment_replies: await getReplies(replyTmp.replies)});
        }
    }
    
    return comment_replies;
}
var ListComments = async (ctx, next) => {
    let option = {};
    let params = {};
    
    if (ctx.request.query.article != undefined) {
        params.article_id = ctx.request.query.article;
    }
    if (ctx.request.query.user != undefined) {
        params.user_id = ctx.request.query.user;
    }
    let search    = ctx.request.query.search;
    if (search != undefined && search != "") {  //搜索 title
        params.content = { [Op.substring]: search };
    }

    if (ctx.query.page != undefined && ctx.query.page != "") {
        let page         = parseInt(ctx.query.page);
        let page_size    = parseInt(ctx.query.page_size);
        option.offset = (page - 1) * page_size;
        option.limit = page_size;
    } 
    option.where   = params;
    option.include = [{ model: Comment, as: "replies"}, Article, User ];
    option.order   = [["id", "asc"]];

    let commentObj = null;
    try {
        commentObj = await Comment.findAndCountAll(option);
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    let { count, rows } = commentObj;
    if (rows == null || rows.length == 0) {
        ctx.response.body = { detail: "没有评论！" };
        ctx.response.status = 400;
    } else {
        let ret = {};
        ret.count = count;
        ret.results = [];
        for (comment of rows) {
            let user_info = {
                id:     comment.User.id, 
                name:   comment.User.nickname || comment.User.username, 
                avatar: comment.User.avatar,
                role:   comment.User.is_superuser==true ?"Admin" : ""
            };
            let article_info = {
                id:    comment.Article.id, 
                title: comment.Article.title
            }
            
            let comment_replies = await getReplies(comment.replies);
            ret.results.push({
                id:              comment.id,
                user:            comment.user_id,
                user_info:       user_info,
                article:         comment.article_id, 
                article_info:    article_info,
                created_at:      comment.created_at, 
                reply:           comment.reply_id, 
                content:         comment.content,
                comment_replies: comment_replies });
        } 

        ctx.response.body = ret;
        ctx.response.status = 200;
    }
}

var CreateLike = async (ctx, next) => {
    let like = ctx.request.body;
    like.article_id = like.article;
    like.user_id = like.user;
    like.creator = like.user_id;
    like.modifier = like.user_id;

    try { 
        let ret = await Like.create(like);
        ctx.response.status = 201;
        ctx.body = { detail: "保存文章成功。"};

        let article = await Article.findOne({
            where: { id: like.article_id }
        });
        if (article != null) {
            await article.update({ likes: article.likes + 1 });
        }
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
}

var CreateMessage = async (ctx, next) => {
    var message = ctx.request.body;
    message.creator = 0;
    message.modifier = 0;
    try {
        var ret = await Message.create(message);
        ctx.response.status = 201;
        ctx.body = { detail: "保存消息成功。"};
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
}
var ListMessages = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限！"};
        return;   
    }

    let page      = parseInt(ctx.request.query.page);
    let page_size = parseInt(ctx.request.query.page_size);
    let search    = ctx.request.query.search;
    let params    = {};
    if (search != undefined && search != "") {  
        params = { [Op.or]: [{ name    : {[Op.substring]: search} }, 
                             { email   : {[Op.substring]: search} },
                             { phone   : {[Op.substring]: search} },
                             { content : {[Op.substring]: search} }] }
    }
    let msgObj = null;
    try {
        msgObj = await Message.findAndCountAll({
            where:  params,
            offset: (page - 1) * page_size,
            limit:  page_size,
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    let { count, rows } = msgObj;
    if (rows == null || rows.length == 0) {
        ctx.response.body = { detail: "没有消息！" };
        ctx.response.status = 400;
    } else {
        var ret = {};
        ret.count = count;
        ret.results = messages;
        ctx.response.body = ret;
        ctx.response.status = 200;
    }
}

var CreateTag = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限！"};
        return;   
    }
    
    let tag = {}
    tag.name = ctx.request.body.name;
    tag.creator = ctx.state.user.id;
    tag.modifier = ctx.state.user.id;
    let ret = null;
    try {
        ret = await Tag.create(tag);
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    
    if (ret == null) {
        ctx.response.body = { detail: "保存标签失败！" };
        ctx.response.status = 400;
    } else {
        ctx.response.status = 200;
    }
}
var ListTags = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }
    let tagObj = null;
    try {
         tagObj = await Tag.findAndCountAll();
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    let { count, rows } = tagObj;
    if (rows != null && rows.length > 0) {
        let ret = {};
        ret.count = count;
        ret.results = rows.map(tag=>{
            return {
                id:         tag.id,
                name:       tag.name,
                created_at: tag.created_at,
                modified_at:tag.modified_at }
        });

        ctx.response.body = ret;
        ctx.response.status = 200;
    } else {
        ctx.response.body = { detail: "没有标签！" };
        ctx.response.status = 400;
    }
}
var PutTag = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限！"};
        return;   
    }

    var tag = {};
    if (ctx.request.body.name != undefined && ctx.request.body.name != "") {
        tag.name = ctx.request.body.name;
    }
    tag.modifier = ctx.state.user.id;

     try {
        var result = await Tag.update(tag, {
            where: { id: ctx.params.id }
        });
        ctx.body = {"detail": "修改 tag 信息成功。"};
        return; 
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {"detail": "内部错误！"};
        console.log("e=",e);
        return ;
    }
}

var DeleteTag = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }

     try {
        var result = await Tag.destroy({
            where: { id: ctx.params.id }
        });
        ctx.body = {"detail": "delete tag 信息成功。"};
        return; 
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {"detail": "内部错误！"};
        console.log("e=",e);
        return;
    }
}

var is_leaf_node = async(catalog)=>{
    let hasDescendants = null;
    try {
        hasDescendants = await Catalog.findOne({
            where: { parent_id: catalog.id },
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return false;
    }
    
    if (hasDescendants==null) {
        return true;
    }

    return false;
}

var CreateCatalog = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }

    var catalog = {}
    catalog.name      = ctx.request.body.name;
    catalog.creator   = ctx.state.user.id;
    catalog.modifier  = ctx.state.user.id;
    catalog.parent_id = ctx.request.body.parent;
    let ret = null;
    try {
        ret = await Catalog.create(catalog);
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    if (ret == null) {
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 400;
    } else {
        ctx.response.status = 200;
    }
}

var ListCatalogs = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限."};
        return;   
    }
    let ret = [];
    let roots = null;
    let descendants = null;
    try {
        roots = await Catalog.findOne({
            where: { 
                [Op.or]: [{ id: 1 }, { parent_id: null }], 
            }
        });

        descendants = await Catalog.findAll({
            where: {
                [Op.and]: [
                  { id: {[Op.not]: 1} },
                  { parent_id: {[Op.not]: null} }
                ]
            },
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }

    if (roots == null) {
        ctx.response.status = 500;
        ctx.body = { detail: "获取分类失败。"};
        return;
    }
    roots = roots.dataValues;
    var root_dict = roots;
    root_dict["children"] = [];
    ret.push(root_dict);
 
    var parent_dict = { [roots.id]:root_dict };
    var parent_id = 0, parent = null, data = null;
    for (cls of descendants) {
        data = cls.dataValues;
        parent_id = data.parent_id;
        parent = parent_dict[parent_id];
        parent["children"].push(data) 
        
        var is_leaf = await is_leaf_node(data);
        if (is_leaf == false) { 
             data["children"] = [];
             parent_dict[data.id] = data;
        }
    }

    ctx.body = ret;
}
var PatchCatalog = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限！"};
        return;   
    }

    var catalog = {};
    if (ctx.request.body.name != undefined && ctx.request.body.name != "") {
        catalog.name = ctx.request.body.name;
    }
    catalog.modifier = ctx.state.user.id;

     try {
        var result = await Catalog.update(catalog, {
            where: { id: ctx.params.id }
        });
        ctx.body = {"detail": "修改 catalog 信息成功。"};
        return; 
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {"detail": "内部错误！"};
        console.log("e=",e);
        return ;
    }
}

var DeleteCatalog = async (ctx, next) => {
    if (ctx.state.user.is_superuser != true) {
        ctx.response.status = 400;
        ctx.body = {"detail": "没有管理员权限！"};
        return;   
    }

     try {
        var result = await Catalog.destroy({
            where: { id: ctx.params.id }
        });
        ctx.body = {"detail": "delete catalog信息成功。"};
        return; 
    } catch (e) {
        ctx.response.status = 400;
        ctx.body = {"detail": "内部错误！"};
        console.log("e=",e);
        return ;
    }
}

var GetNumbers = async (ctx, next) => {
    try {
        ctx.body = {
            views:     await Article.sum("views"),
            likes:     await Article.sum("likes"),
            comments:  await Article.sum("comments"),
            messages:  await Message.count()
        };
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
    }
}

var GetTops = async (ctx, next) => {
    let tops = null;
    try {
        tops = await Article.findAll({
            order: sequelize.literal("views DESC"),
            limit: 10
        });
    } catch (e) {
        console.log("e=",e);
        ctx.response.body = { detail: "内部错误！" };
        ctx.response.status = 500;
        return;
    }
    
    if (tops != null && tops.length > 0) {
        var ret = {};
        ret.count = tops.length;
        ret.results = tops.map(article=>{
            return {
                id:     article.id,
                title:  article.title,
                views:  article.views,
                likes:  article.likes,
            };
        });
        ctx.body = ret;
    } else {
        ctx.response.status = 400;
        ctx.body = {"detail": "内部错误！"};
    }
}

var GetElasticSearch = async (ctx, next) => {
    let page      = parseInt(ctx.request.query.page);
    let page_size = parseInt(ctx.request.query.page_size);
    let text    = ctx.request.query.text;

    const retObj = await ESSearchIndex(page, page_size, text);
    ctx.response.body = retObj;
}


module.exports = {
    "POST /api/article/":       CreateArticle,
    "GET /api/article/":        ListArticles,
    "GET /api/article/:id":     GetArticle,
    "PUT /api/article/:id":     PutArticle,
    "PATCH /api/article/:id":   PutArticle,
    
    "GET /api/archive/":        ListArchive,

    "POST /api/comment/":       CreateComment,
    "GET /api/comment/":        ListComments,

    "POST /api/like/":          CreateLike,

    "POST /api/message/":       CreateMessage,
    "GET /api/message/":        ListMessages,

    "POST /api/tag/":           CreateTag,
    "GET /api/tag/":            ListTags,
    "PUT /api/tag/:id":         PutTag,
    "DELETE /api/tag/:id":      DeleteTag,

    "POST /api/catalog/":       CreateCatalog,
    "GET /api/catalog/":        ListCatalogs,
    "PATCH /api/catalog/:id":   PatchCatalog,
    "DELETE /api/catalog/:id":  DeleteCatalog,

    "GET /api/number/":         GetNumbers,
    "GET /api/top/":            GetTops,
    "GET /api/es/":             GetElasticSearch
}; 

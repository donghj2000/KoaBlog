const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });

const { Article, Tag, Catalog } = require("./models/blog");
const config = require("./config");

var setmap = {
	settings: {
	    index: {
	        number_of_shards: 1,
	        number_of_replicas: 0
	    }
	},
	mappings: {
        properties: {
            "id": {
                "type": "integer"
            },
            "title": {
                "search_analyzer": "ik_smart",
                "analyzer": "ik_smart",
                "type": "text"
            },
            "excerpt": {
                "search_analyzer": "ik_smart",
                "analyzer": "ik_smart",
                "type": "text"
            },
            "keyword": {
                "search_analyzer": "ik_smart",
                "analyzer": "ik_smart",
                "type": "text"
            },
            "markdown": {
                "search_analyzer": "ik_smart",
                "analyzer": "ik_smart",
                "type": "text"
            },
            "category_info": {
                "properties": {
                    "name": {
                        "search_analyzer": "ik_smart",
                        "analyzer": "ik_smart",
                        "type": "text"
                    },
                    "id": {
                        "type": "integer"
                    }
                }
            },
            "views": {
                "type": "integer"
            },
            "comments": {
                "type": "integer"
            },
            "likes": {
                "type": "integer"
            },
            "tags_info": {
                "properties": {
                    "name": {
                        "search_analyzer": "ik_smart",
                        "analyzer": "ik_smart",
                        "type": "text"
                    },
                    "id": {
                        "type": "integer"
                    }
                }
            }
        }
	}
}

const ESCreateIndex = async () => {
	var ret = await client.indices.delete({
		index: config.ELASTICSEARCH_INDEX,
		ignore_unavailable: true
	});

    ret = await client.indices.create({
        index: config.ELASTICSEARCH_INDEX,
        body: setmap
    });

    let page      = 1;
	let page_size = 10;
	while (true) {
		let articles = await Article.findAll({
	        offset:  (page - 1) * page_size,
	        limit:   page_size,
	        include: [ Catalog, Tag ]
	    });

		if (articles == null || articles.length == 0) {
			break;
		}

		for (article of articles) {
        	let tags_info = article.Tags.map(tag=>{
        		return {
					id: 		tag.id,
					name: 		tag.name }
			});
			let catalog_info = {
				id: 		article.Catalog.id,
	    		name: 		article.Catalog.name,
			}
        	let body = {
        		id:         article.id,
            	title: 		article.title,
            	excerpt:  	article.excerpt,
            	keyword:    article.keyword,
            	markdown:   article.markdown,
            	tags_info:  tags_info,
            	catalog_info: catalog_info,
            	views: 		article.views,
            	comments: 	article.comments,
            	likes: 		article.likes
        	};

        	try {
				ret = await client.index({
					index: config.ELASTICSEARCH_INDEX, 
					id: article.id,
					body: body
				});
			} catch (e) {
				console.log('e=',e);
			}
        };

		page++;
	}
}


const ESUpdateIndex = async (article) => {
	if (config.ELASTICSEARCH_ON == false) {
		return;
	}
	let tags_info = article.Tags.map(tag=>{
		return {
			id: 	tag.id,
			name: 	tag.name 
		}
	});
	let catalog_info = {
		id: 		article.Catalog.id,
		name: 		article.Catalog.name,
	}
	let body = {
		id:         article.id,
    	title: 		article.title,
    	excerpt:  	article.excerpt,
    	keyword:    article.keyword,
    	markdown:   article.markdown,
    	tags_info:  tags_info,
    	catalog_info: catalog_info,
    	views: 		article.views,
    	comments: 	article.comments,
    	likes: 		article.likes
	};

	try {
		ret = await client.index({
			index:   config.ELASTICSEARCH_INDEX, 
			refresh: true,
			id:      article.id,
			body:    body
		});
	} catch (e) {
		console.log('e=',e);
	}
}

const ESSearchIndex = async (page, page_size, search_text) => {
	if (config.ELASTICSEARCH_ON == false) {
		return { count: 0, results: [] };
	}
	let ret = null;
	try {
		ret = await client.search({
			index: config.ELASTICSEARCH_INDEX,
			body: {
				"query": { 
			    	"bool": { 
			      		"should": [
			        		{ "match": { "title":   		   search_text }}, 
			        		{ "match": { "excerpt": 		   search_text }},
			        		{ "match": { "keyword": 		   search_text }}, 
			        		{ "match": { "markdown": 		   search_text }},
			        		{ "match": { "tags_info.name":     search_text }},
			        		{ "match": { "catalog_info.name":  search_text }}, 
			      		]
			    	}
			  	}
			},
			"from": (page - 1) * page_size,
		  	"size": page_size
		});
	} catch (e) {
		console.log(e);
		ret = null;
	}

	let articleList= null;
	if (ret != null) {
		//console.log('search ret=', ret.body.hits.total,ret.body.hits.hits);
		if (ret.body.hits.total.value > 0) {
			articleList = ret.body.hits.hits.map(article=>{
				return { object: article._source }  //兼容前端
			});
			return { count: ret.body.hits.total.value, results: articleList };
		} 
	}
	
	return { count: 0, results: [] };
}
module.exports = {
	ESCreateIndex,
	ESUpdateIndex,
	ESSearchIndex
}
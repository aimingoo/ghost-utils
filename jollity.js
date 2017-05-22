/*
	Collect some ghost json files to a single
	Usage:
		node jollity.js [files ...]
*/

if (process.argv.length < 3) {
	console.error('Collect some ghost json files to a single\nUsage: \n\tnode jollity.js [files ...]');
	process.exit();
}

var all = [];
process.argv
	.filter(function(arg, i) { return i > 1})
	.forEach(function(json) { all.push(require(json)) });

var base = all.shift(), collected = {};
var baseTagNames = {};
var maxTagId = base.data.tags[base.data.tags.length-1].id;
var maxPostId = base.data.posts[base.data.posts.length-1].id;
base.data.posts.forEach(function(post) { collected[post.title] = [post.author_id] });
base.data.tags.forEach(function(tag, i) { baseTagNames[tag.name] = tag.id });

// push a post to base, and update posts_tags and tgas table
function push(post, ref) {
	// update post's attribute, and push
	var oldId = post.id;
	post.id = ++maxPostId;
	if (ref.slug_fromid) {
		post.slug = post.slug.replace(new RegExp(oldId+'$'), post.id)
	}
	base.data.posts.push(post);
	// check tags
	(ref.posts[oldId] || []).forEach(function(id) { // post->tag id map
		var refTag = ref.tags[id], tag = baseTagNames[refTag.name];
		if (! tag) {
			tag = Object.assign({}, refTag, { id: ++maxTagId }); // make new tag with new id
			base.data.tags.push(baseTagNames[tag.name] = tag);
		}
		base.data.posts_tags.push({
			tag_id: tag.id,
			post_id: post.id
		});
	});
}

// collect all json
all.forEach(function(json){
	var ref = {slug_fromid: false, posts: {}, tags: {}};
	var lastPost = json.data.posts[json.data.posts.length-1];
	ref.slug_fromid = !!lastPost.slug.match(new RegExp(lastPost.id + '$'));
	json.data.posts_tags.forEach(function(item) { (ref.posts[item.post_id] || (ref.posts[item.post_id]=[])).push(item.tag_id) });
	json.data.tags.forEach(function(tag) { ref.tags[tag.id] = tag }); // array to map

	json.data.posts.forEach(function(post) {
		if (!collected[post.title] || // none this title, or
			(collected[post.title].indexOf(post.author_id) < 0)) { // another author
			(collected[post.title] || (collected[post.title] = [])).push(post.author_id);
			push(post, ref);
		}
	});
});

console.log(JSON.stringify(base, null, '\t'));

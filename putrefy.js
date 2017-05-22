/*
	Preprocess for ghost's import JSON file transform from wordpress xml
	 - decode any values
	 - update or remove tags
	 - update author_id
	 - update language
	 - reset post's slug

	Usage:
		node putrefy.js <file.xml>
*/
var MAX_SLUG_LEN = 150; //ghost currently limit slug length to 150 in db, which is shorter than wordpress's 200 limit
var MAX_POST_TITLE_LEN = 150; //ghost currently limit title length to 150 in db, while wordpress is unlimited
var TAG_MINVOTE = 5; // over the votes canbe saved
var NEW_LANGUAGE = 'zh_CN'; // other languages, or false
var SLUG_FROMID = true; // true, false, or prefix string

var author_map = {
	"1": {
		"newValue": false, // !!!WARNNING - DONT USE!!! new author_id in ghost database, or set false to skip
		"author_id": true, // a special value, or use newValue when set true, ignore false value
		"created_by": true,
		"published_by": true,
		"updated_by": true
	}
}

// false/true => reserve the key
// "..." => update the key's slug
// {} => update/apply these properties, description/slug etc.
var updated_tags = {
	"web": false,
	"游戏": false,
	"object": false,
	"读书": true
}

if (process.argv.length < 3) {
	console.error('Putrefy wordpress JSON to pretty import file of ghost\nUsage: \n\tnode putrefy.js <a .json by BlogsToWordpress>');
	process.exit();
}

var json = require(process.argv[2])
var rx = /^[\u0020-\u007e]*%[A-F0-9]{2}%/;
var withError = [];

function decode(obj) {
	for (key in obj) {
		switch (typeof obj[key]) {
			case 'string':
				if (rx.exec(obj[key]))
					obj[key] = decodeURIComponent(obj[key]);
				if ((key == 'slug' && obj[key].length > MAX_SLUG_LEN) ||
					(key == 'title' && obj[key].length > MAX_POST_TITLE_LEN)) {
					withError.push({name: key, value: obj[key]});
				}
				break
			case 'object': decode(obj[key]); break
		}
	}
}

decode(json)

if (withError.length > 0) {
	console.error('Error: title/slug too long(>150 chars), plesase fix in source xml file')
	withError.forEach(function(error, i) {
		console.error('\t' + i + ': ' + JSON.stringify(error));
	});
	process.exit(1);
}

var counter = {};
json.data.posts_tags.forEach(function(post) {
	this[post.tag_id] = (this[post.tag_id] || 0) + 1;
}, counter)

Object.keys(counter).forEach(function(id) {
	if (this[id] < TAG_MINVOTE) delete this[id];
}, counter)

json.data.posts_tags = json.data.posts_tags.filter(function(item) { return item.tag_id in counter });
json.data.tags = json.data.tags
	.filter(function(item) { return item.id in counter })
	.filter(function(item) { return !(item.name in updated_tags) || updated_tags[item.name] });

// update with updated_tags
json.data.tags.forEach(function(item) {
	var newValue = updated_tags[item.name];
	switch (typeof newValue) {
		case 'string': item.slug = newValue; break;
		case 'object': Object.assign(item, newVlaue); break;
	}
});

// update languages
NEW_LANGUAGE && json.data.posts.forEach(function(item) {
	item.language = NEW_LANGUAGE;
});

// reset slug for posts
if (SLUG_FROMID) {
	var prefix = SLUG_FROMID;
	if (SLUG_FROMID === true) { // use author_id as prefix
		var prefix = "1-";
		if (author_map["1"] !== false && author_map["1"].newValue !== false) {
			prefix = author_map["1"].newValue.toString() + '-';
		}
	}
	json.data.posts.forEach(function(item) {
		item.slug = prefix + item.id;
	});
}

// update author_id, etc
Object.keys(author_map)
	.filter(function(id) { return author_map[id] !== false && author_map[id].newValue !== false })
	.forEach(function(id) {
		var ref = author_map[id], value = parseInt(id), newValue = ref.newValue;
		var keys = Object.keys(ref).filter(function(key) { return (key != 'newValue') && (ref[key] !== false) });
		json.data.posts.forEach(function(post) {
			if (post.author_id != value) return;
			keys.forEach(function(key) {
				post[key] = (ref[key] === true) ? newValue : ref[key]
			})
		})
	});

console.log(JSON.stringify(json, null, '\t'));

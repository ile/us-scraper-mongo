/*
 * Uusi Suomi Scraper
 * 
 * Saves data to mongodb, db us-scraper, collection posts
 *
 * (C) Ilkka Huotari
 */

var jsdom = require("jsdom"),
	fs = require("fs"),
	mongo = require('mongoskin'),
	jquery = fs.readFileSync("./jquery.js", "utf-8");

function usage() {
	console.log('\nScrape usage');
	console.log('\tnode index.js scrape <url>\n');
}

function output(data, i) {
	i = i || 0;
	var db = mongo.db("mongodb://localhost:27017/us-scraper", {native_parser:true}),
		doc = data[i];
	db.bind('posts');

	if (doc) {
		db.posts.insert(doc, function err(error, inserted) {
			if (error) console.log(error);
			output(data, i + 1);
		});
	}
	else {
		console.log('Done.');
		process.exit();
	}
}

function getContents(links, data, i) {
	data = data || [];
	i = i || 0;
	var url = links[i];

	function done(errors, window) {
		var $ = window.$;

		data.push({
			url: url,
			body: $('#main-content > .node').html(),
			comments: $('#comments').html()
		});

		getContents(links, data, i + 1);
	}

	if (url) {
		console.log('get contents ' + url);
		jsdom.env({
			url: url,
			src: [ jquery ],
			done: done
		});
	}
	else {
		console.log('Sending to Mongo... (' + data.length + ')');
		output(data);
	}
}

function getLinks(url, links) {
	console.log('get links '+url);

	jsdom.env({
		url: url,
		src: [ jquery ],
		done: function (errors, window) {
			var $ = window.$;

			// scrape links from the page
			var l = $("#main-content .view-content .teaser h2 a");

			l.each(function(index) {
				links.push(this.href);
			});

			// scrape link to the next page
			var next = $("#main-content .pager-next a").first();

			if (next && next[0]) {
				getLinks(next[0].href, links);
			} else {
				getContents(links.reverse());
			}
		}
	});
}

(function main() {
	var url;

	if (process.argv.length !== 3) {
		usage();
		process.exit(1);
	}
	
	url = process.argv[2];
	getLinks(url, []);
}());


/*
 * Uusi Suomi Scraper
 * 
 * Saves data to mongodb, db us-scraper, collection posts
 *
 * (C) Ilkka Huotari
 */

var cheerio = require("cheerio"),
	mongo = require('mongoskin'),
	moment = require('moment'),
	request = require('request'),
	db = mongo.db("mongodb://localhost:27017/scraper", {native_parser:true});

db.bind('posts');

function usage() {
	console.log('\nScrape usage');
	console.log('\tnode index.js scrape <url>\n');
}

// get url contents (blog post)
function getContents(url, i, links) {

	function next() {
		i = i + 1;
		getContents(links[i], i, links);
	}

	function done(error, response, body) {
		if (error) {
			console.log(i+": "+error);

			// try again
			getContents(url, i, links);
		}
		else {
			var $ = cheerio.load(body),
				doc;

			try {
				doc = {
					url: url,
					body: $('#main-content > .node').html(),
					comments: $('#comments').html(),
					date: moment($('#main-content > .node > .submitted').html().trim()+' +03:00', 'DD.MM.YYYY HH:mm ZZ').toDate()
				};
			}
			catch (e) {
				console.log(e);

				// try again
				getContents(url, i, links);
			}

			db.posts.insert(doc, function err(error, inserted) {
				if (error) {
					console.log(error);
				}
				else next();
			});
		}
	}

	if (url) {
		db.posts.findOne({ url: url }, function(err, document) {
			if (!document) {
				console.log('get contents (' + i + ') ' + url);
				request(url, done);
			}
			else {
				console.log('already exists: ' + url);
				next();
			}
		});
	}
	else {
		console.log('Done.');
		process.exit();
	}
}

// get links to blog posts
function getLinks(baseUrl, url, links) {
	links = links || [];
	url = url || baseUrl;
	console.log('get links '+url);

	function done(error, response, body) {
		function get(i) {
			return function() {
				getContents(links[i], i + 1);
			};
		}

		if (error) {
			console.log(error);
		}
		else {
			var $ = cheerio.load(body);

			// scrape links from the page
			var l = $("#main-content .view-content .teaser h2 a");

			l.each(function(index) {
				links.push(absolute(baseUrl, this.attribs.href));
			});

			// scrape link to the next page
			var next = $("#main-content .pager-next a").first();

			if (next && next.length) {
				getLinks(baseUrl, absolute(baseUrl, next.attr('href')), links);
			} else {
				console.log('getting contents (' + links.length + ')');
				links = links.reverse();
				getContents(links[0], 0, links);
			}
		}
	}

	request(url, done);
}

function absolute(base, relative) {
    return relative.match(/^https?:/)? relative: base + relative;
}

(function main() {
	var url;

	if (process.argv.length !== 3) {
		usage();
		process.exit(1);
	}
	
	url = process.argv[2];
	getLinks(url);
}());


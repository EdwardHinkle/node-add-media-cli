#!/usr/bin/env node

import * as moment from 'moment';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as program from 'commander';
import * as yaml from 'js-yaml';
import * as cheerio from 'cheerio';
import * as request from 'request';
import { igdb } from 'igdb-api-node';

var config = require('../config.json');

const MovieDB = require('moviedb')(config.moviedb_key);
// const GameDB = igdb(config.igdb_key);
const defaultTaskStatus = "finished";

program.option('-t, --type <type>', 'What type of watch post it is')
  .option('-S, --status <status>', 'The status of the watch post: interested, inprogress or finished', /^(interested|inprogress|finished)$/i, defaultTaskStatus) // All
  .option('--private', 'Mark this post as a private post') // All
  .option('--duration', 'The duration of the activity') // All
  .option('-m, --message <message>', 'This is the message you want to put in the content of the post') // All
  .option('-c, --category <category>', 'These are the categories you want to attach to the post', function list(val) {
      return val.toLowerCase().split(',');
  }) // All
  .option('-d, --date [date]', 'This is the date of the watch post', function datetime(val){
    return moment(val, "MMM D, YYYY h:mm A");
  }) // All
  .option('-n, --name <name>', 'The name of what is being watched') // TV/Movie/Web Video/Game
  .option('-s, --season <season>', 'The season number of a tv show', parseInt) // TV
  .option('-e, --episode <episode>', 'The episode number of a tv show', parseInt) // TV
  .option('--season-premiere', 'Mark this post as a season premiere') // TV
  .option('--season-finale', 'Mark this post as a season finale') // TV
  .option('--show-premiere', 'Mark this post as a show premiere') // TV
  .option('--show-finale', 'Mark this post as a show finale') // TV
  .option('-u, --url <url>', 'The url of the given item') // Podcast/Web Video
  .option('-v, --video <video>', 'The url of the video property') // Podcast/Web Video
  .option('--microblog', 'Set that this post should syndicate to microblog')
  .parse(process.argv);

var searchType = program.type;
var watchStatus = program.status.toLowerCase();
var watchVisibility = program.private ? 'private' : 'public';
var syndicateToMicroblog = program.microblog ? true : false;
var watchContent = program.message ? program.message : '';
var postCategory = program.category;
var postDate = program.date || moment();


switch (searchType) {
    case "movie": addMovie(); break;
    case "tv": addTv(); break;
    case "video": addWebVideo(); break;
//     case "game": addGame(); break;
}

function addWebVideo() {

    let data = {
        'date': postDate.format("YYYY-MM-DD HH:mm:ss ZZ"),
        'layout': 'entry',
        'title': '',
        'visibility': watchVisibility,
        'tags': postCategory,
        'properties': {
            'watch-of': {
                'type': 'h-cite',
                'properties': {
                    url: program.url,
                    video: program.video,
                    name: program.name
                }
            },
            'task-status': watchStatus,
        },
        'content': watchContent,
        'slug': '',
        'permalink': '/:year/:month/:day/:slug/watch/'
    };

    if (data.properties['watch-of'].properties.video === undefined) {
        delete data.properties['watch-of'].properties.video;
    }

    console.log("Debugging Web Video");
    console.log(data);
    console.log(data.properties['watch-of'].properties);

    saveFile(data);

}

function addMovie() {
    var watchName, imdbId, watchUrl, watchImageUrl;
    var searchTitle = program.name;
    MovieDB.searchMovie({ query: searchTitle }, (err, res) => {
        var movieResult = res.results[0];

        MovieDB.movieInfo({ id: movieResult.id }, (err, movieInfo) => {

            let data = {
                'type': ['h-entry'],
                'properties': {
                    'published': postDate.format("YYYY-MM-DD HH:mm:ss ZZ"),
                    'visibility': watchVisibility,
                    'category': postCategory,
                    'watch-of': {
                        'type': 'h-cite',
                        'properties': {
                            'name': movieInfo.title,
                            'url': movieInfo.homepage,
                            'photo': `https://image.tmdb.org/t/p/w1280${movieInfo.poster_path}`,
                            'imdb-id': movieInfo.imdb_id,
                        }
                    },
                    'task-status': watchStatus,
                    'content': watchContent
                }
            };

            saveFile(data);
        });
    });
}

function addTv() {
    var watchName, imdbId, watchUrl, watchImageUrl;
    var searchTitle = program.name;
    var seasonId = program.season;
    var episodeId = program.episode;
    var watchEpisodeSpecial = "";
    if (program['seasonPremiere']) {
        watchEpisodeSpecial = "season_premiere";
    }
    if (program['seasonFinale']) {
        watchEpisodeSpecial = "season_finale";
    }
    if (program['showPremiere']) {
        watchEpisodeSpecial = "show_premiere";
    }
    if (program['showFinale']) {
        watchEpisodeSpecial = "show_finale";
    }

    MovieDB.searchTv({ query: searchTitle }, (err, res) => {
        if (err) {
            console.log("Error");
            console.log(err);
        }
        var showResult = res.results[0];

        if (seasonId == undefined) {
            MovieDB.tvInfo({ id: showResult.id }, (err, show) => {
                console.log(show.name + " has " + show.number_of_seasons + " seasons available");
            });
        } else if (episodeId == undefined) {
            console.log(showResult.name + " Season " + seasonId + " has the following Episodes");
            MovieDB.tvSeasonInfo({ id: showResult.id, season_number: seasonId }, (err, episodeInfo) => {
                _.each(episodeInfo.episodes, (episode: any) => {
                    console.log("Episode " + episode.episode_number + ": " + episode.name + " (" + moment(episode.air_date, "YYYY-MM-DD").format("MMM D, Y") + ")");
                });
            });
        } else {
            MovieDB.tvInfo({ id: showResult.id }, (err, showInfo) => {

                MovieDB.tvExternalIds({ id: showResult.id }, (err, showIds) => {

                    MovieDB.tvSeasonInfo({ id: showResult.id, season_number: seasonId }, (err, seasonInfo) => {

                        MovieDB.tvEpisodeInfo({ id: showResult.id, season_number: seasonId, episode_number: episodeId }, (err, episodeInfo) => {

                            if (episodeInfo == null) {
                                console.log("Error! Episode Info is empty");
                                return;
                            }

                            watchImageUrl = (seasonInfo.poster_path ? seasonInfo.poster_path : showInfo.poster_path);

                            let data = {
                                'type': ['h-entry'],
                                'properties': {
                                    'published': postDate.format("YYYY-MM-DD HH:mm:ss ZZ"),
                                    'visibility': watchVisibility,
                                    'category': postCategory,
                                    'watch-of': {
                                        'type': 'h-cite',
                                        'properties': {
                                            'name': showResult.name,
                                            'url': showInfo.homepage,
                                            'photo': `https://image.tmdb.org/t/p/w1280${watchImageUrl}`,
                                            'imdb-id': showIds.imdb_id,
                                            'episode': {
                                                'type': 'h-cite',
                                                'properties': {
                                                    'name': episodeInfo.name,
                                                    'photo': `https://image.tmdb.org/t/p/w1280${episodeInfo.still_path}`,
                                                    'season-number': seasonId,
                                                    'episode-number': episodeId,
                                                }
                                            }
                                        }
                                    },
                                    'task-status': watchStatus,
                                    'content': watchContent
                                }
                            };

                            if (watchEpisodeSpecial > "") {
                                data.properties["watch-of"].properties.episode.properties["special-episode"] = watchEpisodeSpecial;
                            }

                            saveFile(data);
                        });
                    });
                });
            });
        }
    });
}


function saveFile(data) {

    if (syndicateToMicroblog) {
        if (data.properties === undefined) {
            data.properties = {};
        }
        data.properties['abode-channel'] = ['timeline'];
        data.properties.syndication = [
            {
                'name': 'micro.blog',
                'icon': 'fa-globe',
                'url': 'https://micro.blog/EddieHinkle'
            }
        ];
    }

    // let now = moment(data.date, "YYYY-MM-DD HH:mm:ss ZZ");
    // let year = now.format("YYYY");
    // let month = now.format("MM");
    // let day = now.format("DD");
    // let dataDir = __dirname + '/../../../production/eddiehinkle.com/jekyll/_source';
    
    // var postIndex = 1;
    // var yearDir = `${dataDir}/_note/posts/${year}`;
    // if (!fs.existsSync(yearDir)) {
    //     fs.mkdirSync(yearDir);
    //     console.log(yearDir + " created");
    // }
    // var monthDir = `${yearDir}/${month}`;
    // if (!fs.existsSync(monthDir)) {
    //     fs.mkdirSync(monthDir);
    //     console.log(monthDir + " created");
    // }
    // var dayDir = `${monthDir}/${day}`;
    // if (!fs.existsSync(dayDir)) {
    //     fs.mkdirSync(dayDir);
    //     console.log(dayDir + " created");
    // } else {
    //     var dirContents = fs.readdirSync(dayDir);
    //     dirContents = _.filter(dirContents, (filename) => {
    //         return (fs.statSync(dayDir + "/" + filename).isDirectory() && fs.existsSync(`${dayDir}${filename}/post.md`));
    //     });
    //     postIndex = dirContents.length + 1;
    // }
    //
    // while(fs.existsSync(`${dayDir}/${postIndex}/post.md`)) {
    //     postIndex++;
    // }
    // fs.mkdirSync(`${dayDir}/${postIndex}`);
    //
    // // Set slug number to post index
    // data.slug = '' + postIndex;

    // // Move content out of yaml into the main body
    // let postContents = data.content;
    // delete data.content;

    // var fileData = "---\n" + yaml.safeDump(data, { lineWidth: 800 }) + "---\n" + postContents;
    //
    // fs.writeFile(`${dayDir}/${postIndex}/post.md`, fileData, function(err) {
    //     if(err) {
    //         return console.log(err);
    //     }
    //
    //     console.log(`Finished saving: ${dayDir}/${postIndex}/post.md`);
    // });

    request.post(`https://eddiehinkle.com/micropub`, {
        'auth': {
            'bearer': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJodHRwczovL3F1aWxsLnAzay5pby8iLCJtZSI6Imh0dHBzOi8vZWRkaWVoaW5rbGUuY29tLyIsImlkIjoxNTM3MjIyNjk1NTM4LCJzY29wZSI6WyJjcmVhdGUiLCJ1cGRhdGUiLCJtZWRpYSJdLCJpYXQiOjE1MzcyMjI2OTV9.FnsWsZJrl6HKQoV5DBAYlFANbBAiHO4vIwlTOb43LEQ`
        },
        body: data,
        json: true
    }, (err, data) => {
        if (err != undefined) {
            console.log(`ERROR: ${err}`);
        }
        if (data.statusCode !== 201 && data.statusCode !== 202) {
            console.log("Watch post Micropub error");
        } else {
            console.log("Successfully created Micropub request");
        }
    });

}

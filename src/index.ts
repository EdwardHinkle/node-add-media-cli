#!/usr/bin/env node

import * as moment from 'moment';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as program from 'commander';

var config = require('../config.json');

const MovieDB = require('moviedb')(config.moviedb_key);
const defaultWatchStatus = "finished";

program.option('-t, --type <type>', 'What type of watch post it is')
  .option('-n, --name <name>', 'The name of what is being watched')
  .option('-s, --season <season>', 'The season number of a tv show', parseInt)
  .option('-e, --episode <episode>', 'The episode number of a tv show', parseInt)
  .option('-S, --status <status>', 'The status of the watch post: interested, inprogress or finished', /^(interested|inprogress|finished)$/i, defaultWatchStatus)
  .option('--private', 'Mark this post as a private post')
  .option('-m, --message <message>', 'This is the message you want to put in the content of the post')
  .option('-c, --category <category>', 'These are the categories you want to attach to the post', function list(val) {
      return val.toLowerCase().split(',');
  })
  .option('-d, --date [date]', 'This is the date of the watch post', function datetime(val){
    return moment(val, "MMM D, YYYY h:mm A");
  })
  .parse(process.argv);

var watchName, imdbId, watchUrl, watchImageUrl;

var searchType = program.type;
var searchTitle = program.name;
var seasonId = program.season;
var episodeId = program.episode;
var watchStatus = program.status.toLowerCase();
var watchVisibility = program.private ? 'private' : 'public';
var watchContent = program.message ? program.message : '';
var postCategory = program.category;
var postDate = program.date || moment();

if (searchType == "movie") {
    MovieDB.searchMovie({ query: searchTitle }, (err, res) => {
        var movieResult = res.results[0];

        MovieDB.movieInfo({ id: movieResult.id }, (err, movieInfo) => {

            saveMovieTemplate({
                postCategory: postCategory,
                watchStatus: watchStatus,
                watchName: movieInfo.title,
                imdbId: movieInfo.imdb_id,
                watchUrl: movieInfo.homepage,
                watchImageUrl: movieInfo.poster_path,
                watchContent: watchContent,
                watchVisibility: watchVisibility
            })
        });
    });
} else if (searchType == "tv") {
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
                _.each(episodeInfo.episodes, (episode) => {
                    console.log("Episode " + episode.episode_number + ": " + episode.name + " (" + moment(episode.air_date, "YYYY-MM-DD").format("MMM D, Y") + ")");
                });
            });
        } else {
            MovieDB.tvInfo({ id: showResult.id }, (err, showInfo) => {

                MovieDB.tvExternalIds({ id: showResult.id }, (err, showIds) => {

                    MovieDB.tvSeasonInfo({ id: showResult.id, season_number: seasonId }, (err, seasonInfo) => {

                        MovieDB.tvEpisodeInfo({ id: showResult.id, season_number: seasonId, episode_number: episodeId }, (err, episodeInfo) => {

                            saveTvTemplate({
                                postCategory: postCategory,
                                watchStatus: watchStatus,
                                watchName: showResult.name,
                                watchSeason: seasonId,
                                watchEpisode: episodeId,
                                imdbId: showIds.imdb_id,
                                watchUrl: showInfo.homepage,
                                watchImageUrl: (seasonInfo.poster_path ? seasonInfo.poster_path : showInfo.poster_path),
                                watchEpisodeImageUrl: episodeInfo.still_path,
                                watchContent: watchContent,
                                watchVisibility: watchVisibility
                            })
                        });
                    });
                });
            });
        }
    });
}


function saveMovieTemplate(info) {
    var template = "---\nlayout: post\ntitle:  ''\nvisibility: {{post_visibility}}\ndate:   {{date}}\ntags: [{{category}}]\nstatus: {{status}}\nmovie_name: \"{{name}}\"\nimdb_id: {{imdb_id}}\nmovie_url: {{movie_url}}\nmovie_image: {{movie_image_url}}\npermalink: /watch/:year/:month/:title/\n---\n{{content}}";

    var data = { formatted: undefined, filename: "watch/movie/" + (info.watchName.replace(/ /g, "-").replace(/[\'\":.]/g, "") + "-" + info.watchStatus + ".md").toLowerCase() };

    data.formatted = template.replace("{{date}}", postDate.format("YYYY-MM-DD HH:mm:ss ZZ"))
    .replace("{{category}}", "[" + info.postCategory.join(", ") + "]")
    .replace("{{content}}", info.watchContent)
    .replace("{{status}}", info.watchStatus)
    .replace("{{post_visibility}}", info.watchVisibility)
    .replace("{{name}}", info.watchName)
    .replace("{{imdb_id}}", info.imdbId)
    .replace("{{movie_url}}", info.watchUrl)
    .replace("{{movie_image_url}}", 'https://image.tmdb.org/t/p/w1280' + info.watchImageUrl);

    saveFile(data);

}

function saveTvTemplate(info) {
    var template = "---\nlayout: post\ntitle:  ''\nvisibility: {{post_visibility}}\ndate:   {{date}}\ntags: [{{category}}]\nstatus: {{status}}\nshow_name: \"{{name}}\"\nshow_season: {{show_season}}\nshow_episode: {{show_episode}}\nimdb_id: {{imdb_id}}\nshow_url: {{show_url}}\nshow_image: {{show_image_url}}\nepisode_image: {{episode_image_url}}\npermalink: /watch/:year/:month/:title/\n---\n{{content}}";

    var data = { formatted: undefined, filename: "watch/tv/" + (info.watchName.replace(/ /g, "-").replace(/[\'\":.]/g, "") + "-s" + info.watchSeason + "-e" + info.watchEpisode + "-" + info.watchStatus + ".md").toLowerCase() };

    data.formatted = template.replace("{{date}}", postDate.format("YYYY-MM-DD HH:mm:ss ZZ"))
    .replace("{{category}}", info.postCategory.join(", "))
    .replace("{{content}}", info.watchContent)
    .replace("{{status}}", info.watchStatus)
    .replace("{{post_visibility}}", info.watchVisibility)
    .replace("{{name}}", info.watchName)
    .replace("{{show_season}}", info.watchSeason)
    .replace("{{show_episode}}", info.watchEpisode)
    .replace("{{imdb_id}}", info.imdbId)
    .replace("{{show_url}}", info.watchUrl)
    .replace("{{show_image_url}}", 'https://image.tmdb.org/t/p/w1280' + info.watchImageUrl)
    .replace("{{episode_image_url}}", 'https://image.tmdb.org/t/p/w1280' + info.watchEpisodeImageUrl);

    saveFile(data);

}

function saveFile(data) {
    fs.writeFile(__dirname + '/../../abode-eddie/jekyll/_source/_media/' + data.filename, data.formatted, function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("Finished saving " + data.filename);
    }); 
}
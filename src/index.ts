import * as moment from 'moment';
import * as fs from 'fs';
import * as _ from 'lodash';

var config = require('../config.json');

const MovieDB = require('moviedb')(config.moviedb_key);
const defaultWatchStatus = "finished";

var postCategory, watchStatus, watchName, imdbId, watchUrl, watchImageUrl;

var searchType = process.argv[2];
var searchTitle = process.argv[3];

if (searchType == "movie") {
    postCategory = process.argv[4] ? process.argv[4].toLowerCase() : undefined;
    watchStatus = process.argv[5] ? process.argv[5].toLowerCase() : defaultWatchStatus;
    
} else if (searchType == "tv") {
    var seasonId = process.argv[4];
    var episodeId = process.argv[5];
    postCategory = process.argv[6] ? process.argv[6].toLowerCase() : undefined;
    watchStatus = process.argv[7] ? process.argv[7].toLowerCase() : defaultWatchStatus;
}

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
                watchImageUrl: movieInfo.poster_path
            })
        });
    });
} else if (searchType == "tv") {
    MovieDB.searchTv({ query: searchTitle }, (err, res) => {
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

                    MovieDB.tvEpisodeInfo({ id: showResult.id, season_number: seasonId, episode_number: episodeId }, (err, episodeInfo) => {

                        saveTvTemplate({
                            postCategory: postCategory,
                            watchStatus: watchStatus,
                            watchName: showResult.name,
                            watchSeason: seasonId,
                            watchEpisode: episodeId,
                            imdbId: showIds.imdb_id,
                            watchUrl: showInfo.homepage,
                            watchImageUrl: showInfo.poster_path,
                            watchEpisodeImageUrl: episodeInfo.still_path
                        })
                    });
                });
            });
        }
    });
}


function saveMovieTemplate(info) {
    var template = "---\nlayout: post\ntitle:  ''\ndate:   {{date}}\ntags: [{{category}}]\nstatus: {{status}}\nmovie_name: \"{{name}}\"\nimdb_id: {{imdb_id}}\nmovie_url: {{movie_url}}\nmovie_image: {{movie_image_url}}\npermalink: /watch/:year/:month/:title/\n---";

    var data = { formatted: undefined, filename: "watch/movie/" + (info.watchName.replace(/ /g, "-").replace(/[\'\":]/g, "") + "-" + info.watchStatus + ".md").toLowerCase() };

    data.formatted = template.replace("{{date}}", moment().format("YYYY-MM-DD HH:mm:ss ZZ"))
    .replace("{{category}}", info.postCategory)
    .replace("{{status}}", info.watchStatus)
    .replace("{{name}}", info.watchName)
    .replace("{{imdb_id}}", info.imdbId)
    .replace("{{movie_url}}", info.watchUrl)
    .replace("{{movie_image_url}}", 'https://image.tmdb.org/t/p/w1280' + info.watchImageUrl);

    saveFile(data);

}

function saveTvTemplate(info) {
    var template = "---\nlayout: post\ntitle:  ''\ndate:   {{date}}\ntags: [{{category}}]\nstatus: {{status}}\nshow_name: \"{{name}}\"\nshow_season: {{show_season}}\nshow_episode: {{show_episode}}\nimdb_id: {{imdb_id}}\nshow_url: {{show_url}}\nshow_image: {{show_image_url}}\nepisode_image: {{episode_image_url}}\npermalink: /watch/:year/:month/:title/\n---";

    var data = { formatted: undefined, filename: "watch/tv/" + (info.watchName.replace(/ /g, "-").replace(/[\'\"]/g, "") + "-s" + info.watchSeason + "-e" + info.watchEpisode + "-" + info.watchStatus + ".md").toLowerCase() };

    data.formatted = template.replace("{{date}}", moment().format("YYYY-MM-DD HH:mm:ss ZZ"))
    .replace("{{category}}", info.postCategory)
    .replace("{{status}}", info.watchStatus)
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
    fs.writeFile(__dirname + '/../../eddie-personal/_source/_media/' + data.filename, data.formatted, function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("Finished saving " + data.filename);
    }); 
}
# node-add-media-cli
This is a personal project that might not be of much use to anyone else. It allows me to use a command line to search and add episodes of TV or Movies as watched posts to my Jekyll blog.

In basic terms, in order to get this running you need to:

* Install `npm i`
* Get an API key from [TheMovieDB](http://themoviedb.org), create a file called `config.json` and put the API key in an attribute called `moviedb_key`.
* You'll probably need to edit the `saveFile` function to save the markdown file in a real location on your computer...I should probably make that a config variable...next build.

Now you are ready to use it:

* `npm start -- tv "<Show Name> <Season #> <Episode #> <category> <status>`
Status can be whatever you want, but I use "Interested" or "Finished".

* `npm start -- movie "<Movie Name> <category> <status>`
Movie is very similar as you can see, just no seasons or episodes.

Be careful, I haven't done much error checking yet, that's coming down the road.

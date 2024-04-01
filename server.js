/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    .get(authJwtController.isAuthenticated, (req, res) => {
        /*
        var o = getJSONObjectForMovieRequirement(req);
        o.status = 200;
        o.message = "GET movies";
        res.json(o);
        */
       // finding all movies
        Movie.find({}, (err, movies) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to retrieve movies.', error: err });
            }
            if (!movies || movies.length === 0) {
                return res.status(404).json({ success: false, message: 'No movies found.' });
            }
            // Return the found movies
            return res.status(200).json({ success: true, movies: movies });
        });
    })
    .post(authJwtController.isAuthenticated, async (req, res) => {
        /*
        var o = getJSONObjectForMovieRequirement(req);
        o.status = 200;
        o.message = "movie saved";
        res.json(o);
        */
        try {
            const newMovie = await Movie.create(req.body); // Create a new movie using the request body
            res.status(201).json(newMovie); // Respond with the created movie and status code 201 (Created)
        } catch (error) {
            res.status(400).json({ message: error.message }); // Respond with an error if something goes wrong
        }
    })
    .put(authJwtController.isAuthenticated, (req, res) => {
        // HTTP PUT Method
        // Requires JWT authentication.
        // Returns a JSON object with status, message, headers, query, and env.
        var o = getJSONObjectForMovieRequirement(req);
        o.status = 200;
        o.message = "movie updated";
        res.json(o);
    })
    .delete(authJwtController.isAuthenticated, (req, res) => {
        // HTTP DELETE Method
        // Requires Basic authentication.
        // Returns a JSON object with status, message, headers, query, and env.
        var o = getJSONObjectForMovieRequirement(req);
        o.status = 200;
        o.message = "movie deleted";
        res.json(o);
    })
    .all((req, res) => {
        // Any other HTTP Method
        // Returns a message stating that the HTTP method is unsupported.
        res.status(405).send({ message: 'HTTP method not supported.' });
    });

router.route('/movies/:title')
    // getting a specific movie
    .get(authJwtController.isAuthenticated, (req, res) => {
        // Retrieve the movie based on the title parameter
        Movie.findOne({ title: req.params.title }, (err, movie) => {
            if (err) {
                return res.status(500).send({ message: 'Internal server error' });
            }
            if (!movie) {
                return res.status(404).send({ message: 'Movie not found' });
            }
            // Return the found movie
            res.status(200).send({ movie });
        });
    })
    .post(authJwtController.isAuthenticated, (req, res) => {
        var o = getJSONObjectForMovieRequirement(req);
        o.status = 200;
        o.message = "movie with title posted";
        res.json(o);
    })
    // PUT (Update) a specific movie
    .put(authJwtController.isAuthenticated, (req, res) => {
        // Update the movie based on the title parameter
        Movie.findOneAndUpdate({ title: req.params.title }, req.body, { new: true }, (err, movie) => {
            if (err) {
                return res.status(500).send({ message: 'Internal server error' });
            }
            if (!movie) {
                return res.status(404).send({ message: 'Movie not found' });
            }
            // Return the updated movie
            res.status(200).send({ movie });
        });
    })
    // DELETE a specific movie
    .delete(authJwtController.isAuthenticated, (req, res) => {
        // Delete the movie based on the title parameter
        Movie.findOneAndDelete({ title: req.params.title }, (err, movie) => {
            if (err) {
                return res.status(500).send({ message: 'Internal server error' });
            }
            if (!movie) {
                return res.status(404).send({ message: 'Movie not found' });
            }
            // Return a success message
            res.status(200).send({ message: 'Movie deleted successfully' });
        });
    });

router.route('movies/id/:id')
.get(authJwtController.isAuthenticated, async (req, res) => {
    try {
        const movieId = req.params.id;
        let movieAggregate;

        // Check if the reviews query parameter is set to true
        if (req.query.reviews === 'true') {
            movieAggregate = await Movie.aggregate([
                { 
                    $match: { _id: mongoose.Types.ObjectId(movieId) } 
                },
                {
                    $lookup: {
                        from: "reviews", // Assuming your reviews collection is named 'reviews'
                        localField: "_id",
                        foreignField: "movieId",
                        as: "reviews"
                    }
                }
            ]);
        } else {
            // If reviews query parameter is not true, simply find the movie
            movieAggregate = await Movie.findById(movieId);
        }

        if (!movieAggregate) {
            return res.status(404).json({ success: false, message: 'Movie not found.' });
        }

        return res.status(200).json({ success: true, movie: movieAggregate });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error', error: error });
    }
})

router.route('/reviews')
    .get((req, res) => {
        // Find all reviews
        Review.find({}, (err, reviews) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to retrieve reviews.', error: err });
            }
            if (!reviews || reviews.length === 0) {
                return res.status(404).json({ success: false, message: 'No reviews found.' });
            }
            // Return the found reviews
            return res.status(200).json({ success: true, reviews: reviews });
        });
    })
    // post has authentication
    .post(authJwtController.isAuthenticated, (req, res) => {
        try {
            // Create a new review using the request body
            const newReview = Review.create(req.body);
            res.status(201).json({ message: 'Review created!', review: newReview });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    })

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only



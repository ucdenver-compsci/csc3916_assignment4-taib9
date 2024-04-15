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
var Review = require('./Reviews');
const mongoose = require('mongoose');


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

router.route('/movies/title/:title')
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

router.route('/movies/:_id')
    .get(authJwtController.isAuthenticated, (req, res) => {
        const movieId = req.params._id;
        const includeReviews = req.query.reviews === 'true'; // Check if reviews query parameter is true

        console.log("Req ID:", req.params._id);
        console.log("Movie ID:", mongoose.Types.ObjectId(movieId)); // Log the movieId to the console

        // Define aggregation stages based on whether reviews should be included or not
        const aggregationStages = includeReviews ? [
            {
                $match: { _id: mongoose.Types.ObjectId(movieId) } // Convert movieId to ObjectId
            },
            {
                $lookup: {
                    from: "reviews",
                    localField: "_id",
                    foreignField: "movieId",
                    as: "movieReviews"
                }
            }
        ] : [
            {
                $match: { _id: mongoose.Types.ObjectId(movieId) } // Convert movieId to ObjectId
            }
        ];

        // Perform aggregation
        Movie.aggregate(aggregationStages).exec((err, movies) => {
            if (err) {
                return res.status(500).send({ message: 'Internal server error' });
            }
            if (!movies || movies.length === 0) {
                return res.status(404).send({ message: 'Movie not found' });
            }
            // Return the found movie or movie with reviews
            res.status(200).send({ movie: movies[0] });
        });
    });

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
    .post(authJwtController.isAuthenticated, async (req, res) => {
        try {
            // Check if the movieId provided in the review exists in the database
            const movieExists = await Movie.exists({ _id: req.body.movieId });
            if (!movieExists) {
                return res.status(404).json({ success: false, message: 'Movie not found. Unable to post review.' });
            }

            // Create a new review using the request body
            const newReview = await Review.create(req.body);
            res.status(201).json({ message: 'Review created!', review: newReview });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only



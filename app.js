const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const connectMongo = require('connect-mongo');

const auth = require('./lib/auth');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Set up mongoose connection

const dev_db_url = 'mongodb://localhost:27017/mytravel';
const mongoDBUrl = process.env.MONGODB_URI || dev_db_url;
mongoose.connect(mongoDBUrl);
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Authentication Packages
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user');
const flash = require('express-flash');
const MongoStore = require('connect-mongo')

// Configure the local strategy for use by Passport.
passport.use(
    new LocalStrategy(function(username, password, callback) {
      User.findOne({ username: username }, function(err, user) {
        if (err) {
          return callback(err);
        }
        if (!user) {
          return callback(null, false, { message: 'Incorrect username. ' });
        }
        if (!user.validatePassword(password)) {
          return callback(null, false, { message: 'Incorrect password.' });
        }
        return callback(null, user);
      });
    })
);

// Configure Passport authenticated session persistence.
passport.serializeUser(function(user, callback) {
  callback(null, user._id);
});

passport.deserializeUser(function(id, callback) {
  User.findById(id, function(err, user) {
    if (err) {
      return callback(err);
    }
    callback(null, user);
  });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

// Authentication related middleware.
app.use(flash());
app.use(
    session({
      secret: 'my-travel-secret',
      resave: false,
      saveUninitialized: true,
      store: MongoStore.create({
          mongoUrl: mongoDBUrl,
          ttl: 7 * 24 * 60 * 60 // 7 days. 14 Default.
      })
    })
);

// Initialize Passport and restore authentication state, if any,
// from the session.
app.use(passport.initialize());
app.use(passport.session());

// Pass isAuthenticated and current_user to all views.
app.use(function(req, res, next) {
  res.locals.isAuthenticated = req.isAuthenticated();
  // Delete salt and hash fields from req.user object before passing it.
  const safeUser = req.user;
  if (safeUser) {
    delete safeUser._doc.salt;
    delete safeUser._doc.hash;
  }
  res.locals.current_user = safeUser;
  next();
});

// Use our Authentication and Authorization middleware.
app.use(auth);

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
const port = process.env.PORT || 3000

if(require.main === module) {
    app.listen(port, () => {
        console.log( `Express started on http://localhost:${port}` +
            '; press Ctrl-C to terminate.' )
    })
} else {
    module.exports = app
}



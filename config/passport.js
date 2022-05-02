const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    (email, password, done) => {
      User.findOne({ email }, (err, user) => {
        if (err) {
          return done(err);
        } else {
          if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
          }
          bcrypt.compare(password, user.password, (err, res) => {
            if (err) {
              return done(err);
            }
            if (res) {
              // passwords match! log user in
              return done(null, user);
            } else {
              // passwords do not match!
              return done(null, false, { message: 'Incorrect password' });
            }
          });
        }
      });
    }
  )
);

const passportJWT = require('passport-jwt');
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    (jwtPayload, done) => {
      User.findById(jwtPayload._id, (err, user) => {
        if (err) {
          return done(err, false);
        }
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      });
    }
  )
);

module.exports = passport;

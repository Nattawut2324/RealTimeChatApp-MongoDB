require('dotenv').config();
const favicon = require('serve-favicon');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const sessionMiddleware = require('./middlewares/cookieSessionMiddleware');
const i18n = require('./locale.config');
const { checkLogin } = require('./middlewares/authMiddleware');
const User = require('./Models/User');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const roomRouter = require('./routes/rooms');
const friendRouter = require('./routes/friends');

const app = express();

//Set Mongoose
mongoose.Promise = global.Promise;
mongoose.connect(process.env.mongodb_connectionstring)
.then(() => {
  console.info('mongodb connection successfully');
}).catch(err => {
  console.error('mongodb connection failed');
})
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');



//middleware
'/public/'
app.use(favicon(path.join(__dirname,'public','images','favicon_io','favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(i18n.init);

//Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/rooms',roomRouter);
app.use('/api/friends',friendRouter);
app.get('/:lang', checkLogin,async(req,res,next) => {
  const lang = req.params.lang;
  res.cookie('lang',lang,{maxAge: 1000 * 60 * 24 * 365});
  req.session.lang = lang;
  await User.updateOne({_id: req.session.user_id},{lang:lang});
  return res.redirect('back');
})


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  //log error
  console.log("===============================================================");
  console.log(" ______    _______     _______      _____      _______      _");
  console.log("| _____|  |  ___  |   |  ___  |   /  ___  \\   |  ___  |    | |");
  console.log("| |____   | |___| |   | |___| |   | |   | |   | |___| |    | |");
  console.log("|  ____|  |  ___  /   |  ___  /   | |   | |   |  ___ /     |_|");
  console.log("| |____   | |   \\ \\   | |   \\ \\   | |___| |   | |   \\ \\     _");
  console.log("|______|  |_|    \\_\\  |_|    \\_\\  \\_______/   |_|    \\_\\   |_|");
  console.log();
  console.log("===============================================================");
  // render the error page
  console.error(err.stack);
  res.status(err.status || 500);
  res.render('errors/error');
});

module.exports = app;

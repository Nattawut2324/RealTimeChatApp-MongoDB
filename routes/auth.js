const router = require('express').Router();
const User = require('../Models/User');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const Room = require('../Models/Room');
const {checkLogin} = require('../middlewares/authMiddleware');

async function findUserRoom(user_id){
  const rooms = await Room.find({members: user_id, status: true}).select('_id').lean();
  return rooms.map(e => e._id.toString());
}

const ifLoggedIn = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return res.redirect('/');
  }
  next();
}

//Login
router.get("/login", ifLoggedIn, (req, res) => {
  return res.render("login",{tls: res.tls});
});

router.post("/login", ifLoggedIn, async (req, res, next) => {
  const { username, password } = req.body;
  try{
    User.findOne({ username: username }).then(async (result) => {
      if (result === null) {
        return res.render('login', {
          old_username: username,
          login_Errors: res.tls('login_incorrect_msg')
        })
      }
      const compare_result = await bcrypt.compare(password, result.password);
      if (!compare_result) {
        return res.render('login', {
          old_username: username,
          login_Errors: res.tls('login_incorrect_msg')
        })
      }

      req.session.user_id = result._id;
      req.session.lang = result.lang;
      res.cookie('lang',result.lang,{maxAge: 1000 * 60 * 24 * 365});
      return res.redirect('/auth/initialize');
    })
    
  }catch(err){
    return next(err);
  }
});

router.get("/register", ifLoggedIn, (req, res) => {
  res.render("register");
});

router.post("/register", ifLoggedIn,
  body('name').trim().isLength({min: 3}).withMessage('regis_namemin'),
  body('username').trim().isLength({min: 3}).withMessage('regis_usernamemin').isAlphanumeric().withMessage('regis_usernameNotSpe').custom(async (value) => {
    const user = await User.findOne({ username: value });
    if (user === null) return true;
    else throw new Error("regis_UsernameDup");
  }),
  body('password').trim().isLength({min: 3}).withMessage('regis_passwordmin'),
  async (req, res, next) => {
    const validation_result = validationResult(req);
    const { name, username, password } = req.body;
    console.log(name);
    if (!validation_result.isEmpty()) {
      const errors = new Object();
      validation_result.errors.forEach(e => {
        errors[e.path] = res.tls(e.msg);
      });
      return res.render('register', {
        old_data: req.body,
        register_Error: errors
      })
    }
    let newuser;
    try{
      const hashed_pass = await bcrypt.hash(password, 12);
      newuser = await User.create({ name, username, password: hashed_pass });
      newuser.no =  newuser._id.toString().substring(18,22).toUpperCase();
      newuser.save();
    }catch(err){
      return next(err);
    }
    
    req.session.user_id = newuser._id;
    req.session.lang = newuser.lang;
    res.cookie('lang',newuser.lang,{maxAge: 1000 * 60 * 24 * 365});
    return res.redirect('/auth/initialize');
  })

  router.get('/initialize',(req,res) => {
    req.session.isLoggedIn = true;
    req.session.now = Math.floor(Date.now() / 60e3);
    return res.redirect('/');
  })

  router.get('/logout',checkLogin,(req,res) => {
    req.session = null;
    console.log(req.cookies);
    return res.redirect('/')
  })

module.exports = router;
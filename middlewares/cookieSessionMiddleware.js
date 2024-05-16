const cookieSession = require('cookie-session');
//Set Cookie-Session
let sessionAgeInMinute = 60 * 24 * 365
const sessionMiddleWare = cookieSession({
  name: "session",
  keys: ["key1", "key2"],
  maxAge: 1000 * 60 * sessionAgeInMinute,
  httpOnly: true,
  
})

module.exports = sessionMiddleWare;
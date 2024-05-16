const checkLogin = (req, res, next) => {
    if (!req.session || !req.session.isLoggedIn) {
        console.log('no user session');
        return res.redirect('/auth/login');
    }
    const SessionAgeInMinute = 60 * 24 * 365
    const now = Math.floor(Date.now() / 60e3)
    if(now - req.session.now > SessionAgeInMinute){
        req.session = null;
        res.redirect('/');
    }
    req.session.now = now;
    next();
}

module.exports = {
    checkLogin,
}


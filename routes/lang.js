const router = require('express').Router();
const i18n = require('../locale.config');


router.get('/:lang',(req,res,next) => {
    const lang = req.params.lang;
    if(i18n.getLocales().indexOf(lang) !== -1){
        i18n.setLocale(lang);
    }
    return res.redirect('back');
})
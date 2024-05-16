const {I18n} = require('i18n');
const path = require('path');

const i18n = new I18n({
    locales: ['en-US', 'th-TH'],
    directory: path.join(__dirname, 'locales'),
    defaultLocale: 'th-TH',
    fallbacks:{
        'th': 'th-TH',
        'en': 'en-US'
    },
    api:{
        __: 'tls'
    },
    queryParameter: 'lang',
    retryInDefaultLocale: true,
    cookie: 'lang',
    updateFiles: false
});

module.exports = i18n;
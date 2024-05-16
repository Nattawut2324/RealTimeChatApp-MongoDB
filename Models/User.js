const mongoose = require('mongoose');
const user = mongoose.Schema({
    username: {type: String,unique: true},
    password: String,
    name: String,
    image: { type: String, default: 'user-profile-default.jpg' },
    friends: [{type: mongoose.Types.ObjectId, ref: 'User'}],
    no: { type: String, set: function() {
        return this._id.toString().substring(8,12).toUpperCase();
    }},
    lang: {type: String, default: 'en-US'},
    status: { type: Boolean, default: true }
}, {
    timestamps: true
});
user.index({
    'name': "text",
    'no': "text"
},
{
    "weights": {
        "name": 5,
        "no": 1
    }
})
module.exports = mongoose.model('User',user);
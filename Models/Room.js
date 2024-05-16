const mongoose = require('mongoose');
const User = require('./User');
const room = mongoose.Schema({
    name: String,
    image: {type:String,default: 'room-profile-default.jpg'},
    owner_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    status: { type: Boolean, default: true },
    members: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    isPrivate: {type: Boolean, default: false},
    last_message: {
        sender : {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        text: String,
        createdAt: Date,
        updatedAt: Date
    }
}, {
    timestamps: true
});

room.index({
    'updatedAt': -1,
    'members': 1,
})

module.exports = mongoose.model('Room',room);
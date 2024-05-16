const mongoose = require('mongoose');

const friendInviteSchema = mongoose.Schema({
    inviter: {type: mongoose.Types.ObjectId, ref: 'User'},
    invitee: {type: mongoose.Types.ObjectId, ref: 'User'},
    status: {type: String, default: 'sent'}
},
{
    timestamps: true
})
module.exports = mongoose.model('FriendInvite',friendInviteSchema);
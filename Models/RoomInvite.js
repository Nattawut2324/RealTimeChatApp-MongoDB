const mongoose = require('mongoose');

const roomInviteSchema = mongoose.Schema({
    inviter: {type: mongoose.Types.ObjectId, ref: 'User'},
    invitee: {type: mongoose.Types.ObjectId, ref: 'User'},
    room: {type: mongoose.Types.ObjectId, ref: 'Room'},
    status: {type: String, default: 'sent'}
},
{
    timestamps: true
})
module.exports = mongoose.model('RoomInvite',roomInviteSchema);
const mongoose = require('mongoose');
const Room = require('./Room');
const User = require('./User');
const message = mongoose.Schema({
    sender: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    room: {type: mongoose.Schema.Types.ObjectId, ref: 'Room'},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    text: String,
    status: { type: Boolean, default: true },
}, {
    timestamps: true
});

message.index({"createdAt": -1});

message.post('save',function (doc) {
  Room.findById(doc.room).then(async (e)=>{
    e.last_message = doc;
    e.save();
    //console.log(`save ${doc.text} to room ${e.name}`);
  })
})
module.exports = mongoose.model('Message',message);
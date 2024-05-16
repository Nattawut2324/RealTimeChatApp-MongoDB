const mongoose = require('mongoose');
const messageSystem = mongoose.Schema({
    user: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    room: {type: mongoose.Schema.Types.ObjectId, ref: 'Room'},
    info_type: String,
    status: { type: Boolean, default: true },
}, {
    timestamps: true
});
//const Message = mongoose.model('Message',message);

messageSystem.post('save',function (doc) {
//   Room.findById(doc.room).then((e)=>{
//     e.last_message = doc;
//     e.save();
//     console.log(`save ${doc.text} to room ${e.name}`);
//   })
})
module.exports = mongoose.model('MessageSystem',messageSystem, 'messages');
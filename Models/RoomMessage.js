const mongoose = require('mongoose');
const room_message = mongoose.Schema({
    room_id: mongoose.Schema.Types.ObjectId,
    messages: [
        {
            user_id : mongoose.Types.ObjectId,
            text: String,
            status: {type: Boolean, default: true}
        },{
            timestamps: true
        }
    ],
});

module.exports = mongoose.model('RoomMessage',room_message);
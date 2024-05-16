const mongoose = require('mongoose');
const privateroomSchema = mongoose.Schema({
    members: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    last_message: {
        sender : {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        text: String,
        createdAt: Date,
        updatedAt: Date
    },
    isPrivate: {type: Boolean, default: true},
    status: { type: Boolean, default: true }
}, {
    timestamps: true
});

privateroomSchema.pre('save',function(next){
    if(this.members.length !== 2) throw("private room members should have 2 users");
    next();
})

privateroomSchema.index({'updatedAt': -1})

module.exports = mongoose.model('PrivateRoom',privateroomSchema,'rooms');
const router = require('express').Router();
const querystring = require('querystring');
const PrivateRoom = require('../Models/PrivateRoom');
const FriendInvite = require('../Models/FriendInvite');
const Room = require('../Models/Room');
const User = require('../Models/User');
const mongoose = require('mongoose');
const util = require('../util');
const MessageSystem = require('../Models/MessageSystem');

async function getUserFriendsNotInRoom(user_id,text,skip,room_members){
    try{
        return await User.aggregate([
            { $match: {_id: new mongoose.Types.ObjectId(user_id), status: true}},
            { $lookup: {
                from: 'users',
                localField: 'friends',
                foreignField: '_id',
                as: 'friends',
                pipeline: [
                  { $match: {
                      "status": true,
                      "_id": { $nin: room_members},
                      "$or": [
                        { "name": { $regex: text, $options: 'i'}},
                        { "no": { $regex: text, $options: 'i'}}
                      ]
                    }
                  },
                  { $skip: skip},
                  { $limit: 10}
                ]
            }},
            { $project: {
              'friends._id': 1,
              'friends.name': 1,
              'friends.image': 1,
              'friends.no': 1,
             }},
        ]);
    }catch(err){
        console.log(err);
    }
    
  }

router.get('/getuserfriends', async(req,res) => {
    let uri = req.url.substring(req.url.indexOf('?')+1);
    const query = querystring.decode(decodeURIComponent(uri));
    let text = query.text || "";
    try{
        text = util.regexSanitize(text);
        const skip = query.skip ?? 0;
        const room = await Room.findOne({_id: query.room});
        const userfriends = await getUserFriendsNotInRoom(req.session.user_id,text,skip,room.members);
        return res.json(userfriends[0].friends);
    }catch(err){
        console.log(err);
    }
    
})
router.post('/friendAccept', async(req,res) => {
    try{
        if(!req.body.inviter) throw new Error('inviter id is required');
        const user_id = req.session.user_id;
        const f_id = req.body.inviter;
        let f_req = FriendInvite.updateOne({inviter: f_id, invitee: user_id, status: 'sent'}, {status: 'accepted'});
        let user = User.updateOne({_id: user_id},{ $push: {friends: f_id}});
        let friend = User.updateOne({_id: f_id},{ $push: {friends: user_id}});
        let roomCreate = PrivateRoom.create({members: [user_id,f_id]});
        [f_req,user,friend,roomCreate] = await Promise.all([f_req,user,friend,roomCreate]);
        if(f_req.modifiedCount > 0 && user.modifiedCount > 0 && friend.modifiedCount > 0 && roomCreate){
            console.log('friendAccept success');
            return res.json({rowAffected: 1});
        }else{
            console.error('Some error in friendAccept');
            console.error({FriendRequest: f_req,
                User: user,
                Friend: friend,
                NewRoom: roomCreate
            });
            await FriendInvite.updateOne({inviter: f_id, invitee: user_id, status: 'accepted'},{status: 'sent'});
            await User.updateOne({_id: user_id},{ $pull: {friends: f_id}});
            await User.updateOne({_id: f_id},{ $pull: {friends: user_id}});
            return res.status(400).json({rowAffected: 0});
        }
    }catch(err){
        console.error(err);
    }
})
router.patch('/friendReject', async(req,res) => {
    try{
        if(!req.body.inviter) throw new Error('inviter id is required');
        const user_id = req.session.user_id;
        const f_id = req.body.inviter;
        let f_req = await FriendInvite.updateOne({inviter: f_id, invitee: user_id, status: 'sent'}, {status: 'reject'});
        if(f_req.modifiedCount > 0){
            return res.json({rowAffected: 1});
        }else{
            console.error('Some error in friendReject');
            return res.status(400).json({rowAffected: 0});
        }
    }catch(err){
        console.error(err);
    }
})

router.post('/addFriend/',async(req,res) => {
    try{
        if(!req.body.f_id) throw new Error('friend id is required');
        const friend = await FriendInvite.create({inviter: req.session.user_id,invitee: req.body.f_id});
        
        return res.json({rowAffected: 1})
    }catch(err){
        console.error(err);
        return res.status(400).json({rowAffected: 0})
    }
})

router.delete('/cancelAddFriend/',async(req,res) => {
    try{
        if(!req.body.f_id) throw new Error('friend id is required');
        const friend = await FriendInvite.deleteOne({inviter: req.session.user_id,invitee: req.body.f_id});
        if(friend.deletedCount === 0) throw new Error('no friend deleted');
        return res.json({rowAffected: 1})
    }catch(err){
        console.error(err);
        return res.status(400).json({rowAffected: 0})
    }
})




module.exports = router;
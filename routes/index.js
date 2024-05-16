const router = require('express').Router();
const {checkLogin} = require('../middlewares/authMiddleware');
const mongoose = require('mongoose');
const User = require('../Models/User');
const Room = require('../Models/Room');
const Message = require('../Models/Message');
const util = require('../util');
const PrivateRoom = require('../Models/PrivateRoom');
const i18n = require('../locale.config');
const FriendInvite = require('../Models/FriendInvite');



/* GET home page. */
router.get('/',checkLogin ,async (req, res, next) => {
  const user_id = req.session.user_id;
  let user, room, rooms, privRooms, userFriends, friendRequest, friendRequestCount;
  user = User.findOne({_id: user_id}).select('name image no friends').lean().exec();
  room = util.loadInitRoom(req.query.room,user_id);
  rooms = Room.aggregate([
    { $match: {
      members: new mongoose.Types.ObjectId(user_id),
      status: true,
    }},
    { $sort: {updatedAt: -1}},
    { $skip: 0},
    { $limit: 10},
    { $lookup: {
      from: 'users',
      localField: 'last_message.sender',
      foreignField: '_id',
      as: 'last_message.sender'
    }},
    { $lookup: {
      from: 'users',
      localField: 'members',
      foreignField: '_id',
      as: 'members'
    }},
    { $project: {
      name: 1,
      image: 1,
      owner_id: 1,
      updatedAt: 1,
      isPrivate: 1,
      'members._id': 1,
      'members.name': 1,
      'members.image': 1,
      'last_message.sender_id': {$first: "$last_message.sender._id"},
      'last_message.sender_name': {$first: "$last_message.sender.name"},
      'last_message.text': 1,
      'last_message.createdAt': 1
    }}
  ]).exec();
  userFriends = User.find({status: true, friends: user_id}).limit(20).select('name image no').lean().exec();
  friendRequest = FriendInvite.find({status: 'sent',invitee: user_id}).sort('-createdAt').populate('inviter','name image no').lean().exec();
  friendRequestCount = FriendInvite.countDocuments({status: 'sent',invitee: user_id}).exec();
  invitedFriend = FriendInvite.find({status: 'sent',inviter: user_id}).exec();
  //console.log(user instanceof Promise);
  [
    user,
    room,
    rooms,
    privRooms,
    userFriends,
    friendRequest,
    friendRequestCount,
  ] = await Promise.all([
    user,
    room,
    rooms,
    privRooms,
    userFriends,
    friendRequest,
    friendRequestCount,
  ]);
  //console.log('noF:', noFriendUsers);
  if(!user){
    req.session = null;
    console.error('Can\'t find user');
    return res.redirect('/auth/login');
  } 
 
  const userFriendCount = user.friends.length;
  if(room && room.isPrivate){
    const friend = room.members[0]._id.toString() === user_id.toString() ? room.members[1] : room.members[0];
    room.name = friend.name;
    room.image = friend.image;
  }

  rooms = rooms.map(e=>{
    e.date_str = util.formatDate(e.updatedAt);
    if(e.isPrivate){
      let friend = (e.members[0]._id.toString() === user_id.toString()) ? e.members[1] : e.members[0];
      e.image = friend.image;
      e.name = friend.name
      if(Object.entries(e.last_message).length > 0 && e.last_message.sender_id.toString() === user_id.toString()){
        e.last_message.sender_name = i18n.__('you');
      }
    }
    return e;
  })
  
  let friendsRoom, noFriendUsers, noFriendUserCount, invitedUser;
  const friendsRequest_id = friendRequest.map(e => e.inviter._id);
  const noFriendUsersQuery = {
    status: true,
    $and: [
      {_id: {$ne: new mongoose.Types.ObjectId(user_id)}},
      {_id: {$nin: friendsRequest_id}}
    ],
    friends: {$ne: user_id}
  };
  noFriendUsers = User.find(noFriendUsersQuery).select('name image no').limit(20).lean().exec();

  noFriendUserCount = User.countDocuments(noFriendUsersQuery).exec();

  invitedUser = FriendInvite.find({inviter: user_id,status: 'sent'}).select('invitee').lean().exec();
  
  let friend_ids = userFriends.map(e => e._id);
  friendsRoom = PrivateRoom.find({
    isPrivate: true,
    $and: [{members: user_id},{members: { $in: friend_ids}}]
  }).select('_id members');

  [friendsRoom,noFriendUsers,noFriendUserCount,invitedUser] = await Promise.all([friendsRoom,noFriendUsers,noFriendUserCount,invitedUser])

  userFriends = userFriends.map(e => {
    const match_room = friendsRoom.find(r => r.members.includes(e._id));
    if(match_room){
      e.room = match_room._id;
    }
    return e;
  })

  friendRequest = friendRequest.map(e => {
      e.date_str = util.formatFriendRequestDate(e.createdAt);
      return e;
  })     
  invitedUser = invitedUser.map(e=> e.invitee.toString());
  console.log(invitedUser);
  noFriendUsers = noFriendUsers.map(e => {
    if(invitedUser.includes(e._id.toString())){
      e.isInvited = true;
    }else{
      e.isInvited = false;
    }
    return e;
  })
  console.log(noFriendUsers);
  let msgs = [];
  if(room){
    msgs = await Message.aggregate([
      { $match: {room: room._id, status: true}},
      { $sort: {createdAt: -1}},
      { $limit: 20},
      { $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender'
      }},
      { $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }},
      { $project: {
        "text": 1,
        "createdAt": 1,
        "sender._id": 1,
        "sender.name": 1,
        "sender.image": 1,
        "info_type": 1,
        "user._id": 1,
        "user.name": 1,
        "user.image": 1
      }}
    ]);
    msgs = msgs.map(e=> {
      e.date_str = util.formatDateTime(e.createdAt);
      return e;
    })
  }
  //return res.json(msgs)
  return res.render('index',{
    user,
    room,
    rooms,
    userFriends,
    userFriendCount,
    friendRequest: friendRequest.slice(0,10),
    friendRequestCount,
    noFriendUsers,
    noFriendUserCount,
    msgs,
    title: 'Home',
    tls: res.tls,
    lang: req.cookies.lang
  });
});
module.exports = router;

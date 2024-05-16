const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../Models/User');
const {body,validationResult} = require('express-validator');
const {checkLogin} = require('../middlewares/authMiddleware');
const i18n = require('../locale.config');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const Room = require('../Models/Room');
const FriendInvite = require('../Models/FriendInvite');
const PrivateRoom = require('../Models/PrivateRoom');
const util = require('../util');

const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null,'public/images');
    },
    filename: (req,file,cb) => {
        var filename = file.fieldname + '-' + Date.now() + req.session.user_id + path.extname(file.originalname);
        cb(null,filename);
    }
})
const memoryStorage = multer.memoryStorage();

/* GET users listing. */
router.get('/my-account',checkLogin, async (req, res, next) => {
    const user_id = req.session.user_id;
    let user, rooms, privRooms, userFriends, friendRequest, friendRequestCount;
    user = User.findOne({_id: user_id}).select('username name image no friends').lean().exec();
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
      rooms,
      privRooms,
      userFriends,
      friendRequest,
      friendRequestCount,
    ] = await Promise.all([
      user,
      rooms,
      privRooms,
      userFriends,
      friendRequest,
      friendRequestCount,
    ]);
    //console.log('noF:', noFriendUsers);
    let userFriendCount = 0;
    if(!user){
      req.session = null;
      console.error('Can\'t find user');
      return res.redirect('/auth/login');
    } 
   
    userFriendCount = user.friends.length;
  
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
    
    let friendsRoom, noFriendUsers;
    const friendsRequest_id = friendRequest.map(e => e.inviter._id);
    noFriendUsers = User.find({
      status: true,
      $and: [
        {_id: {$ne: new mongoose.Types.ObjectId(user_id)}},
        {_id: {$nin: friendsRequest_id}}
      ],
      friends: {$ne: user_id}
    }).limit(20).select('name image no').lean().exec();
    
    let friend_ids = userFriends.map(e => e._id);
    friendsRoom = PrivateRoom.find({
      isPrivate: true,
      $and: [{members: user_id},{members: { $in: friend_ids}}]
    }).select('_id members');
  
    [friendsRoom,noFriendUsers] = await Promise.all([friendsRoom,noFriendUsers])
  
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
   
    //return res.json(msgs)
    return res.render('userAccount',{
      user,
      rooms,
      userFriends,
      userFriendCount,
      friendRequest,
      friendRequestCount,
      noFriendUsers,
      title: 'My Account',
      tls: res.tls,
      lang: req.cookies.lang
    });
  });

router.post('/edit',checkLogin,
body('name').trim().isLength({min: 3}).withMessage(i18n.__('regis_namemin')).isAlphanumeric().withMessage(i18n.__('regis_nameNotSpe')),
body('username').trim().isLength({min: 3}).withMessage(i18n.__('regis_usernamemin')).isAlphanumeric().withMessage(i18n.__('regis_usernameNotSpe')).custom(async (value) => {
    const user = await User.findOne({ username: value });
    if (user === null) return true;
    else throw new Error(i18n.__("regis_UsernameDup"));
  }),
async (req,res)=>{
  const {name,username,old_image} = req.body;
  const validation_result = validationResult(req)
  if(!validation_result.isEmpty()){
    return res.render('userAccount',{
      username,
      user: {
        _id: req.session.user_id,
        username,
        name,
        image: old_image
      },
      title: "My Account",
      errors: validation_result.errors
    });
  }
  try{
    const edited = await User.updateOne({_id: req.session.user_id},{username, name});
    if(edited.modifiedCount === 0) throw new Error('user edited unsuccessful');
    return res.redirect('/users/my-account')
  }catch(err){
    console.log(err);
    return res.redirect('/users/my-account')
  }
})
const upload = multer({storage: memoryStorage});
router.post('/editimage',checkLogin,upload.single('image'), async(req,res)=>{
  if(!req.file) return;
  const filename = req.file.fieldname + '-' + Date.now() + req.session.user_id + '.webp';
  await util.resizeImageToWebp(req.file.buffer,480,480,filename);
  const user = await User.findOneAndUpdate({_id: req.session.user_id},{image: filename});
  if(user.image != 'user-profile-default.jpg'){
      fs.unlink('public/images/'+user.image).catch((err)=>{
          console.log(err);
      })
  }
  return res.redirect('/my-account');
})
module.exports = router;

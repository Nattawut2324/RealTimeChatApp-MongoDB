const mongoose = require('mongoose');
const Message = require('../Models/Message');
const Room = require('../Models/Room');
const User = require('../Models/User');

const router = require('express').Router();
const util = require('../util');
const fs = require('fs/promises');
const internal = require('stream');
const MessageSystem = require('../Models/MessageSystem');

router.get('/', async(req, res, next) => {
    const messages = await Message.find().lean();
    return res.json(messages);
  });
  
  router.get('/withPopulate', async(req, res, next) => {
    const messages = await Message.find().populate('sender').lean();
    return res.json(messages);
  });
  router.get('/withPopulateSelect', async(req, res, next) => {
    const messages = await Message.find().populate('sender','name image').lean();
    return res.json(messages);
  });
  
  router.get('/withPopulateAndUnwind', async(req, res, next) => {
    const messages = await Message.find().populate('sender').lean();
    return res.json(messages);
  });
  
  router.get('/complexAggregate', async(req, res, next) => {
    const messages = await Room.findOne();
    return res.json(messages);
  });
  
  router.get('/findOne', async(req, res, next) => {
    const msg = await Message.findOne({_id: '662bce2fd09138ade1e4f237'}).lean();
    return res.json(msg);
  });
  router.get('/findById', async(req, res, next) => {
    const msg = await Message.findById('662bce2fd09138ade1e4f237').lean();
    return res.json(msg);
  });
  
  router.get('/findFirstFromFirst', async(req, res, next) => {
    const msg = await Message.findOne({text: 'Hello There?'}).lean();
    return res.json(msg);
  });
  
  router.get('/findLastFromFirst', async(req, res, next) => {
    const msg = await Message.findOne({text: 'Nattawut'}).lean();
    return res.json(msg);
  });
  
  router.get('/aggregate', async(req, res, next) => {
    const msg = await Message.aggregate([
      { $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender'
      }
    },
    { $match: {text: 'Nattawut'}},
    ])
    return res.json(msg);
  });
  
  router.get('/findAndPopulate', async(req, res, next) => {
    const msg = await Message.findOne().populate('sender','name image').lean();
    return res.json(msg);
  });
  
  router.get('/doubleFind', async(req, res, next) => {
    const msg = await Message.findOne().lean();
    const user = await User.findOne({_id: msg.sender}).select('name image').lean();
    msg.sender = user;
    return res.json(msg);
  });
  
  router.get('/test1', async(req, res, next) => {
    const user_id = '66293e186ff905376d019cc5';
    const room_id = '662bbb9eca027f7e69a49026';
    try{
      const user = await User.findById(user_id).select('name image').lean();
      if(!user) throw Error('Can\'t find user');
      let room;
      if(req.query.room){
        room = await Room.findById(room_id).select('name image').lean();
      }else{
        room = await Room.findOne({members: user_id}).sort('-updatedAt').select('name image').lean();
      }
      let rooms = await Room.find({members: user_id, status: true}).sort('-updatedAt').populate('last_message.sender','name').limit(10).lean();
      rooms = rooms.map(e=>{
        e.date_str = util.formatDate(e.updatedAt);
        return e;
      })
  
      let msgs = [];
      if(room){
        msgs = await Message.find({room: room._id}).sort('-createdAt').limit(20).populate([{path: 'sender', select: 'name image'},{path: 'user', select: 'name'}]).lean();
        msgs = msgs.map(e=> {
          e.date_str = util.formatDateTime(e.createdAt);
          return e;
        })
      }
      return res.json({
          user,
          room,
          msgs,
          rooms,
      });
    }catch(err){
      console.log(err);
    }
  });
  
  function loadInitRoom(room_id,user_id){
    return new Promise(async (resolve,reject) => {
      let room;
      if(room_id){
        room = await Room.findOne({_id: room_id, status: true}).select('name image').lean();
      }else{
        room = await Room.aggregate([
          { $match: {members: user_id, status: true}},
          { $sort: {updatedAt: -1}},
          { $limit: 1},
          { $project: 'name image' }
        ]);
      }
      resolve(room);
    })
  }
  
  router.get('/test2', async(req, res, next) => {

    const user_id = '66293e186ff905376d019cc5';
    const room_id = '662bbb9eca027f7e69a49026';
    let user, room, rooms;
    user = User.findOne({_id: user_id}).select('name image').lean().exec();
    room = loadInitRoom(room_id,user_id);
    // rooms = Room.find({members: user_id, status: true}).sort('-updatedAt').limit(10).populate('last_message.sender','name').lean();
    rooms = Room.aggregate([
      { $match: {members: new mongoose.Types.ObjectId(user_id), status: true}},
      { $sort: {updatedAt: -1}},
      { $limit: 10},
      { $lookup: {
        from: 'users',
        localField: 'last_message.sender',
        foreignField: '_id',
        as: 'last_message.sender'
      }},
      { $unwind: '$last_message.sender'},
      { $project: {
        name: 1,
        image: 1,
        owner_id: 1,
        members: 1,
        updatedAt: 1,
        'last_message.sender.name': 1,
        'last_message.text': 1,
        'last_message.createdAt': 1
      }}
    ]).exec();
    [user,room,rooms] = await Promise.all([user,room,rooms]);
    if(!user) throw Error('Can\'t find user');
    rooms = rooms.map(e=>{
      e.date_str = util.formatDate(e.updatedAt);
      return e;
    })
    let msgs = [];
    if(room){
      //msgs = await Message.find({room: room._id}).limit(20).sort('-createdAt').populate([{path: 'sender', select: 'name image'},{path: 'user', select: 'name'}]).lean();
      msgs = await Message.aggregate([
        { $match: {room: room._id, status: true}},
        { $sort: {createdAt: -1}},
        { $limit: 10},
        { $lookup: {
          from: 'users',
          localField: 'sender',
          foreignField: '_id',
          as: 'sender'
        }},
        { $project: {
          "text": 1,
          "createdAt": 1,
          "sender._id": 1,
          "sender.name": 1,
          "sender.image": 1
        }}
      ]);
      msgs = msgs.map(e=> {
        e.date_str = util.formatDateTime(e.createdAt);
        return e;
      })
    }
    return res.json({
      user,
      room,
      rooms,
      msgs
    });
  });
  
  router.get('/test', async(req, res, next) => {
    let s1 = new Promise((resolve,reject) => {
      setTimeout(() => {
        resolve('S1')
      }, 1000);
    })
    const s2 = Promise.resolve('123')
    s1.then((e) => console.log(e));
    s2.then((e) => console.log(e));
    [s1r] = await Promise.all([s1])
    console.log(s1r);
    return res.json(s1)
  });

  router.get('/populate/:date',async(req,res) => {
    const beforedate = new Date(req.params.date);
    console.time('count');
    const count = await Message.countDocuments({createdAt: {$gte: beforedate}}).exec();
    console.timeEnd('count');
    console.time('populate');
    const a = await Message.find({createdAt:{$gte: beforedate}}).limit(10).sort('-createdAt').populate([{path: 'sender', select: 'name image'},{path: 'user', select: 'name image'}]).lean().exec();
    console.timeEnd('populate');
    return res.json({count,a});
  })
  router.get('/lookup/:date',async(req,res) => {
    const beforedate = new Date(req.params.date);
    console.time('count');
    const count = await Message.countDocuments().exec();
    console.timeEnd('count');
    console.time('lookup');
    const a = await Message.aggregate([
      //{$match: {createdAt:{$gte: beforedate}}},
      //{$sort: {createdAt: 1}},
      {$limit: 10},
      {$lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender'
      }},
      {$lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }},
      { $project:{
        'sender._id': 1,
        'sender.name': 1,
        'sender.image': 1,
        'user._id': 1,
        'user.name': 1,
        'user.image': 1,
        'text': 1,
        'createdAt': 1,
      }}
    ]);
  });
  router.get('/populateOne',async(req,res) => {
    const beforedate = new Date(req.params.date);
    console.time('count');
    const count = await Message.countDocuments({createdAt: {$gte: beforedate}}).exec();
    console.timeEnd('count');
    console.time('populate');
    const a = await Message.findOne({createdAt:{$gte: beforedate}}).sort('')
    console.timeEnd('populate');
    return res.json({count,a});
  })
  router.get('/lookupOne',async(req,res) => {
    const users = await User.find();
    users.forEach((e) => {
      e.no = e._id.toString().substring(8,12).toUpperCase();
      e.save();
    })
    const beforedate = new Date(req.params.date);
    console.time('count');
    const count = await Message.countDocuments().exec();
    console.timeEnd('count');
    console.time('lookup');
    const a = await Message.aggregate([
      {$match: {createdAt:{$gte: beforedate}}},
      {$sort: {createdAt: -1}},
      {$limit: 1},
      {$lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender'
      }},
      {$lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }},
      { $project:{
        'sender._id': 1,
        'sender.name': 1,
        'sender.image': 1,
        'user._id': 1,
        'user.name': 1,
        'user.image': 1,
        'text': 1,
        'createdAt': 1,
      }}
    ]);
    console.timeEnd('lookup');
    return res.json({count,a});
  })
  router.post('/addMessage', async(req, res, next) => {
    const messages = await Message.create({
      sender: '66293e186ff905376d019cc5',
      room: '662bbb9eca027f7e69a49026',
      text: 'AAAASASASASASASASASASASAS'
      
    });
    return res.send(messages);
  });

  function GetByte(data){
    if(data < 1){
      return `${Math.round(data * 1000,2)} B`;
    }
    else if(data < 1000){
      return `${Math.round(data,2)} KB`;
    }
    else{
      return `${Math.round(data / 1000,2)} MB`
    }
  }

  router.get('/multi-insert/:q', async(req,res,next) => {
    let arr = [];
    for (let i = 1; i <= parseInt(req.params.q); i++) {
      const e = {
        sender: '66293e186ff905376d019cc5',
        room: '662bbb9eca027f7e69a49026',
        text: 't-'+i
      }
      arr.push(e);
      console.log(e);
    }
    const inserted = await Message.insertMany(arr);
    res.json(inserted);
  });

  router.get('/monitor', async(req,res,next) => {
    fs.readFile("./ztest-api/api_test_result.json").then((e) => {
        let data = JSON.parse(e)
        for(const [key1,value1] of Object.entries(data)){
          data[key1].KB_per_sec.average = GetByte(value1.KB_per_sec.average);
          data[key1].totalKB = GetByte(value1.totalKB);
          data[key1].KB_per_req = GetByte(value1.KB_per_req);
        }
        return res.render('test-api-monitor',{data});
    }).catch((err) => {
      return next(err);
    })
  });

  router.get('/test3', async(req,res) => {
    const a = await Message.deleteMany({info_type:{$ne: null}});
    console.log(a);
    return res.json(a);
  }) 
  
  async function getUserFriendsNotInRoom(user_id,text,skip,room_members){
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
  }

  const querystring = require('querystring');
const PrivateRoom = require('../Models/PrivateRoom');
const FriendInvite = require('../Models/FriendInvite');
  router.get('/getuserfriends', async(req,res) => {
    let uri = req.url.substring(req.url.indexOf('?')+1);
    const query = querystring.decode(decodeURIComponent(uri));
    let text = query.text || "";
    text = util.regexSanitize(text);
    const skip = query.skip ?? 0;
    const room = await Room.findOne({_id: query.room});
    const userfriends = await getUserFriendsNotInRoom(req.session.user_id,text,skip,room.members);
    return res.json(userfriends[0].friends);
  })

  router.get('/getuserfriends1', async(req,res) => {
    let text = req.query.text || "";
    text = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let userfriends;
    console.log(text);
    const user = await User.findOne({_id: req.session.user_id, status: true}).select('friends');
    userfriends = await User.find({"$text": { "$search": text}}).select({"score": {"$meta": "textScore"}})
    return res.json(userfriends);
  })

  router.get('/addinfo',async(req,res) => {
    const room_id = '66361098d3fb1ebdfb6a7c43';
    const user_1 = '66293e186ff905376d019cc5';
    const user_2 = '662bb64947c5dacdda06a8ba';
    const msg = await MessageSystem.create({room: room_id,user: [user_2],info_type: 'join'});
    return res.json(msg);
  })
  router.get('/addproom',async(req,res) => {
    const user_1 = '66293e186ff905376d019cc5';
    const user_2 = '662bb64947c5dacdda06a8ba';
    const room = await PrivateRoom.create({members: [user_1,user_2],isPrivate: true});
    return res.json(room);
  })
  router.get('/addfinvite/:id',async(req,res) => {
    const user_1 = '6640ddb421be0040bbc688a6';
    const user_2 = '66293e186ff905376d019cc5';
    const friend = await FriendInvite.create({inviter: req.params.id,invitee: user_2});
    return res.json(friend);
  })
  router.get('/removeAllFriends',async(req,res) => {
    const freinds = await User.updateMany({},{$pull: {friends: {$ne: null}}}).exec();
    const friendInvite = await FriendInvite.deleteMany({}).exec();
    const room = await PrivateRoom.deleteMany({isPrivate: true}).exec();

    return res.json({freinds,friendInvite,room})
  })

  const multer = require('multer');
  const sharp = require('sharp');
const path = require('path');

  const storage = multer.memoryStorage()
  const multerFiler = (req,file,cb) =>{
    if(file.mimetype.startsWith("image")){
      cb(null,true);
    }else{
      cb("Please upload only images.",false);
    }
  }
  const upload = multer({storage,fileFilter: multerFiler});

  const resizeImage = async (req,res,next) => {
    if(!req.file) return next();
    console.log(req.file);
    const extname = path.extname(req.file.originalname);
    await sharp(req.file.buffer).resize(480,480).toFormat('webp').toFile('/images/resized-'+ req.file.fieldname + '-' + Date.now() + req.session.user_id + extname);
    next();
  }

  router.post('/resizeImg',upload.single('image'),async(req,res) => {
    if(!req.file) return next();
    console.log(req.file);
    const extname = path.extname(req.file.originalname);
    const a = await sharp(req.file.buffer).resize(480,480).toFormat('webp').webp().toFile(path.join(__dirname,req.file.fieldname+ '.webp'));
    return res.json(a);
    await sharp(req.file.buffer).resize(480,480).toFormat('webp').toFile('/images/resized-'+ req.file.fieldname + '-' + Date.now() + req.session.user_id + extname);
  })

module.exports = router;
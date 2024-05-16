const Message = require('../Models/Message');
const Room = require('../Models/Room');
const moment = require('moment');
const User = require('../Models/User');
const router = require('express').Router();
const {checkLogin} = require('../middlewares/authMiddleware')
const util = require('../util')

router.get('/', async (req,res,next)=>{
    const a = await Room.findOne({members: req.session.user_id, name: 'Moon chase'});
    const b = await Message.create({
        user_id: req.session.user_id,
        room_id: a._id,
        text : 'Hello There?',
    })
    return res.json(b);

     
})

router.get('/chat',checkLogin, async (req,res,next) => {
    
    try{
        const room = await Room.findById(req.query.room);
        if(room === null) throw Error('Can\'t find room');
        const user = await User.findById(req.session.user_id).select('_id name image');
        if(user === null) throw Error('Can\'t find user');
        let rooms = await Room.find({members: user._id, status: true}).populate('last_message.sender','name').lean();
        rooms = rooms.map(e=>{
            if(e.last_message){
                if(e.createdAt > e.last_message.createdAt){
                    e.last_update = e.createdAt;
                    e.last_update_str = util.formatDate(e.createdAt);
                }else{
                    e.last_update = e.last_message.createdAt;
                    e.last_update_str = util.formatDate(e.last_message.createdAt);
                }
            }else{
                e.last_update = e.createdAt;
                e.last_update_str = util.formatDate(e.createdAt);
            }
            return e;
        }).sort((a,b) => b.last_update - a.last_update);
        
        let msgs = await Message.find({room: room._id}).sort('-createdAt').limit(20).populate('sender','name image').lean();
        msgs = msgs.map(e=> {
        e.date = moment(e.createdAt).format('DD/MM/YYYY เวลา HH:mm');
            return e;
        })
        return res.render('chat',{
            user,
            room,
            msgs,
            rooms,
        });
    }catch(err){
        return next(err);
    }
    
    
})

router.post('/newmsg',checkLogin,async (req,res) => {
    const {room,text} = req.body;
    Message.create({sender: req.session.user_id, room, text}).then(async(e) => {
        console.log(e);
        const ins_room = await Room.findById(room);
        ins_room.last_message = e;
        ins_room.save();
        return res.redirect('/test/chat?room='+ room)
    });
})


module.exports = router;
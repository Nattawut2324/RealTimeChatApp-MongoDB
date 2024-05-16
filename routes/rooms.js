const router = require('express').Router();
const Room = require('../Models/Room');
const mongoose = require('mongoose');
const {checkLogin} = require('../middlewares/authMiddleware');
const MessageSystem = require('../Models/MessageSystem');
const util = require('../util');
const User = require('../Models/User');


router.get('/new',checkLogin, async (req,res) => {
    let user,rooms;
    user = User.findOne({_id: req.session.user_id}).select('name image').lean();
    rooms = util.getUserRoomList(req.session.user_id);
    [user,rooms] = await Promise.all([user,rooms]);
    return res.render('newRoom',{
        user,
        rooms
    });
})
router.post('/new', checkLogin, async (req,res,next) => {
    try{
        const room = await Room.create({
            name: req.body.room_name,
            owner_id: req.session.user_id,
            members: [req.session.user_id]
        })
        const joinmsg = await MessageSystem.create({room: room._id, user: [req.session.user_id], info_type: 'join'})
        return res.redirect('/');
        
    }catch(err){
        return next(err);
    }
})

router.get('/join', checkLogin, async (req,res,next) => {
    try{
        const room = await Room.findOne({_id: req.query.room});
        if(room === null) throw new Error('No room found.');
        room.members.push(req.session.user_id);
        room.save({timestamps: false});
        
        const joinmsg = await MessageSystem.create({room: room._id, user: [req.session.user_id], info_type: 'join'})
        return res.redirect('/');
    }catch(err){
        return next(err);
    }
})

router.post('/join', checkLogin, async (req,res) => {
    return res.redirect('/rooms/join?room=' + req.body.join_url);
})

module.exports = router;
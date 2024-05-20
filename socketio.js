const socketio = require('socket.io');
const sessionMiddleware = require('./middlewares/cookieSessionMiddleware');
const User = require('./Models/User');
const Message = require('./Models/Message');
const util = require('./util');
const moment = require('moment');
const Room = require('./Models/Room');
const { default: mongoose } = require('mongoose');
const i18n = require('./locale.config');
const MessageSystem = require('./Models/MessageSystem');
const RoomInvite = require('./Models/RoomInvite');
const PrivateRoom = require('./Models/PrivateRoom');
const FriendInvite = require('./Models/FriendInvite');

const MESSAGE_DATE_FORMAT = "DD/MM/YYYY เวลา HH:mm";

module.exports = function(server){
    //Initialize socket for the server
    const io = socketio(server);

    io.engine.use(sessionMiddleware);

    io.on("connection", async (socket) => {
        const session = socket.request.session;
        socket.on('disconnect',() => {
            console.log('user disconnected');
        })
        let userRooms = await Room.find({members: new mongoose.Types.ObjectId(session.user_id)}).select('_id isPrivate').lean();
        userRooms = userRooms.map(e => e._id.toString());
        socket.join(userRooms);
        socket.join(session.user_id);
        i18n.setLocale(session.lang);
        

        if(!session.user_id){
            socket.emit('session_expired')
            console.log("session expired")
            return;
        }
        console.log("New user connected");
        console.log(io.engine.clientsCount);
        console.log('===================================');
        socket.on("init", async()=>{
            socket.emit("init");
        });
        socket.on("new_message", async (data) => {
            try{
                data.message = data.message.replace('<',';');
                data.message = data.message.replace('>',';');
                console.time('newMessage-create');
                let newmsg,sender;
                newmsg = Message.create({sender: data.user_id, room: data.room_id, text: data.message});
                sender = User.findOne({_id: data.user_id}).select('name image').lean();

                [newmsg,sender] = await Promise.all([newmsg,sender]);
                console.timeEnd('newMessage-create');
                const date_str = util.formatDateTime(newmsg.createdAt);
                
                io.to(data.room_id).emit("receive_message", {
                    user: sender,
                    date_str,
                    message: newmsg,
                    you_text: i18n.__('you')
                });
        
                io.to(data.room_id).emit('room_update',{
                    room_id: data.room_id,
                    user_name: sender.name,
                    message: data.message,
                    room_update_date: moment(newmsg.createdAt).format('HH:mm')
                })
            }
            catch(err){
                console.log(err);
                socket.emit('send_message_fail')
            }
        
        });

        socket.on("typing", (data) => {
            socket.to(data.room_id).emit("typing", {
                writer: data.writer,
                text: i18n.__('msg_info_type',data.writer),
                user_id: data.user_id,
                room_id: data.room_id 
            });
        });
        socket.on("no-typing",(data) => {
            socket.to(data.room_id).emit("no-typing", {
                writer: data.writer,
                user_id: data.user_id,
                room_id: data.room_id
            });
        })
        socket.on("load_more_message",async (data)=>{
            try{
                console.time('load_more-message');
                let messages = await Message.aggregate([
                    { $match: {room: new mongoose.Types.ObjectId(data.room_id), status: true}},
                    { $sort: {createdAt: -1}},
                    { $skip: data.messageCount},
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
                        'sender._id': 1,
                        'sender.name': 1,
                        'sender.image': 1,
                        'user._id': 1,
                        'user.name': 1,
                        'user.image': 1,
                        'text': 1,
                        'info_type':1,
                        'room': 1,
                        'createdAt': 1,
                        'updatedAt': 1
                    }}
                ])
                messages = messages.map(e => {
                    e.date_str = util.formatDateTime(e.createdAt);
                    if(e.info_type){
                        if(e.info_type === 'join') e.info_text = i18n.__('msg_info_join',e.user[0].name);
                        else if(e.info_type === 'invite') e.info_text = i18n.__('msg_info_invite',e.user[0].name,e.user[1].name);
                        else if(e.info_type === 'leave') e.info_text = i18n.__('msg_info_invite',e.user[0].name);
                    }
                    return e;
                })
                console.timeEnd('load_more-message');
                socket.emit("add_more_messages",{
                    messages,
                    you_text: i18n.__('msg_box_you'),
                    no_msg_text: i18n.__('msg_box_no_message')
                });
            }catch(err){
                console.log(err);
                return socket.emit("load_failed");
            }
        })

        socket.on('open_friend_invite',async (data) => {
            let userfriends;
            userfriends = await User.aggregate([
                { $match: {_id: new mongoose.Types.ObjectId(session.user_id), status: true}},
                { $sort: {name: 1} },
                { $lookup: {
                    from: 'users',
                    localField: 'friends',
                    foreignField: '_id',
                    as: 'friends',
                    pipeline: [
                        { $match: {
                            "name": { $regex: data.text, $options: 'i'}
                        }},
                        { $limit: 3}
                    ]
                }},
            ]);
            socket.emit('load_friend_list',{userfriends: userfriends[0].friends});
        })

        socket.on('invite_to_room', async (data) => {
            const newMembers = data.selectedFriends.map(f => {
                return {
                    room: data.room_id,
                    user: [session.user_id,f],
                    info_type: 'invite'
                }
            })
            const invites = data.selectedFriends.map(f => {
                return {
                    inviter: session.user_id,
                    invitee: f,
                    room: data.room_id
                }
            })
            let users,invitemsg,invitedata;
            users = User.find({_id: { $in: data.selectedFriends.map(e => new mongoose.Types.ObjectId(e))}}).select('name');
            invitemsg = MessageSystem.create(newMembers);
            invitedata = RoomInvite.create(invites);
            [users,invitemsg,invitedata] = await Promise.all([users,invitemsg,invitedata]);
            // let room = Room.findOneAndUpdate(
            //     { _id: data.room_id},
            //     { $push: {members: data.selectedFriends}}
            // ).populate('members').exec();
            const send_msg = users.map((e) => {
                return {
                    invite_text: i18n.__('msg_info_invite',data.user_name,e.name),
                    date_str: util.formatDateTime(invitemsg[0].createdAt),
                }
            })
            io.to(data.room_id).emit('member_invite_msg',{
                send_msg,
                
            })
            
        })
        let latest_load_userfriend_emitId = 0;
        socket.on('load_userfriend',async (data) => {
            console.time('load_userfriend');
            const emitId = ++latest_load_userfriend_emitId;
            let text = data.text.indexOf('#') !== -1 ? data.text.substring(1) : data.text;
            text = util.regexSanitize(text);
            const skip = data.skip ?? 0;
            if(emitId !== latest_load_userfriend_emitId){
                console.log('userfriend abort');
                return;
            }
            let userfriends,userfriendCount;
            const userfriendQuery = {
                status: true,
                friends: session.user_id,
                $or: [
                    { name: { $regex: text, $options: 'i'}},
                    { no: { $regex: text, $options: 'i'}}
                ]
            };
            userfriends = User.find(userfriendQuery).skip(skip).limit(20).select('name image no').lean().exec();
            //userfriends = getUserFriends(session.user_id,text,skip);
            userfriendCount = User.countDocuments(userfriendQuery).exec();

            [userfriends,userfriendCount] = await Promise.all([userfriends,userfriendCount]);

            let friend_ids = userfriends.map(e => e._id);

            if(emitId !== latest_load_userfriend_emitId){
                console.log('userfriend abort');
                return;
            }
            const friendsRoom = await PrivateRoom.find({
                isPrivate: true,
                $and: [{members: session.user_id},{members: { $in: friend_ids}}]
            }).select('_id members');
            userfriends = userfriends.map(e => {
                const match_room = friendsRoom.find(r => r.members.includes(e._id));
                if(match_room){
                    e.room = match_room._id;
                }
                return e;
            })
            setTimeout(() => {
                if(latest_load_userfriend_emitId === emitId){
                    socket.emit('friend_display_' + data.type,{
                        friends: userfriends,
                        text: data.text,
                        count: userfriendCount,
                        no_friend: i18n.__('user_friend_not_found')
                    });
                    console.timeEnd('load_userfriend');
                }else{
                    console.log('abort');
                }
            }, 100);
        });


        socket.on('get_total_friend_request',async () => {
            const total_f_req = await FriendInvite.countDocuments({invitee: session.user_id,status: 'sent'})
            console.log('Total friend requests: ' + total_f_req);
            socket.emit('total_friend_request_receive',{total: total_f_req});
        })
        socket.on('load_friend_request', async (data) => {
            console.time('load_friend_request');
            const skip = data.skip ?? 0;
            let friend_requests = await FriendInvite.find({invitee: session.user_id,status: 'sent'}).sort('-createdAt').skip(skip).limit(3).populate('inviter','name image').lean();
            friend_requests = friend_requests.map(e => {
                e.date_str = util.formatFriendRequestDate(e.createdAt);
                return e;
            })    
            console.log(friend_requests.map(e => e.inviter.name));
            console.timeEnd('load_friend_request');    
            socket.emit('friend_request_display_' + data.type,{
                friend_requests,
                accept_text: i18n.__('user_friend_request_accept'),
                reject_text: i18n.__('user_friend_request_reject')
            })
        })

        let latest_load_userfriend_invite_emitId = 0;
        socket.on('load_friend_invite',async (data) => {
            const emitId = ++latest_load_userfriend_invite_emitId;
            const user_id = session.user_id;
            let text = data.text ? data.text.indexOf('#') !== -1 ? data.text.substring(1) : data.text : '';
            text = util.regexSanitize(text);
            const skip = data.skip ?? 0;
            if(emitId !== latest_load_userfriend_invite_emitId){
                //console.log('halfway user add abort ',latest_load_userfriend_invite_emitId,' ',emitId);
                return;
            }
            const friendRequest = await FriendInvite.find({status: 'sent',invitee: user_id}).select('inviter').lean().exec();
            if(emitId !== latest_load_userfriend_invite_emitId){
                //console.log('halfway user add abort ',latest_load_userfriend_invite_emitId,' ',emitId);
                return;
            }
            const friendsRequest_id = friendRequest.map(e => e.inviter.toString());
            const noFriendUsersQuery = {
                status: true,
                $and: [
                    {_id: {$ne: new mongoose.Types.ObjectId(user_id)}},
                    {_id: {$nin: friendsRequest_id}}
                ],
                friends: {$ne: user_id},
                $or: [
                    { name: { $regex: text, $options: 'i'}},
                    { no: { $regex: text, $options: 'i'}}
                ],
            };
            let noFriendUsers,noFriendUserCount,friendInvites;
            noFriendUsers = User.find(noFriendUsersQuery).skip(skip).limit(20).select('name image no').lean().exec();
            noFriendUserCount = User.countDocuments(noFriendUsersQuery).exec();
            friendInvites = FriendInvite.find({status: 'sent',inviter: user_id}).select('invitee').lean().exec();


            [noFriendUsers,noFriendUserCount,friendInvites] = await Promise.all([noFriendUsers,noFriendUserCount,friendInvites]);
            friendInvites = friendInvites.map(e => e.invitee.toString());
            noFriendUsers = noFriendUsers.map(e => {
                if(friendInvites.includes(e._id.toString())){
                    e.invited = true;
                }else{
                    e.invited = false;
                }
                return e;
            })
            if(emitId === latest_load_userfriend_invite_emitId){
                console.log('ss');
                socket.emit('friend_invite_display_'+data.type,{
                    friends: noFriendUsers,
                    count: noFriendUserCount,
                    text: data.text,
                    add_text: i18n.__('user_friend_invite_btn'),
                    cancel_text: i18n.__('user_friend_invite_btn_cancel')
                });
            }else{
                //console.log('user add abort ',latest_load_userfriend_invite_emitId,' ',emitId);
            }
        })
        
    });
}




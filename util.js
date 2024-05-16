const moment = require("moment");
const mongoose = require('mongoose');
const Room = require("./Models/Room");
const i18n = require('./locale.config');
const sharp = require('sharp');
const path = require('path');

function formatDate (date) {
    let targetdate;
    try{
        targetdate = moment(date);
    }catch{
        throw new Error('invalid date object')
    }
    
    const diffDays = moment().diff(targetdate,'days');
    let formattedDate;
    if(targetdate.day() === moment().day()){
        formattedDate = targetdate.format('HH:mm');
    }else if (diffDays < 7){
        formattedDate = targetdate.format('ddd');
    }else if (targetdate.year() === moment().year()){
        formattedDate = targetdate.format('DD MMM');
    }else{
        formattedDate = targetdate.format('DD/MM/YYYY')
    }
    return formattedDate;
}

function formatDateTime (date) {
    let targetdate;
    try{
        targetdate = moment(date);
    }catch{
        throw new Error('invalid date object')
    }
    
    const diffDays = moment().diff(targetdate,'days');
    let formattedDate;
    if(targetdate.day() === moment().day()){
        formattedDate = targetdate.format('HH:mm');
    }else if (diffDays < 7){
        formattedDate = targetdate.format('ddd HH:mm');
    }else if (targetdate.year() === moment().year()){
        formattedDate = targetdate.format('DD MMM HH:mm');
    }else{
        formattedDate = targetdate.format('DD/MM/YYYY HH:mm')
    }
    return formattedDate;
}

function formatFriendRequestDate(date) {
    let targetdate;
    try{
        targetdate = moment(date);
    }catch{
        throw new Error('invalid date object')
    }
    
    const diffDays = moment().diff(targetdate,'days');
    let formattedDate;
    if(diffDays < 1){
        const diffMinutes = moment().diff(targetdate,'minute');
        if(diffMinutes < 1){
            formattedDate = i18n.__('now');
        }else if(diffMinutes < 60){
            formattedDate = i18n.__n('minute',diffMinutes);
        }else{
            formattedDate = i18n.__n('hour',parseInt(diffMinutes / 60));
        }
    }else if (diffDays < 7 ){
        formattedDate = i18n.__n('day',diffDays);
    }else if (diffDays < 30){
        formattedDate = i18n.__n('week',parseInt(diffDays / 7));
    }else if (diffDays < 365){
        formattedDate = i18n.__n('month',parseInt(diffDays / 30));
    }else{
        formattedDate = i18n.__n('year',parseFloat(diffDays / 365));
    }
    return formattedDate;
}

async function getUserRoomList(user_id,skip = 0){
    return await Room.aggregate([
        { $match: {members: new mongoose.Types.ObjectId(user_id), status: true}},
        { $sort: {updatedAt: -1}},
        { $skip: skip},
        { $limit: 10},
        { $lookup: {
          from: 'users',
          localField: 'last_message.sender',
          foreignField: '_id',
          as: 'last_message.sender'
        }},
        { $project: {
          name: 1,
          image: 1,
          owner_id: 1,
          members: 1,
          updatedAt: 1,
          'last_message.sender_name': {$first: "$last_message.sender.name"},
          'last_message.text': 1,
          'last_message.createdAt': 1
        }}
      ]).exec();
}

function regexSanitize(text){
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadInitRoom(room_id,user_id){
    return new Promise(async (resolve,reject) => {
      let room;
      if(room_id){
        room = await Room.findOne({_id: room_id, status: true}).populate('members','name image').lean();
      }else{
        room = await Room.findOne({members: user_id, status: true}).sort('-updatedAt').populate('members','name image').lean();
      }
      resolve(room);
    })
  }

async function resizeImageToWebp(buffer,width,height,filename){
    return await sharp(buffer).resize(width,height).toFormat('webp').webp().toFile(path.join(__dirname,'public','images',filename));
}
module.exports = {
    formatDate,
    formatDateTime,
    getUserRoomList,
    formatFriendRequestDate,
    regexSanitize,
    loadInitRoom,
    resizeImageToWebp
}




let abortController = new AbortController();
let signal = abortController.signal;
var selectedFriends = [];
(function connect() {
  console.log('connected');
  let socket = io.connect(["http://192.168.1.44:3000", "http://localhost:3000"]);
  //join room
  let start;
  socket.on("disconnect", () => {
    console.log('disconnect');
    start = Date.now();
  });
  socket.on('connect', () => {
    console.log('connect');
    console.log((Date.now() - start) / 1000);
  })

  let message = document.querySelector("#message-input");
  let messageBtn = document.querySelector("#messageBtn");
  let messageBox = document.querySelector(".message-box");
  let messageList = document.querySelector('#message-list');
  let user_id = document.querySelector("#user_id").value; //input hidden
  let room_id = document.querySelector("#room_id").value; //input hidden
  let user_name = document.querySelector("#user_name").value;
  let allmessage = 0;
  let messageCount = 0;
  let isMessageTop = false

  socket.on("session_expired", () => {
    console.log("session_expired");
    window.location = "http://localhost:3000/";
  });

  //when connect 
  socket.emit("init");

  socket.on("init", () => {
  });
  if(messageBox && messageList){
    messageBox.scrollTop = messageBox.scrollHeight;
    messageCount = messageList.childElementCount;
    if(messageCount < 20) isMessageTop = true;
  }
//#region messasgeBox
if(messageBox){
  messageBox.addEventListener("scroll", (e) => {
    if (messageBox.scrollTop <= 0) {
      if(isMessageTop) return;
      socket.emit("load_more_message", {
        user_id,
        room_id,
        messageCount,
      });
    } else if (messageBox.scrollTop > 10) {
      const nomsg = document.querySelector('.no-more-msg');
      if (nomsg) {
        nomsg.remove()
      }
    }
  });
}

  socket.on("add_more_messages", (data) => {
    if (data.messages.length > 0) {
      if(data.messages.length < 20) isMessageTop = true;
      const oldHeight = messageBox.scrollHeight;
      data.messages.forEach((e) => {
        let box;
        if (e.text) {
          box =
            `<div class="msg-box my-2 ${e.sender[0]._id === user_id ? 'msg-this' : 'msg-other'}">
            <div class="msg-info-con">
              <div class="msg-info me-2">
                ${e.sender[0]._id === user_id ? data.you_text : e.sender[0].name}
              </div>
            </div>
            <div class="msg-text-con">
              <div class="img-con">
                <img class="profile-img" src="/images/${e.sender[0].image}">
              </div>
              <div class="msg-text">${e.text}</div>
            </div>
            <div class="msg-info">${e.date_str}</div>
          </div>`
        }
        else {
          box =
            `<div class="d-flex justify-content-center my-2">
              <div class="msg-system-info">
                ${e.date_str} - ${e.info_text}
              </div>
            </div>`
        }
        messageList.innerHTML = box + messageList.innerHTML;
        messageCount++;
      });
      messageBox.scrollTop = messageBox.scrollHeight - oldHeight;
    }
    else{
      isMessageTop = true;
    }
  });
  if(messageBtn){
    messageBtn.addEventListener("click", (e) => {
      console.log(message.value);
      socket.emit("new_message", { message: message.value, user_id, room_id });
      socket.emit('no-typing', { writer: user_name, room_id });
      message.value = "";
    });
  }
  if(message){
    message.addEventListener("keypress", (e) => {
      if(messageBtn.disabled) return;
      if (e.keyCode === 13) {
        console.log(message.value);
        socket.emit("new_message", { message: message.value, user_id, room_id });
        message.value = "";
      }
    });
    message.addEventListener("input", (e) => {
      if (message.value === "") {
        socket.emit("no-typing", { writer: user_name, user_id, room_id });
      } else {
        socket.emit("typing", { writer: user_name, user_id, room_id, text: message.value });
      }
    });
  }


  socket.on("receive_message", (data) => {
    //add new message to message box
    console.time('client receive_message');
    const noChat = document.getElementById("no-chat");
    if (noChat !== null) {
      noChat.remove();
    }
    messageList.innerHTML +=
      `<div class="msg-box my-2 ${data.user._id.toString() === user_id ? "msg-this" : "msg-other"}">
    <div class="msg-info-con">
      <div class="msg-info me-2">${data.user._id.toString() === user_id ? data.you_text : data.user.name}</div>
    </div>
    <div class="msg-text-con">
      <div class="img-con">
          <img class="profile-img" src="/images/${data.user.image}">
      </div>
      <div class="msg-text">${data.message.text}</div>
    </div>
    <div class="msg-info">${data.date_str}</div>
  </div>`
    messageBox.scrollTop = messageBox.scrollHeight;
    messageCount++;
    console.timeEnd('client receive_message');
    socket.emit("no-typing", { writer: user_name, user_id, room_id });
  });

  let typing = [];
  const input_box = document.querySelector('.text-input');
  socket.on("typing", (data) => {
    if (data.room_id.toString() !== room_id.toString()) return;
    if (data.user_id.toString() === user_id.toString()) return;
    if (!typing.includes(data.writer)) {
      typing.push(data.writer);
      let info = document.createElement('div');
      info.id = 'info-' + data.writer;
      info.textContent = data.text;
      info.classList.add('info')
      input_box.appendChild(info);
      setTimeout(() => {
        info.classList.add('info-pop-up');
      }, 50);
    }
  });

  socket.on("no-typing", (data) => {
    if (data.room_id.toString() !== room_id.toString()) return;
    const index = typing.indexOf(data.writer);
    if (index !== -1) {
      typing.splice(index, 1);
      const info = document.querySelector('#info-' + data.writer);
      info.classList.remove('info-pop-up');
      info.remove();
    }
  });

  socket.on("load_failed", () => {
    alert("Load Messages Failed");
  });

  //#endregion messageBox
  
  
  //#region room
  socket.on('room_update', (data) => {
    //update room info

    const rooms_con = document.querySelector(".room-con.on");
    const current_room = document.querySelector("#roombox-" + data.room_id);
    rooms_con.prepend(current_room);
    document.querySelector(".room-sender.on").innerHTML = data.user_name + ":";
    document.querySelector(".room-text.on").innerHTML = data.message;
    document.querySelector(".room-update-date.on").innerHTML = data.room_update_date;

    const rooms_con_off = document.querySelector(".room-con.off");
    const current_room_off = document.querySelector("#roombox-off-" + data.room_id);
    rooms_con_off.prepend(current_room_off);
    console.log(document.querySelector(".room-text.off").innerHTML);
    document.querySelector(".room-sender.off").innerHTML = data.user_name + ":";
    document.querySelector(".room-text.off").innerHTML = data.message;
    document.querySelector(".room-update-date.off").innerHTML = data.room_update_date;
  })

  
//#endregion room


  //#region roomInvite
  async function roomInviteFriendSearch(){
    const friends_list_con = document.querySelector('.f-con');
    const friend_input = document.querySelector('#friend-invite-input');
    const friend_search_loading = document.querySelector('#friend-search-loading');
  
    if (friend_input.value.length >= 0) {
      //abort all previous friend_input function call
      abortController.abort();
      abortController = new AbortController();
      signal = abortController.signal
  
  
      friend_search_loading.classList.remove('d-none');
  
      let text;
      if (friend_input.value.indexOf('#') === 0) {
        text = friend_input.value.substring(1);
      } else {
        text = friend_input.value;
      }
      const component = `room=${room_id}&text=${text}`;
      let encodedComponent = encodeURIComponent(component);
      friends_list_con.innerHTML = '';
      let friends
      try{
        friends = await fetch(`/api/friends/getuserfriends?${encodedComponent}`,{signal: signal}).then(async(data) => {
          return await data.json()
        });
      }catch(err){
        if(err.name === 'AbortError') {
          console.log('abort');
          return;
        }
        else throw err;
      }
      friends = SearchMatchScore(friends, friend_input.value, ['name', 'no']);
      friends.forEach(f => {
        friends_list_con.innerHTML +=
          `<li class="list-group-item" onClick="friendSelect(this,'${f._id}')">
            <a class="f-box" href="#">
              <div class="f-img-con">
                  <img class="f-img" src="/images/${f.image}" alt="aa">
              </div>
              <div class="f-name-con">
                <div class="f-name me-1">${f.name}</div>
                <div class="f-code">#${f.no}</div>
              </div>
            </a>
          </li>`;
      })
      friend_search_loading.classList.add('d-none');
    }
  }
  if(room_id){
    //roomInviteFriendSearch();
    
    const friend_input = document.querySelector('#friend-invite-input');
    friend_input.addEventListener('input', roomInviteFriendSearch);
  
    const invite_btn = document.querySelector('#friend-invite-btn')
    invite_btn.disabled = true;
    
  
    invite_btn.addEventListener('click', () => {
      socket.emit('invite_to_room', { selectedFriends, room_id,user_name });
      selectedFriends = [];
    })
    socket.on('member_invite_msg', (data) => {
      data.send_msg.forEach(e => {
        messageList.innerHTML +=
          `<div class="d-flex justify-content-center my-2">
            <div class="msg-system-info">
              ${e.date_str} - ${e.invite_text}
            </div>
        </div>`;
      })
      messageBox.scrollTop = messageBox.scrollHeight;
    })
  }

  //#endregion roomInvite


  //#region userFriend
    //#region myfriend  
  const user_f_input = document.querySelector('#user-friend-search');
  const userfriendList = document.querySelector('#userfriendList');
  const user_f_loading = document.querySelector('#user-friend-search-loading');
  const user_f_extend_loading = document.querySelector('#user-friend-extend-loading');
  const userfriendListH = document.querySelector('#userfriendList-h');
  let userFriendCount = 0;
  let userFriendMax = 0;
  let user_f_isBottom = false;
  let user_f_isExtendLoading = false;

  // user_f_loading.classList.remove('d-none');
  // console.log('load');
  // socket.emit('load_userfriend',{
  //   text: user_f_input.value,
  //   type: 'new'
  // })
  userFriendCount = userfriendList.childElementCount;
  userFriendMax = parseInt(document.querySelector('#user-friend-count').innerHTML);
  user_f_isBottom = userFriendCount === userFriendMax;

  user_f_input.addEventListener('input',(e) => {
    user_f_loading.classList.remove('d-none');
    socket.emit('load_userfriend',{
      text: user_f_input.value,
      type: 'new'
    })
  })

  userfriendListH.addEventListener('scroll',(e) => {
    if(userfriendListH.scrollTop + userfriendListH.clientHeight >= userfriendListH.scrollHeight - 10){
      if(user_f_isBottom || user_f_isExtendLoading) return;
      user_f_isExtendLoading = true;
      user_f_extend_loading.classList.remove('d-none');
      socket.emit('load_userfriend',{
        text: user_f_input.value,
        skip: userFriendCount,
        type: 'extend'
      })
    }
  })

  socket.on('friend_display_new',(data) => {
    userFriendCount = data.friends.length;
    userFriendMax = data.count;
    if(data.friends.length < 20 || userFriendCount === userFriendMax){
      user_f_isBottom = true;
    } 
    else{
      user_f_isBottom = false;
    } 
    document.querySelector('#user-friend-search-result').innerHTML = data.count;
    const friends = SearchMatchScore(data.friends,data.text,['name','no']);
    userfriendList.innerHTML = ""
    friends.forEach(e => {
      userfriendList.innerHTML += 
      `<li class="list-group-item p-0">
        <div class="d-flex align-items-center user-f-box">
          <a href="/user-profile/${e._id}" class="user-f-info">
            <div class="user-f-img-con">
              <img class="user-f-img" src="/images/${e.image}" alt="aa">
            </div>
            <div class="user-f-name-con">
              <div class="user-f-name me-1">${e.name}</div>
              <div class="user-f-code">#${e.no}</div>
            </div>
          </a>
          <div class="user-f-gotoroom d-flex align-items-center justify-content-center">
            <a href="/?room=${e.room}" >
              <i class="bi-chat"></i>
            </a>
          </div>
        </div>
      </li>`
    })
    user_f_loading.classList.add('d-none')
    console.log(user_f_isBottom);
  })
  socket.on('friend_display_extend',(data) => {
    userFriendCount += data.friends.length;
    if(data.friends.length < 20 || data.friends.length === userFriendMax){
       user_f_isBottom = true;
    }
    const friends = SearchMatchScore(data.friends,data.text,['name','no']);
    friends.forEach(e => {
      userfriendList.innerHTML += 
      `<li class="list-group-item p-0">
        <div class="d-flex align-items-center">
          <a href="/user-profile/${e._id}" class="user-f-info">
            <div class="user-f-img-con">
              <img class="user-f-img" src="/images/${e.image}" alt="aa">
            </div>
            <div class="user-f-name-con">
              <div class="user-f-name me-1">${e.name}</div>
              <div class="user-f-code">#${e.no}</div>
            </div>
          </a>
          <div class="user-f-gotoroom d-flex align-items-center justify-content-center">
            <a href="/?room=${e.room}">
              <i class="bi-chat"></i>
            </a>
          </div>
        </div>
      </li>`
    })
    user_f_isExtendLoading = false;
    user_f_extend_loading.classList.add('d-none');
  })
    //#endregion myfriend
    
    //#region friendRequest

  const user_f_request_list = document.querySelector('#user-f-request-con');
  const user_friend_request_loading = document.querySelector('#user-friend-request-loading');
  let user_f_request_isEnd = false;
  let user_f_reqeust_isExtendLoading = false;
  let user_f_request_count = 0;
  let user_f_request_max = 0;
  // user_friend_request_loading.classList.remove('d-none');
  // socket.emit('get_total_friend_request');
  // socket.emit('load_friend_request',{type: 'new'});

  // socket.on('total_friend_request_receive',(data) => {
  //   user_f_request_max = data.total
  // })

  user_f_request_count = user_f_request_list.childElementCount;
  user_f_request_max = parseInt(document.querySelector('#user-friend-request-count').innerHTML);
  user_f_request_isEnd = user_f_request_count === user_f_request_max;

  user_f_request_list.addEventListener('scroll',()=> {
    if(user_f_request_list.scrollLeft + user_f_request_list.clientWidth >= user_f_request_list.scrollWidth - 10){
      if(user_f_request_isEnd || user_f_reqeust_isExtendLoading || user_f_request_count === user_f_request_max) return;
      user_f_reqeust_isExtendLoading = true;
      user_friend_request_loading.classList.remove('d-none');
      socket.emit('load_friend_request',{type: 'extend', skip: user_f_request_count});
    }
  })

  socket.on('friend_request_display_new',(data) => {
    user_f_request_count += data.friend_requests.length;
    if(data.friend_requests.length < 20 || data.friend_request.length === user_f_request_max){
      user_f_request_isEnd = true;
    }else{
      user_f_request_isEnd = false;
    }
    user_f_request_list.innerHTML = '';
    data.friend_requests.forEach(e => {
      user_f_request_list.innerHTML += 
      `<div class="user-f-request-box" id="req-box-${e.inviter._id}">
        <a href="/user-profile/${e.inviter._id}" style="text-decoration: none; color: #000;">
          <div class="user-f-request-date">${e.date_str}</div>
          <div class="user-f-request-img">
            <img src="/images/${e.inviter.image}" alt="">
            </div>
          <div class="user-f-request-name">
            ${e.inviter.name}
          </div>
        </a>
        <div class="user-f-request-btn">
          <button class="user-f-request-accept-btn btn btn-primary me-1" onclick="friendAccept(this,'${e.inviter._id}')">${data.accept_text}</button>
          <button class="user-f-request-reject-btn btn btn-light">${data.reject_text}</button>
        </div>
      </div>`;
    })
    user_friend_request_loading.classList.add('d-none')
  })

  socket.on('friend_request_display_extend',(data) => {
    user_f_request_count += data.friend_requests.length;
    if(data.friend_requests.length < 20 || data.friend_requests.length === user_f_request_max){
      user_f_request_isEnd = true;
    }
    data.friend_requests.forEach(e => {
      user_f_request_list.innerHTML +=
      `<div class="user-f-request-box" id="req-box-${e.inviter._id}">
        <a href="/user-profile/${e.inviter._id}" style="text-decoration: none; color: #000;">
          <div class="user-f-request-date">${e.date_str}</div>
          <div class="user-f-request-img">
            <img src="/images/${e.inviter.image}" alt="">
            </div>
          <div class="user-f-request-name">
            ${e.inviter.name}
          </div>
        </a>
        <div class="user-f-request-btn">
          <button class="user-f-request-accept-btn btn btn-primary me-1" onclick="friendAccept(this,'${e.inviter._id}')">${data.accept_text}</button>
          <button class="user-f-request-reject-btn btn btn-light">${data.reject_text}</button>
        </div>
      </div>`;
    })
    user_f_reqeust_isExtendLoading = false;
    user_friend_request_loading.classList.add('d-none');
  })
  
  
    //#endregion friendRequest

    //#region friendAdd

    const f_offcanvas = document.querySelector('#user-friend-list-offcanvas');
    const f_add_list = document.querySelector('#user-f-invite-con');
    const f_add_input = document.querySelector("#user-friend-invite-search");
    const f_add_loading = document.querySelector('#user-friend-invite-loading');
    const f_add_count_display = document.querySelector('#user-f-invite-count');
    let f_add_count = f_add_list.childElementCount;
    let f_add_max = parseInt(document.querySelector('#user-f-invite-max').value);
    let f_add_isEnd = f_add_count === f_add_max;
    let f_add_isLoading = false;

    f_add_input.addEventListener('input',() => {
      f_add_loading.classList.remove('d-none');
      f_add_list.innerHTML = '';
      socket.emit('load_friend_invite',{
        text: f_add_input.value,
        type: 'new'
      });
    })
      f_add_list.addEventListener('scroll',()=> {
      if(f_add_list.scrollTop + f_add_list.clientHeight >= f_add_list.scrollHeight - 10){
        if(f_add_isEnd || f_add_isLoading) return;
        f_add_isLoading = true;
        socket.emit('load_friend_invite',{
          text: f_add_input.value,
          skip: f_add_count,
          type: 'extend'
        })
      }
    })


    socket.on('friend_invite_display_new',(data) => {
      f_add_count = data.friends.length;
      f_add_max = data.count;
      f_add_count_display.innerHTML = f_add_max;
      if(f_add_count === f_add_max){
        f_add_isEnd = true;
      }else{
        f_add_isEnd = false;
      }
      data.friends = SearchMatchScore(data.friends,data.text,['name','no']);

      data.friends.forEach(e => {
        f_add_list.innerHTML += 
        `<div class="user-f-invite-box-con col-6 col-xl-4">
        <div class="user-f-invite-box">
          <div class="user-f-invite-img">
            <img src="/images/${e.image}" alt="">
          </div>
          <div class="user-f-invite-name">
            ${e.name}
          </div>
          <div class="user-f-invite-btn">
            <button class="user-f-invite-send-btn btn btn-primary" onclick="addFriend(this,'${e._id}')">${data.add_text}</button>
          </div>
        </div>
      </div>`;
      })
      f_add_loading.classList.add('d-none');
    })

    socket.on('friend_invite_display_extend',(data) => {
      f_add_count += data.friends.length;
      f_add_max = data.count;
      if(f_add_count === f_add_max){
        f_add_isEnd = true;
      }else{
        f_add_isEnd = false;
      }
      data.friends = SearchMatchScore(data.friends,data.text,['name','no']);

      data.friends.forEach(e => {
        f_add_list.innerHTML += 
        `<div class="user-f-invite-box-con col-6 col-xl-4">
        <div class="user-f-invite-box">
          <div class="user-f-invite-img">
            <img src="/images/${e.image}" alt="">
          </div>
          <div class="user-f-invite-name">
            ${e.name}
          </div>
          <div class="user-f-invite-btn">
            <button class="user-f-invite-send-btn btn btn-primary" onclick="addFriend(this,'${e._id}')">${data.add_text}</button>
          </div>
        </div>
      </div>`;
      })
    })
    //#endregion friendAdd
  //#region userFriend
  
})();


async function friendAccept(element, f_id){
  const this_text = element.innerHTML;
  element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
  element.disabled = true;
  const rowAffected = await fetch('/api/friends/friendAccept',{
    method: "POST",
    headers:{
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ "inviter": f_id})  
  }).then(r => r.json().then(j => j.rowAffected))
  .catch(err => {
    alert(err.msg)
  })
  if(rowAffected > 0){
    const f_req_box = document.querySelector('#req-box-'+ f_id);
    console.log(f_req_box);
    f_req_box.remove();
    Swal.mixin({
      toast: true,
      position: "top-start",
      showConfirmButton: true,
      timer: 3000,
    }).fire({
      icon: "success",
      title: this_text === 'Accept' ? 'Friend request accepted' : "รับคำขอเป็นเพื่อนแล้ว"
    });
  }

}

async function friendReject(element, f_id){
  element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
  element.disabled = true;
  const rowAffected = await fetch('/api/friends/friendReject',{
    method: "PATCH",
    headers:{
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ "inviter": f_id})  
  }).then(r => r.json().then(j => j.rowAffected))
  .catch(err => {
    alert(err.msg)
  })
  if(rowAffected > 0){
    const f_req_box = document.querySelector('#req-box-'+ f_id);
    console.log(f_req_box);
    f_req_box.remove();
  }

}



function friendSelect(element, user_id) {
  const invite_btn = document.querySelector('#friend-invite-btn')
  if (element.classList.contains('f-selected')) {
    selectedFriends.splice(selectedFriends.indexOf(user_id), 1);
    element.classList.remove('f-selected');
  } else {
    selectedFriends.push(user_id)
    element.classList.add('f-selected');
  }
  console.log(selectedFriends);
  invite_btn.disabled = selectedFriends.length === 0;
}

function SearchMatchScore(array, text, rule) {
  for (let f of rule) {
    let weight = f === 'name' ? 5 : 1
    let isCodeSearch = false
    if(f === 'no' && text.indexOf('#') === 0){
      isCodeSearch = true
      text = text.substring(1);
    }
    for (let e of array) {
      if (!e.score) e.score = 0;
      //if found with case sensitive
      if (e[f].indexOf(text) !== -1) {
        e.score += 5 * weight;
      }
      let field = e[f].toLowerCase();
      let lowerText = text.toLowerCase();
      let index = field.indexOf(lowerText)
      //if found with case insensitive
      if (index !== -1) {
        if(isCodeSearch && text !== '') e.score += 10000;
        //add score order by position of text e.g 'el' -> 'Hello' position is 1 score = 20 - (1 * 2)
        e.score += (20 - (index * 2)) * weight;
        if (field.length === lowerText.length) {
          e.score += 10000;
        } else {
          //add score order by text remain e.g  'Hel' -> 'Hello' remain is 2 score = 10 - (2 * 2) = 16
          const s = (10 - (field.length - text.length)) * weight;
          e.score += s
        }
      }

    }
  }
  array.sort((a,b) => b.score - a.score)
  //console.log(array);
  return array;
}

async function addFriend(element,f_id){
  const this_text = element.innerHTML;
  element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  let rowAffected;
  try{
    rowAffected = await fetch('/api/friends/addFriend',{
      method: "POST",
      headers:{
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ "f_id": f_id})  
    }).then(result => result.json().then(e => e.rowAffected))
  }catch(err){
    alert('some error occur.');
    console.error(err);
  }
  if(rowAffected === 0){
    element.innerHTML = this_text;
    return;
  }
  element.classList.remove('btn-primary');
  element.classList.add('btn-secondary');
  element.innerHTML = this_text === 'Add friend' ? 'Cancel' : 'ยกเลิก'
  element.onclick = () => {
    cancelAddFriend(element,f_id);
  }
}
async function cancelAddFriend(element,f_id){
  const this_text = element.innerHTML;
  element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  let rowAffected;
  try{
    rowAffected = await fetch('/api/friends/cancelAddFriend',{
      method: "DELETE",
      headers:{
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ "f_id": f_id})  
    }).then(result => result.json().then(e => e.rowAffected));
  }catch(err){
    alert('some error occur.');
    console.error(err);
  }
  if(rowAffected === 0){
    element.innerHTML = this_text;
    return;
  }
  element.classList.remove('btn-secondary');
  element.classList.add('btn-primary');
  element.innerHTML = this_text === 'Cancel' ? 'Add friend' : 'เพิ่มเป็นเพื่อน';
  element.onclick = () => {
    addFriend(element,f_id);
  }
  
}







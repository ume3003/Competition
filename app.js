
var config = require('config');
var clientHTML = require('fs').readFileSync('html/client.html');
var server = require('http').createServer(function(req,res){
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(clientHTML);
});
var io = require('socket.io').listen(server);

io.set('log_level',1);

var redis = require('redis');
    console.log('connect to redis server to ' + config.RedisHost + ':' + config.RedisPort );

var store = redis.createClient(config.RedisPort,config.RedisHost);
    store.select(config.RedisDB,function(err,reply){
        console.log("select redis db " + config.RedisDB + ' ' + err + '**** ' + reply);
    });

server.listen(3000,function(){
    console.log('server listen port 3000');
});

var SendTag = {
    SOCKET_ID       : 'socket id',
    RECEIVE_ROOM    : 'receiveRoom',
    LEAVE_ROOM      : 'leaveRoom',
    LINK_DOWN       : 'linkDown',
    RESUME_GAME     : 'resumeGame',
    JOIN_ROOM       : 'joinRoom',
    COMPETITOR_JOIN : 'competitorJoin',
    COMPETITOR_BACK : 'competitorBack',
    START_SESSION   : 'startSession',
    AUDIT_COUNT     : 'auditCount',
    CLOSE_ROOM      : 'closeRoom',
    GAME_DATA       : 'gameData',
    GAME_RESULT     : 'gameResult',
    SYSTEM_MESSAGE  : 'SystemMessage',
    GLOBAL          : 'global',
    SEED            : 'seed',
    READY           : 'readySession',
    END : ''
};
var ReceiveTag = {
    CONNECT     : 'connection',             // 接続時
    DISCONNECT  : 'disconnect',             // 切断時
    ADD_USER     : 'addUser',               // 接続後、ユーザー登録を刷る
    RECONNECT   : 'reconnect',              // 再接続
    SAY_ROOM    : 'sayRoom',                // ルーム内のデータやりとり
    LEAVE_ROOM  : 'leaveRoom',              // 退出
    GAME_DATA   : 'gameData',               // 再接続者用のゲームデータ
    CONFIRM     : 'confirm',                // 勝利情報の送信
    FINISH      : 'finish',                  // 勝利者による勝利条件の送信（開始トリガー
    GLOBAL      : 'global',
    SEED        : 'seed',
    READY       : 'readySession',
    END:''
};
var arenaRooms = {};

io.on(ReceiveTag.CONNECT,function(socket){
    console.log('client connect ' + socket.id);
    //socket.emit(SendTag.SOCKET_ID, {retCode:1,msg : socket.id });          // socketIdを送ってるが意味はない

    socket.on(ReceiveTag.GLOBAL,function(data){
        console.log("get message " + data.message);
        socket.emit(SendTag.GLOBAL,data);
    });
    socket.on(ReceiveTag.ADD_USER,function(data){                 // 接続したら、UUIDとRoomIDを送ること
        socket.userUUID = data.userUUID;
        socket.roomUUID = data.roomUUID;
        console.log('recieve from client ' +data.userUUID + " " + data.roomUUID);
        var room = arenaRooms[socket.roomUUID];

        store.get('e001:' + socket.roomUUID,function(err,redisSessionData){       // Redis から該当するユーザーとルーム情報をとる
            if(err){
                return console.log("connection error : " + err);
            }
            try{
                if(redisSessionData === null){                  // ないときはNULL
                    socket.emit(SendTag.SYSTEM_MESSAGE,{retCode: 0,msg:'invalid connection'});
                    socket.disconnect();
                    return console.log('room is invalid ' + socket.userUUID + ' ' + socket.roomUUID);
                }
                if(room === undefined){         // ルームを新規作成
                    console.log('create new room ' + socket.userUUID + ' ' + socket.roomUUID);
                    room = JSON.parse(redisSessionData);
                    room.waitJoinUser = room.registeredUserCount;       // 参加待ち人数
                    room.waitStartUser = room.registeredUserCount;
                    room.arenaUser = 0;                                 // 戦闘ユーザー数
                    room.auditUser = 0;                                 // 観戦ユーザー数
                    room.auditMember = {};                              // 観戦ユーザーのID列
                    room.linkDownUser = {};                             // 切断ユーザーのID列
                    room.gameState = 0;                                 // ゲーム状態 0:開始前 1:ゲーム中 2;ゲーム終了
                    room.gameConfirm = {};                              // ゲーム勝敗確定フラグハッシュ
                    room.gameResult = {};                               // ゲーム結果ハッシュ
                    arenaRooms[socket.roomUUID] = room;
                }
                var user = room.registered[socket.userUUID];
                var jsonSessionData = JSON.parse(redisSessionData);
                if(user !== undefined){
                    socket.isArena = true;
                    room.waitJoinUser--;
                    room.arenaUser++;
                    socket.join('arena:' + socket.roomUUID);          // roomに参加し、roomUUIDを送信
                    //socket.emit(SendTag.JOIN_ROOM,{retCode:1,msg:{roomUUID :socket.roomUUID,registered : room.registered}});
                    socket.emit(SendTag.JOIN_ROOM,{retCode:1,msg:jsonSessionData});
                    io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.COMPETITOR_JOIN,{retCode:1,msg:user});
                    io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.COMPETITOR_JOIN,{retCode:1,msg:user});
                    if(room.waitJoinUser === 0){
                        room.gameState = 1;
                        io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.START_SESSION,{retCode:1});
                        io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.START_SESSION,{retCode:1});
                    }
                }
                else{
                    socket.isArena = false;
                    room.auditUser++;
                    room.auditMember[socket.userUUID] = socket.userUUID;
                    socket.join('audit:' + socket.roomUUID);          // roomに参加し、roomUUIDを送信
                    //socket.emit(SendTag.JOIN_ROOM,{retCode:1,msg:{roomUUID:socket.roomUUID,registered:room.registered}});
                    socket.emit(SendTag.JOIN_ROOM,{retCode:1,msg:jsonSessionData});
                    io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.AUDIT_COUNT,{retCode:1,msg:room.auditUser});
                    io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.AUDIT_COUNT,{retCode:1,msg:room.auditUser});
                }
            }
            catch(exception){
                return console.log("exception" + exception);
            }
        });
    });

    socket.on(ReceiveTag.READY,function(data){
        if(socket.roomUUID !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                var room = arenaRooms[socket.roomUUID];
                room.waitStartUser--;
                if(room.waitStartUser === 0){
                    io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.READY,{retCode:1});
                }
            }
        }
        console.log('send ready ' + socket.roomUUID );
    });
    socket.on(ReceiveTag.SEED,function(data){
        var seed = new Array(100);
        if(socket.roomUUID !== undefined){
            if(socket.isArena !== undefined && socket.isArena){

                for(i = 0;i < 100;i++){
                    seed[i] = {d:Math.floor(Math.random() * 256)};
                }
                io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.SEED,{retCode:1,msg:seed});
            }
        }
        console.log('send seed ' + socket.roomUUID + ' ' + seed);
    });
    socket.on(ReceiveTag.SAY_ROOM,function(data){                 // Room内でのメッセージのやりとり
        if(socket.roomUUID !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.RECEIVE_ROOM,{retCode:1,msg:data});
            }
            io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.RECEIVE_ROOM,{retCode:1,msg:data});
        }
        console.log('say room msg ' + socket.roomUUID + ' ' + data);
    });
    // 試合終了
    // 勝利者が情報をアップ
    // アップした情報を対戦者におくる
    // 対戦者はチェックしておかしかったらNGをかえす
    // 一分後に保存がされていない場合は自動的に保存
    socket.on(ReceiveTag.FINISH,function(data){
        var room = arenaRooms[socket.roomUUID];
        for(var i in room.registered){
            room.gameConfirm[i] = false;
        }
        if(socket.roomUUID !== undefined && room !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                room.gameResult[socket.userUUID] = data.result;
                room.gameConfirm[socket.userUUID] = true;
                io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.GAME_RESULT,{retCode:1,msg:room.gameResult});
                // スケジュール処理　
                setTimeout(function(){
                    if(room.gameResult !== undefined){
                        store.set('result:' + socket.roomUUID,JSON.stringify(room.gameResult),function(err){
                            if(err){
                                return console.log(err);
                            }
                            console.log('saved ' + socket.roomUUID);
                            room.gameResult = undefined;
                        });
                    }
                    else{
                        console.log('already saved ' + roomUUID);
                    }
                },60000);
            }
        }
    });
    // 確認メッセージがおくられてきたら、確認データにいる自分のフラグをTRUEに
    // 全員確認済みになったら、Redisに保存する
    socket.on(ReceiveTag.CONFIRM,function(data){
        var room = arenaRooms[socket.roomUUID];
        if(socket.roomUUID !== undefined && room !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                room.gameResult[socket.userUUID] = data.result;
                room.gameConfirm[socket.userUUID] = true;
                for(var i in room.gameConfirm){
                    if(room.gameConfirm[i] === false){
                        return;
                    }
                }
                // 全員OKした
                store.set('result:' + socket.roomUUID,JSON.stringify(room.gameResult),function(err){
                    if(err){
                        return console.log(err);
                    }
                    console.log('saved ' + socket.roomUUID);
                    room.gameResult = undefined;
                });
            }
        }
    });
    // 再接続を行う。
    // 切断リストから削除して入室情報をかえし、すべてのユーザーに再接続したユーザーを返す
    socket.on(ReceiveTag.RECONNECT,function(data){
        socket.userUUID = data.userUUID;
        socket.roomUUID = data.roomUUID;

        var room = arenaRooms[socket.roomUUID];
        if(room !== undefined){
            var user = room.registered[socket.userUUID];
            var ldUser = room.linkDownUser[socket.userUUID];
            if(user !== undefined && ldUser !== undefined){
                room.arenaUser++;
                socket.join('arena:' + socket.roomUUID);          // roomに参加し、roomUUIDを送信
                delete room.linkDownUser[socket.userUUID];
                socket.emit(SendTag.JOIN_ROOM,{retCode:1,msg:{roomUUID :socket.roomUUID,registered : room.registered}});
                io.sockets.in('arena:' + roomUUID).emit(SendTag.COMPETITOR_BACK,{retCode:1,msg:user});
                io.sockets.in('audit:' + roomUUID).emit(SendTag.COMPETITOR_BACK,{retCode:1,msg:user});
            }
        }
        else{
            socket.emit(SendTag.SYSTEM_MESSAGE,{retCode: 0,msg:'room closed'});
            socket.disconnect();
            return console.log('room already closed ' + socket.userUUID + ' ' + socket.roomUUID);
        }

    });
   // 再接続したクライアントがあったら、残ってたクライアントからゲームデータを送ること
    // おくられたゲームデータは全クライアントに送信される
    socket.on(ReceiveTag.GAME_DATA,function(data){
        var room = arenaRooms[socket.roomUUID];
        if(socket.roomUUID !== undefined && room !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.GAME_DATA,{retCode:1,msg:data});
            }
        }
    });
    // 退出
    // アリーナの人はレジストデータを削除し、参加人数をへらす
    // オーディットの人はオーディットデータを削除し、観戦人数をへらす
    // 両方とも０になったらルームを削除する
    socket.on(ReceiveTag.LEAVE_ROOM,function(data){
        var room = arenaRooms[socket.roomUUID];
        if(socket.roomUUID !== undefined && room !== undefined){
            if(socket.isArena !== undefined && socket.isArena){
                var user = room.registered[socket.userUUID];
                if(user !== undefined){
                    io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.LEAVE_ROOM,{retCode:1,msg:user});
                    io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.LEAVE_ROOM,{retCode:1,msg:user});
                    delete room.registered[socket.userUUID];
                    room.arenaUser--;
                }
                socket.leave('arena:' + socket.roomUUID);
            }
            else{
                var audit = room.auditMember[socket.userUUID];
                if(audit !== undefined){
                    delete room.auditMember[socket.userUUID];
                    room.auditUser--;
                    io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.AUDIT_COUNT,{retCode:1,msg:room.auditUser});
                    io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.AUDIT_COUNT,{retCode:1,msg:room.auditUser});
                }
                socket.leave('audit:' + socket.roomUUID);
            }
            if(room.arenaUser === 0 && room.auditUser === 0 ){
                delete arenaRooms[socket.roomUUID];
                console.log('close room ' + socket.roomUUID);
            }
        }
    });
    // ルーム退出をしないで切れた場合
    // 対戦相手に通知
    socket.on(ReceiveTag.DISCONNECT,function(){                 // セッションおわたら接続きってくる
        if(socket.roomUUID !== undefined){
            var room = arenaRooms[socket.roomUUID];
            if(room !== undefined){
                if(socket.isArena !== undefined && socket.isArena){
                    var user = room.registered[socket.userUUID];
                    if(user !== undefined){                  // 本来はLEAVEROOMしてるはずなのでない。
                        io.sockets.in('arena:' + socket.roomUUID).emit(SendTag.LINK_DOWN,{retCode:1,msg:user});
                        io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.LINK_DOWN,{retCode:1,msg:user});
                        room.linkDownUser[socket.userUUID] = user;
                        room.arenaUser--;
                    }
                }
                else{
                    var audit = room.auditMember[socket.userUUID];
                    if(audit !== undefined){
                        delete room.auditMember[socket.userUUID];
                       room.auditUser--;
                    }
                }
                if(room.arenaUser === 0){
                    delete arenaRooms[socket.roomUUID];
                    io.sockets.in('audit:' + socket.roomUUID).emit(SendTag.CLOSE_ROOM,{retCode:1});
                    console.log('close room ' + socket.roomUUID);
                }
            }
        }
        console.log(socket.userUUID + ' leave');
    });
});
////////////////////////////////////////////////////
//
var javaID = 'd001:c6903c6e-e472-4a8f-aee0-1103cff447d1';

store.get(javaID,function(err,data){
   if(err){
       return console.log(err);
   }
    console.log('cache data:' + data);
    if(data !== null){
        var obj = JSON.parse(data);
        console.log('java data ' + obj.d001);

    }
});
// サンプル用のREDISデータの登録
var sampleRoomUUID = 'sampleRoomUUID0001';
var sampleSession = {
    roomUUID            : sampleRoomUUID,
    registeredUserCount : 2,
    registered: {'001':{userUUID:'001',displayName:'001の人'},
                 '002':{userUUID:'002',displayName:'002の人'}
                }
    };
store.set(sampleRoomUUID,JSON.stringify(sampleSession),function(err){
    if(err){
        return console.log(err);
    }
    store.get(sampleRoomUUID,function(getErr,data){
        if(getErr){
            return console.log(getErr);
        }
        var obj = JSON.parse(data);
        console.log('sample data ' + obj.roomUUID + ' count:' + obj.registeredUserCount + ' ' + obj.registered['001'].userUUID + ' ' + obj.registered['002'].userUUID);
    })
})

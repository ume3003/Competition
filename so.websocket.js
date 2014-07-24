/**
 *
 * Created with IntelliJ IDEA.
 * User: shouzouueno
 * Date: 2014/04/29
 * Time: 16:39
 * To change this template use File | Settings | File Templates.
 */

var config = require('config'),
    _users = {},
    _rooms = {},
    _socketId = {};

module.exports = {
    redis   : undefined,
    store   : undefined,
    http    : undefined,
    httpServer  : undefined,
    WSServer : undefined,
    WS       : undefined,
    app     : undefined,
    host    : undefined,
    port    : undefined
};

module.exports.init = function(){

    console.log("configType = ",config.configType);
    var clientHTML = require('fs').readFileSync('html/client.html');
    module.exports.host = process.env.HOST || 'http://127.0.0.1';
    module.exports.port = process.env.PORT || '8000';
    module.exports.http = require('http');
    module.exports.httpServer = module.exports.http.createServer(function(req,res){
        res.writeHead(200,{'Content-Type':'text/html'});
        res.end(clientHTML);
    });


    module.exports.WS = require('websocket').server;

    module.exports.httpServer.listen(module.exports.port,function(){
        console.log("express server listen port " , module.exports.host + ' port ' + module.exports.port);
    });
    module.exports.WSServer= new module.exports.WS({httpServer : module.exports.httpServer});


    module.exports.redis = require('redis');
    console.log('connect to redis server to ' + config.RedisHost + ':' + config.RedisPort );

    module.exports.store = module.exports.redis.createClient(config.RedisPort,config.RedisHost);
    module.exports.store.select(config.RedisDB,function(err,reply){
       console.log("select redis db " + config.RedisDB + ' ' + err + '**** ' + reply);
    });
};

module.exports.pushUser = function(key,val)
{
    _users[key] = val;
};

module.exports.getUser = function(key)
{
    return _users[key];
};

module.exports.pullUser = function(key)
{
    delete _users[key];
};


module.exports.pushSocketId = function(key,val)
{
    _socketId[key] = val;
};

module.exports.getSocketId = function(key)
{
    return _socketId[key];
};

module.exports.pullSocketId = function(key)
{
    delete _socketId[key];
};

module.exports.pushRoom = function(key,val)
{
    _rooms[key] = val;
};

module.exports.getRoom = function(key)
{
    if(_rooms[key] === undefined){
        rooms[key] = {};
    }
    return _rooms[key];
};

module.exports.pullRoom = function(key)
{
    delete _rooms[key];
};

module.exports.pushRoomMember = function(key,member)
{
    var room = module.exports.getRoom(key);
    if(room !== undefined){
        room[member] = member;
    }
}

module.exports.pullRoomMember = function(key,member)
{
    var room = module.exports.getRoom(key);
    if(room !== undefined && room[member] !== undefined){
        delete room[key];
    }
}
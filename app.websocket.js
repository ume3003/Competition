/**
 *
 * Created with IntelliJ IDEA.
 * User: shouzouueno
 * Date: 2014/04/29
 * Time: 16:35
 * To change this template use File | Settings | File Templates.
 */


var m_so = require('./so');

m_so.init();

m_so.WSServer.on('connect',function(con){
    var result = {};
    result.cmd = "needId";
    console.log('send ' + JSON.stringify(result));
    con.send(JSON.stringify(result));
});

m_so.WSServer.on('request',function(req){
    var webSocket = req.accept(null,req.origin);

    webSocket.on('message',function(msg){
        var result = {},
            recieve = {};
        console.log('message');
        try{
            recieve = JSON.parse(msg.utf8Data);
            if(recieve !== undefined && recieve.id !== undefined){
                user = m_so.getUser(recieve.id);
                if(user === undefined){
                    user = {};
                    user.id = recieve.id;
                    user.socket = webSocket;
                    m_so.pushUser(user.id,user);
                    webSocket.userId = user.id;
                }
            }
            else{   // クライアントにエラーメッセージを返す
                result.cmd = 'error';
                webSocket.send(Json.stringify(result));
            }


            result.mes = msg.utf8Data;
            webSocket.send(JSON.stringify(result));
            console.log('"' + msg.utf8Data + '" is recieved from ' + req.origin + '!');
            console.log('send:' + JSON.stringify(result));
        }
        catch(exception){
            console.log('error:' + exception);
        }
    });

    webSocket.on('close',function(code,desc){
        console.log('connection released ' + code + ' - ' + desc + ' == ' + webSocket.userId);
    });

});
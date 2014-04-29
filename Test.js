/**
 *
 *
 * Created with IntelliJ IDEA.
 * User: shouzouueno
 * Date: 2014/04/29
 * Time: 14:57
 * To change this template use File | Settings | File Templates.
 */
var http = require('http');
http.createServer(function(req,res){
    res.writeHead(200,{'content-Type':'text/plain'});
    res.end('Hello world\n');
}).listen(8000,'127.0.0.1');
console.log("server is running at 127.0.0.1:8000");


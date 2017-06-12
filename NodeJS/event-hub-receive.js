var ws = require('nodejs-websocket');
var mqtt    = require('mqtt');
var MQTT ="mqtt://200.40.153.99:1890";
 
process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
}); 
 
var wsServer = ws.createServer();
wsServer.listen(8002);
wsServer.on('connection', function(conn){
    console.log("New connection");
});
wsServer.on('error', function(errObj){
    console.log("Error Web Socket");
});
wsServer.on('close', function(){
    console.log("Close Web Socket. Retrying...");
    wsServer.listen(8002);
});

var client  = mqtt.connect(MQTT);
client.on('connect', function () {
    console.log('mqtt (re)connected');
    client.subscribe('schneider/fromMeters/#');
    client.publish('schneider/fromMeters','Hola');
    // client.publish('schneider/setInterval', '.');
});

client.on('message', function (topic, message) {
    // message is Buffer
    console.log('MQTT Topic:' + topic + ' message:' + message.toString());
    broadcast(message);
});

client.on('error', function (message) {
    console.log('MQTT Client Error:' + message.toString());
});


function broadcast(msg) {
    
    console.log(msg);
    wsServer.connections.forEach(function (conn) {
        //conn.sendText("{'hello':25,'hello2':'h2'}");
        conn.sendText(JSON.stringify(msg));
    })
}  
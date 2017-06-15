var EventHubClient = require('azure-event-hubs').Client;
var ws = require('nodejs-websocket');
 
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
function broadcast(msg) {
    
    console.log(msg);
    wsServer.connections.forEach(function (conn) {
        //conn.sendText("{'hello':25,'hello2':'h2'}");
        conn.sendText(JSON.stringify(msg));
    })
}  
//var client = EventHubClient.fromConnectionString('Endpoint=sb://my-servicebus-namespace.servicebus.windows.net/;SharedAccessKeyName=my-SA-name;SharedAccessKey=my-SA-key', 'myeventhub')
var client = EventHubClient.fromConnectionString('Endpoint=sb://eventhub-logicalis.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=9Z5Y2gJTjuMPmhII2I1HUbei7grdQFG8aUUCBqchKKQ=', 'piso19')
client.open()
    .then(function() {
        return client.createReceiver('$Default', '0', { startAfterTime: Date.now() })
    })
    .then(function (rx) {
        rx.on('errorReceived', function (err) { console.log(err); }); 
        rx.on('message', function (message) {
            var body = message.body;
            //console.log('received');
            console.log(body);
            broadcast(body);
            
            // See http://azure.github.io/amqpnetlite/articles/azure_sb_eventhubs.html for details on message annotation properties from EH. 
            //var enqueuedTime = Date.parse(message.systemProperties['x-opt-enqueued-time']);
        });
    }); 
const express = require('express');
var ws = require('nodejs-websocket');
var WS_PORT = 8084;
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const urlencoded = require('body-parser').urlencoded;
const app = express();

var accountSid = 'AC99b9c13f2b94374e3ab40a37ae9142be'; // Your Account SID from www.twilio.com/console
var authToken = '2fc390e0eb62dd6b2c056a3bbaa77011';   // Your Auth Token from www.twilio.com/console// Twilio Credentials
const client = require('twilio')(accountSid, authToken);

var callsid;
var phoneNotificar;
var phoneResponsable;

function call(phoneNotificar,phoneResponsable)
{
    console.log("Init Call...");
    broadcast({type:'info',message:'Iniciando Llamada'});
    client.calls.create({
      url: 'http://b5a341c7.ngrok.io/voice',
      to: phoneNotificar,
      from: '+17632252263',
      statusCallback: 'http://b5a341c7.ngrok.io/status',
      statusCallbackMethod: 'POST',
      statusCallbackEvents: ['initiated', 'ringing', 'answered', 'completed']  
    })
    .then((call) => {callsid = call.sid; console.log(call.sid)});
}

// Parse incoming POST params with Express middleware
app.use(urlencoded({extended: false}));// Create a route that will handle Twilio webhook requests, sent as an
// HTTP POST to /voice in our application
app.post('/voice', (request, response) => {
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather',
  });
  
  //gather.say('The temperature has reach 35 degrees on the Computer Center Floor 19. For Support, press 1.');
  //gather.play('http://logicalis.cc/twilio/hola-carlos-1.mp3');  
  gather.play('http://logicalis.cc/twilio/se-ha-detectado-1.mp3');  
  twiml.redirect('/voice');
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/gather', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) {
    switch (request.body.Digits) {
      case '1': 
        broadcast({type:'info',message:'Redireccionando al Responsable'});
        twiml.play('http://logicalis.cc/twilio/segovia-transfer.mp3');

        //twiml.say('Wait. Redirect call of Logicalis!'); 
        twiml.dial(phoneResponsable);
        twiml.play('http://logicalis.cc/twilio/esta-ha-sido-demo-1.mp3');
        const gather = twiml.gather({
            numDigits: 1,
            action: '/vote',
            });
            gather.play('http://logicalis.cc/twilio/califique-1.mp3');
            twiml.play('http://logicalis.cc/twilio/muchas-gracias-1.mp3');
            break;
      default:
        twiml.play('http://logicalis.cc/twilio/no-escucho-1.mp3');
        twiml.redirect('/voice');
        break;
    }
  } else {
    // If no input was sent, redirect to the /voice route
    twiml.redirect('/voice');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});
app.post('/vote', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) {
      broadcast({type:'rating',message:'CALIFICACION:' + request.body.Digits,"value":request.body.Digits});

    switch (request.body.Digits) {
      case '1': 
      case '2': 
      case '3': 
      case '4': 
      case '5': 
        twiml.play('http://logicalis.cc/twilio/muchas-gracias-1.mp3');
        break;
      default:
        twiml.play('http://logicalis.cc/twilio/muchas-gracias-1.mp3');
        break;
    }
  } else {
        twiml.play('http://logicalis.cc/twilio/muchas-gracias-1.mp3');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/status', (request, response) => {
    broadcast({type:'info',message:request.body.CallStatus});
    if(request.body.CallStatus == 'completed')
    {
        broadcast({type:'info', message:'Duración de la llamada:' + request.body.CallDuration + ' segundos'});
        
        var price = 0;

        client.calls(callsid)
        .fetch()
        .then((call) => 
                      {
                        console.log("call price: " + Math.abs(call.price));
                        price += Math.abs(call.price);
                          
                      }
        )
        .then(() => {
          client.calls
          .each({parentCallSid: callsid}, (child) => 
                      {
                        price += Math.abs(child.price); 
                        console.log("child price: " + Math.abs(child.price));
                      }
          );}
        )
        .then(()=> 
          { 
            console.log("total price: " + price);
            broadcast({type:'info', message:'Costo de la llamada:' + price + ' USD'});
            broadcast({type:'info-background', message:'Final. Gracias por su atención'});
            calling = false;
          }
        );    
    }
    console.log(request.body);
    

});
console.log("Listen...");
app.listen(8080);

function setCallSid(sid)
{
    callsid = sid;
}
var calling = false;
var wsServer = ws.createServer(function (conn) {
    console.log("New connection");
    conn.on("text", function (message) {
        try{
            console.log("Received " + message);
            r = JSON.parse(message);
            if(r.cmd == 'call')
            {
                if(calling)
                    broadcast({type:'info', message:'Demostración en proceso'});
                else
                {
                    calling = true;
                    phoneNotificar = r.notificar;
                    phoneResponsable = r.responsable;
                    console.log('notificar:' + r.notificar + ' responsable:' + r.responsable);
                    call(r.notificar,r.responsable);
                }
            }
            //conn.sendText("hello");
        }catch(e)
        {
            console.log("Web Socket Receive Error. JSON malformed Message:" + message);
        }
    });
    conn.on("close", function (code, reason) {
        console.log("Connection closed");
    });
    conn.on("error", function (errObj) {
        console.log("Error");
    });
}).listen(WS_PORT);

function broadcast(msg) {
    wsServer.connections.forEach(function (conn) {
        conn.sendText(JSON.stringify(msg));
    })
} 


/*
client.calls(callsid)
  .fetch()
  .then((call) => console.log('Call to:' + call.to));

*/
//+541152820308 MLR Escritorio
//+5511972758802 Dany Marquesim
//+56944071634 Suga
//+5491150170327 Tasin
//+56944071635 Marquesim
//+5491166773762 Guille Imbrogno
//+5491144350188 Nico Laurutis
//+5491132830973 Guido Lescano
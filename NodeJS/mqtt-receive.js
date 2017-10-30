var ws = require('nodejs-websocket');
var mqtt = require('mqtt');
var MQTT = "mqtt://127.0.0.1:1890";
const express = require('express');

const VoiceResponse = require('twilio').twiml.VoiceResponse;
const urlencoded = require('body-parser').urlencoded;
const app = express();

var accountSid = 'AC99b9c13f2b94374e3ab40a37ae9142be'; // Your Account SID from www.twilio.com/console
var authToken = '2fc390e0eb62dd6b2c056a3bbaa77011';   // Your Auth Token from www.twilio.com/console// Twilio Credentials
const client = require('twilio')(accountSid, authToken);

var state = 0;
var timeOut=true;
var hasCalled = false;

var irigoyen = "2e0028000a47353138383138";
var tacuari = "310036001047353138383138";

var tempSensor19Totals_value = {};
tempSensor19Totals_value[irigoyen] = 0;
tempSensor19Totals_value[tacuari] = 0; 

var tempSensor20Totals_value = {};
tempSensor20Totals_value[irigoyen] = 0;
tempSensor20Totals_value[tacuari] = 0; 

var cont = 0;
var acumPiso19 = 0;
var acumPiso20 = 0;
var piso19 = false, piso20 = false;


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

var mqttClient  = mqtt.connect(MQTT);
mqttClient.on('connect', function () {
    console.log('mqtt (re)connected');
    mqttClient.subscribe('fromMeters');
    mqttClient.subscribe('fromTemperature');
    mqttClient.subscribe('fromSensor');
});

mqttClient.on('message', function (topic, message) {
    // message is Buffer
    console.log('MQTT Topic:' + topic + ' message:' + message.toString());
    var msg = new Object();
    msg.topic = topic;
    msg.data =  JSON.parse(message.toString());
    broadcast(msg);
    if (msg.topic == "fromSensor"){
        tempSensor19Totals_value[msg.data.id] = msg.data.sensortemp19*1;
        tempSensor20Totals_value[msg.data.id] = msg.data.sensortemp20*1;
        stateMachine(msg);
    }
});

mqttClient.on('error', function (message) {
    console.log('MQTT Client Error:' + message.toString());
});


function broadcast(msg) {
    wsServer.connections.forEach(function (conn) {
        conn.sendText(JSON.stringify(msg));
    });
}  

function call(phone, ruta)
{
    console.log("Init Call...");
    broadcast({type:'info',message:'Iniciando Llamada'});
    var myCall = {
      url: '',
      to: phone,
      from: '+17632252263',
      statusCallbackMethod: 'POST',
      statusCallbackEvents: ['initiated', 'ringing', 'answered', 'completed']  
    };
    switch (ruta)
    {
      case "piso19call1":
        statusCallback: 'http://schneider.ngrok.io/statuscall1',
        myCall.url = 'http://schneider.ngrok.io/piso19call1';
        break;
      case "piso20call1":
        statusCallback: 'http://schneider.ngrok.io/statuscall1',
        myCall.url = 'http://schneider.ngrok.io/piso20call1';
        break;
      case "piso19call2":
        statusCallback: 'http://schneider.ngrok.io/statuscall2',
        myCall.url = 'http://schneider.ngrok.io/piso19call2';
        break;
      case "piso19call2":
        statusCallback: 'http://schneider.ngrok.io/statuscall2',
        myCall.url = 'http://schneider.ngrok.io/piso19call2';
        break;
    }

    client.calls.create(myCall)
    .then((call) => {callsid = call.sid; console.log(call.sid);});
}

// Parse incoming POST params with Express middleware
app.use(urlencoded({extended: false}));// Create a route that will handle Twilio webhook requests, sent as an
// HTTP POST to /voice in our application

/*
------------------------------------------------------------------------------------- PISO 19 CALL 1 ---------------------------------------------------------------------------------------
*/

app.post('/piso19call1', (request, response) => {
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather19call1',
  });
  
  gather.say({voice: "alice", language: "es-ES"}, 'Se ha detectado un valor de temperatura mayor de lo normal en el piso 19. Por favor, disque uno para confirmar el tratamiento del caso.');  
  twiml.redirect('/piso19call1');
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/gather19call1', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) 
  {
    switch (request.body.Digits)
    {
      case '1': 
        state = 5;
        twiml.say({voice: "alice", language: "es-ES"}, 'Muchas gracias, el caso ya se encuentra en estado de tratamiento.');
        twiml.hangup();
        break;
      default:
        twiml.play('http://logicalis.cc/twilio/no-escucho-1.mp3');
        twiml.redirect('/piso19call1');
        break;
    }
  } 
  else
  {
    // If no input was sent, redirect to the /voice route
    twiml.redirect('/piso19call1');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});

/*
------------------------------------------------------------------------------------- PISO 20 CALL 1 ---------------------------------------------------------------------------------------
*/

app.post('/piso20call1', (request, response) => {
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather20call1',
  });
  
  gather.say({voice: "alice", language: "es-ES"}, 'Se ha detectado un valor de temperatura mayor de lo normal en el piso 20. Por favor, disque uno para confirmar el tratamiento del caso.');  
  twiml.redirect('/piso20call1');
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/gather20call1', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) 
  {
    switch (request.body.Digits)
    {
      case '1': 
        state = 5;
        twiml.say({voice: "alice", language: "es-ES"}, 'Muchas gracias, el caso ya se encuentra en estado de tratamiento.');
        twiml.hangup();
        break;
      default:
        twiml.play('http://logicalis.cc/twilio/no-escucho-1.mp3');
        twiml.redirect('/piso20call1');
        break;
    }
  } 
  else
  {
    // If no input was sent, redirect to the /voice route
    twiml.redirect('/piso20call1');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});

/*
------------------------------------------------------------------------------------- PISO 19 CALL 2 ---------------------------------------------------------------------------------------
*/

app.post('/piso19call2', (request, response) => {
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather19call2',
  });
  
  gather.say({voice: "alice", language: "es-ES"}, 'Este es un mensaje de escalamiento porque el incidente no pudo ser resuelto por el M S C. Se ha detectado un valor de temperatura mayor de lo normal en el piso 19, disque uno para confirmar el tratamiento del caso.');  
  twiml.redirect('/piso19call2');
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/gather19call2', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) 
  {
    switch (request.body.Digits)
    {
      case '1': 
        state = 5;
        twiml.say({voice: "alice", language: "es-ES"}, 'Muchas gracias, el caso ya se encuentra en estado de tratamiento.');
        twiml.hangup();
        break;
      default:
        twiml.play('http://logicalis.cc/twilio/no-escucho-1.mp3');
        twiml.redirect('/piso19call2');
        break;
    }
  } 
  else
  {
    // If no input was sent, redirect to the /voice route
    twiml.redirect('/piso19call2');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});

/*
------------------------------------------------------------------------------------- PISO 20 CALL 2 ---------------------------------------------------------------------------------------
*/

app.post('/piso20call2', (request, response) => {
  // Use the Twilio Node.js SDK to build an XML response
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather20call2',
  });
  
  gather.say({voice: "alice", language: "es-ES"}, 'Este es un mensaje de escalamiento porque el incidente no pudo ser resuelto por el M S C. Se ha detectado un valor de temperatura mayor de lo normal en el piso 20, disque uno para confirmar el tratamiento del caso.');  
  twiml.redirect('/piso20call2');
  response.type('text/xml');
  response.send(twiml.toString());
});

app.post('/gather20call2', (request, response) => {
  const twiml = new VoiceResponse();

  // If the user entered digits, process their request
  if (request.body.Digits) 
  {
    switch (request.body.Digits)
    {
      case '1': 
        state = 5;
        twiml.say({voice: "alice", language: "es-ES"}, 'Muchas gracias, el caso ya se encuentra en estado de tratamiento.');
        twiml.hangup();
        break;
      default:
        twiml.play('http://logicalis.cc/twilio/no-escucho-1.mp3');
        twiml.redirect('/piso20call2');
        break;
    }
  } 
  else
  {
    // If no input was sent, redirect to the /voice route
    twiml.redirect('/piso20call2');
  }

  // Render the response as XML in reply to the webhook request
  response.type('text/xml');
  response.send(twiml.toString());
});

/*
------------------------------------------------------------------------------------- STATUS CALL1 ---------------------------------------------------------------------------------------
*/

app.post('/statuscall1', (request, response) => {
  if(request.body.CallStatus == 'no-answer')
  {
    hasCalled = false;
    state = 4;
  }
});

/*
------------------------------------------------------------------------------------- STATUS CALL2 ---------------------------------------------------------------------------------------
*/

app.post('/statuscall2', (request, response) => {
  if(request.body.CallStatus == 'no-answer')
  {
    state = 3;
  }
});

/*
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
*/

console.log("Listen...");
app.listen(8082);

//------------------------------------------------------------------------------------Máquina de estados-------------------------------------------------------------------------------------

function stateMachine(msg)
{
  switch (state)
  {
    case 0: //NORMAL
        console.log("NORMAL");
        if (tempSensor19Totals_value[msg.data.id] >= 19 ||  tempSensor20Totals_value[msg.data.id] >= 26)
            state = 1; //si alguna de las temperaturas supera los 26 grados pasa al estado ALERT
        break;

    case 1: //ALERT
        console.log("ALERT");
        acumPiso19 += tempSensor19Totals_value[msg.data.id];
        acumPiso20 += tempSensor20Totals_value[msg.data.id];
        if(cont == 0){
            setTimeout(function(){
                var promedioTemp19 = acumPiso19/cont;
                console.log("promedio19: " + promedioTemp19)
                piso19 = false;
                piso20 = false;
                if (promedioTemp19 >= 19){
                    console.log("La temperatura del piso 19 superó los 26 grados");
                    piso19 = true;
                }

                var promedioTemp20 = acumPiso20/cont;
                console.log("promedio20: " + promedioTemp20)
                if (promedioTemp20 >= 26){
                    console.log("La temperatura del piso 20 superó los 26 grados");
                    piso20 = true;
                }

                if (piso19 || piso20)
                {
                  if (!hasCalled)
                        state = 2; //si durante el estado ALERT el promedio de alguno pasa los 26 grados y no hubo llamada pasa a estado CALL1
                  else
                    state = 3; //si durante el estado ALERT el promedio de alguno pasa los 26 grados y hubo llamada pasa a estado NOCALL
                }
                  else
                      state = 0; //sino, vuelve a estado NORMAL

                cont=0;
                acumPiso19=0;
                acumPiso20=0;
                
              }, 10000/*120000*/);
        }
        cont++;
        break;

    case 2: //CALL1  
    console.log("CALL1, hasCalled: " + hasCalled);
      if(!hasCalled){
        if (piso19 && piso20){
            console.log("Grabar audio")
        }
        else if (piso19 && !piso20){
            call("+541152820447","piso19call1");
        }
        else if (!piso19 && piso20){
            call("+541152820447","piso20call1");
        }
        hasCalled = true;
      }
        break;

    case 3: //NOCALL
    console.log("NOCALL");
      if(timeOut)
        {
          timeOut = false;
            setTimeout(function(){
              hasCalled = false;
              state=0;
              timeOut = true
                
              }, 43200000); //Espera 12 horas y vuelve a estado normal
        }
        break;

    case 4: //CALL2

    console.log("CALL2, hasCalled: " + hasCalled);
      if (!hasCalled)
      {
        if (piso19 && piso20){
            console.log("Grabar audio")
        }
        else if (piso19 && !piso20){
            call("+541152820447","piso19call2");
        }
        else if (!piso19 && piso20){
            call("+541152820447","piso20call2");
        }
      }
        break;

    case 5: //TRATAMIENTO 
    console.log("TRATAMIENTO");
        if(timeOut)
        {
            timeOut = false;
            setTimeout(function(){
                hasCalled = false;
                state=0; //Después de 30 minutos vuelve a estado NORMAL
                timeOut=true;
            },1800000);
        }
        break;
  }
}